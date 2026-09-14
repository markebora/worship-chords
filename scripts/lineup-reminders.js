/* scripts/lineup-reminders.js Same reminder logic as before, just as a plain script instead of a Vercel function — GitHub Actions runs this on a schedule (see .github/workflows/lineup-reminders.yml) and it calls your existing /api/notify-new-song endpoint to actually send the push. Nothing to deploy on Vercel; nothing to touch in vercel.json. Fires, per lineup doc: - 5 hrs before rehearsalTime → "Rehearsal na mamaya!" - 3 hrs before serviceTime → day-of push with the song list - 20 min before serviceTime → "See you on the other side, Disciples!" Needed as GitHub Actions repo secrets (Settings → Secrets and variables → Actions — NOT committed to the repo): FIREBASE_SERVICE_ACCOUNT_KEY the full service account JSON, as one line NOTIFY_SECRET same value your notify-new-song API already checks CHURCH_TIMEZONE e.g. "America/New_York" (optional, has a default below) API_BASE_URL optional, defaults to your current deployment */

const { DateTime } = require("luxon");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
    ),
  });
}

const db = admin.firestore();

const CHURCH_TIMEZONE = process.env.CHURCH_TIMEZONE || "America/New_York";
const REHEARSAL_HOURS_BEFORE = 5;
const SERVICE_HOURS_BEFORE = 3;
const SERVICE_MINUTES_BEFORE = 20;
const WINDOW_MINUTES = 15; // should match the workflow's cron interval
const API_BASE_URL =
  process.env.API_BASE_URL || "https://worship-chords-rho.vercel.app";

async function sendBroadcast(title, heading) {
  await fetch(`${API_BASE_URL}/api/notify-new-song`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Notify-Secret": process.env.NOTIFY_SECRET,
    },
    body: JSON.stringify({ title, heading }),
  });
}

function parseZonedDateTime(dateKey, timeStr, dayOffset, timeZone) {
  if (!timeStr) return null;
  const base = DateTime.fromISO(dateKey, { zone: timeZone }).plus({
    days: dayOffset,
  });
  const [hour, minute] = timeStr.split(":").map(Number);
  return base.set({ hour, minute, second: 0, millisecond: 0 });
}

function isDue(targetInstant, now, windowMinutes) {
  if (!targetInstant) return false;
  const diffMinutes = targetInstant.diff(now, "minutes").minutes;
  return diffMinutes <= 0 && diffMinutes > -windowMinutes;
}

async function main() {
  const now = DateTime.now().setZone(CHURCH_TIMEZONE);
  const results = [];

  const teamsSnap = await db.collection("teams").get();

  for (const teamDoc of teamsSnap.docs) {
    const lineupsSnap = await teamDoc.ref.collection("lineups").get();

    for (const lineupDoc of lineupsSnap.docs) {
      const dateKey = lineupDoc.id;
      const data = lineupDoc.data() || {};
      const songCount = Array.isArray(data.songs) ? data.songs.length : 0;

      const rehearsalAt = parseZonedDateTime(
        dateKey,
        data.rehearsalTime,
        -1,
        CHURCH_TIMEZONE
      );
      const serviceAt = parseZonedDateTime(
        dateKey,
        data.serviceTime,
        0,
        CHURCH_TIMEZONE
      );

      const rehearsalReminderAt = rehearsalAt
        ? rehearsalAt.minus({ hours: REHEARSAL_HOURS_BEFORE })
        : null;
      const serviceReminderAt = serviceAt
        ? serviceAt.minus({ hours: SERVICE_HOURS_BEFORE })
        : null;
      const serviceSoonReminderAt = serviceAt
        ? serviceAt.minus({ minutes: SERVICE_MINUTES_BEFORE })
        : null;

      // rehearsal reminder
      if (
        isDue(rehearsalReminderAt, now, WINDOW_MINUTES) &&
        data.rehearsalReminderSentFor !== rehearsalAt.toISO()
      ) {
        if (songCount > 0) {
          await sendBroadcast(
            `${songCount} song${ songCount === 1 ? "" : "s" } on the lineup — see you there!`,
            "Rehearsal na mamaya!"
          );
        } else {
          await sendBroadcast(
            `The lineup is still empty and rehearsal is in ${REHEARSAL_HOURS_BEFORE} hours 👀`,
            "Rehearsal na mamaya!"
          );
        }

        await lineupDoc.ref.set(
          { rehearsalReminderSentFor: rehearsalAt.toISO() },
          { merge: true }
        );
        results.push(`${teamDoc.id}/${dateKey}: rehearsal reminder sent`);
      }

      // service — 3 hrs out
      if (
        isDue(serviceReminderAt, now, WINDOW_MINUTES) &&
        data.serviceReminderSentFor !== serviceAt.toISO()
      ) {
        if (songCount > 0) {
          await sendBroadcast(
            `Service is in ${SERVICE_HOURS_BEFORE} hours — ${songCount} song${ songCount === 1 ? "" : "s" } ready to go.`,
            "Today's the day! 🎶"
          );
        } else {
          await sendBroadcast(
            `Service is in ${SERVICE_HOURS_BEFORE} hours and no lineup has been set yet.`,
            "Disciples — heads up!"
          );
        }

        await lineupDoc.ref.set(
          { serviceReminderSentFor: serviceAt.toISO() },
          { merge: true }
        );
        results.push(`${teamDoc.id}/${dateKey}: service reminder sent`);
      }

      // service — 20 min out
      if (
        isDue(serviceSoonReminderAt, now, WINDOW_MINUTES) &&
        data.serviceSoonReminderSentFor !== serviceAt.toISO()
      ) {
        await sendBroadcast(
          `Service starts in ${SERVICE_MINUTES_BEFORE} minutes.`,
          "See you on the other side, Disciples!"
        );

        await lineupDoc.ref.set(
          { serviceSoonReminderSentFor: serviceAt.toISO() },
          { merge: true }
        );
        results.push(`${teamDoc.id}/${dateKey}: 20-min service reminder sent`);
      }
    }
  }

  console.log("checked at", now.toISO());
  console.log(results.length ? results.join("\n") : "nothing due this run");
}

main().catch((error) => {
  console.error("lineup-reminders failed:", error);
  process.exit(1);
});
