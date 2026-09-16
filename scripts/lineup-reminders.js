/*
  scripts/lineup-reminders.js

  GitHub Actions runs this on a schedule (see
  .github/workflows/lineup-reminders.yml) and it calls your
  existing /api/notify-new-song endpoint to actually send the
  push. Nothing to deploy on Vercel; nothing to touch in
  vercel.json.

  IMPORTANT FIX: this used to read teams/{teamId}/lineups/{dateKey}
  — a path your actual firestore.rules never allowed (rules only
  cover flat top-level lineups/{docId}). index.html now writes
  lineups the same way it already writes libraries/videoArchive:
  a flat `lineups` collection, doc id `{teamId}_{dateKey}`, with
  `teamId` and `dateKey` as fields on the doc. This script reads
  that same flat collection directly — since it runs with a
  Firebase Admin service account, it bypasses security rules
  entirely, so no team loop or filtering is needed here at all.

  Each lineup has an eventType — 'sunday-worship' (default),
  'rehearsal', or 'event' — set on the Lineup screen. It decides
  which time field(s) apply and what gets sent:

    sunday-worship — rehearsalTime (the evening BEFORE the
      lineup's date) + serviceTime (ON the date).
        5 hrs before rehearsal → "Rehearsal na mamaya!" with the
          actual setlist song titles.
        3 hrs before service → "Worship mamaya ha?"
        5 min before service → "See you on the other side,
          Disciples!"

    rehearsal — a standalone rehearsal, not tied to a Sunday.
      rehearsalTime falls ON the lineup's date instead of the
      day before.
        5 hrs before → "Rehearsal na mamaya!" with the setlist.

    event — anything else (a program, outreach, etc).
      serviceTime falls ON the lineup's date.
        3 hrs before → "Worship mamaya ha?"
        5 min before → "See you on the other side, Disciples!"

  Needed as GitHub Actions repo secrets (Settings → Secrets and
  variables → Actions — NOT committed to the repo):
    FIREBASE_SERVICE_ACCOUNT_KEY   the full service account JSON, as one line
    NOTIFY_SECRET                  same value your notify-new-song API already checks
    CHURCH_TIMEZONE                e.g. "Asia/Manila" (optional, has a default below)
    API_BASE_URL                   optional, defaults to your current deployment
*/

const { DateTime } = require('luxon');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
    )
  });
}

const db = admin.firestore();

const CHURCH_TIMEZONE = process.env.CHURCH_TIMEZONE || 'Asia/Manila';
const REHEARSAL_HOURS_BEFORE = 5;
const SERVICE_HOURS_BEFORE = 3;
const SERVICE_MINUTES_BEFORE = 5;
const WINDOW_MINUTES = 5; // should match the workflow's cron interval
const API_BASE_URL = process.env.API_BASE_URL || 'https://worship-chords-rho.vercel.app';

async function sendBroadcast(title, heading) {
  await fetch(`${API_BASE_URL}/api/notify-new-song`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Notify-Secret': process.env.NOTIFY_SECRET
    },
    body: JSON.stringify({ title, heading })
  });
}

function parseZonedDateTime(dateKey, timeStr, dayOffset, timeZone) {
  if (!timeStr) return null;
  const base = DateTime.fromISO(dateKey, { zone: timeZone }).plus({ days: dayOffset });
  const [hour, minute] = timeStr.split(':').map(Number);
  return base.set({ hour, minute, second: 0, millisecond: 0 });
}

function isDue(targetInstant, now, windowMinutes) {
  if (!targetInstant) return false;
  const diffMinutes = targetInstant.diff(now, 'minutes').minutes;
  return diffMinutes <= 0 && diffMinutes > -windowMinutes;
}

function setlistLine(songs) {
  const titles = (songs || []).map(s => s && s.title).filter(Boolean);
  if (!titles.length) return null;
  return titles.join(', ');
}

async function main() {

  const now = DateTime.now().setZone(CHURCH_TIMEZONE);
  const results = [];

  const lineupsSnap = await db.collection('lineups').get();

  for (const lineupDoc of lineupsSnap.docs) {

    const data = lineupDoc.data() || {};
    const dateKey = data.dateKey;

    if (!dateKey) continue; // older doc from before this fix — skip rather than guess

    const eventType = data.eventType || 'sunday-worship';
    const setlist = setlistLine(data.songs);

    // Rehearsal day is the evening BEFORE the date for a
    // sunday-worship entry, but ON the date itself for a
    // standalone rehearsal entry.
    const rehearsalDayOffset = eventType === 'rehearsal' ? 0 : -1;
    const hasRehearsal = eventType === 'sunday-worship' || eventType === 'rehearsal';
    const hasService = eventType === 'sunday-worship' || eventType === 'event';

    const rehearsalAt = hasRehearsal
      ? parseZonedDateTime(dateKey, data.rehearsalTime, rehearsalDayOffset, CHURCH_TIMEZONE)
      : null;

    const serviceAt = hasService
      ? parseZonedDateTime(dateKey, data.serviceTime, 0, CHURCH_TIMEZONE)
      : null;

    const rehearsalReminderAt = rehearsalAt ? rehearsalAt.minus({ hours: REHEARSAL_HOURS_BEFORE }) : null;
    const serviceReminderAt = serviceAt ? serviceAt.minus({ hours: SERVICE_HOURS_BEFORE }) : null;
    const serviceSoonReminderAt = serviceAt ? serviceAt.minus({ minutes: SERVICE_MINUTES_BEFORE }) : null;

    // rehearsal reminder — "Rehearsal na mamaya!" w/ setlist
    if (isDue(rehearsalReminderAt, now, WINDOW_MINUTES) && data.rehearsalReminderSentFor !== rehearsalAt.toISO()) {

      const body = setlist
        ? `Set list: ${setlist}`
        : 'The lineup is still empty 👀';

      await sendBroadcast(body, 'Rehearsal na mamaya!');

      await lineupDoc.ref.set({ rehearsalReminderSentFor: rehearsalAt.toISO() }, { merge: true });
      results.push(`${dateKey} (${eventType}): rehearsal reminder sent`);

    }

    // service — 3 hrs out — "Worship mamaya ha?"
    if (isDue(serviceReminderAt, now, WINDOW_MINUTES) && data.serviceReminderSentFor !== serviceAt.toISO()) {

      const body = setlist
        ? `Starts in ${SERVICE_HOURS_BEFORE} hours — set list: ${setlist}`
        : `Starts in ${SERVICE_HOURS_BEFORE} hours — no lineup set yet.`;

      await sendBroadcast(body, 'Worship mamaya ha?');

      await lineupDoc.ref.set({ serviceReminderSentFor: serviceAt.toISO() }, { merge: true });
      results.push(`${dateKey} (${eventType}): 3-hr reminder sent`);

    }

    // service — 5 min out — "See you on the other side, Disciples!"
    if (isDue(serviceSoonReminderAt, now, WINDOW_MINUTES) && data.serviceSoonReminderSentFor !== serviceAt.toISO()) {

      await sendBroadcast(
        `Starts in ${SERVICE_MINUTES_BEFORE} minutes.`,
        'See you on the other side, Disciples!'
      );

      await lineupDoc.ref.set({ serviceSoonReminderSentFor: serviceAt.toISO() }, { merge: true });
      results.push(`${dateKey} (${eventType}): 5-min reminder sent`);

    }

  }

  console.log('checked at', now.toISO());
  console.log(results.length ? results.join('\n') : 'nothing due this run');

}

main().catch(error => {
  console.error('lineup-reminders failed:', error);
  process.exit(1);
});
