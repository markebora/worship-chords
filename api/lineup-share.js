/*
  Read-only view of a shared lineup.

    GET /api/lineup-share?token=abc123...
        optional header:  Authorization: Bearer <Firebase ID token>

  Everyone with the link gets the lineup title, date and each song's
  title + key. If the request carries a valid Firebase sign-in for a
  member of the lineup's team, the response also includes the chords
  and lyrics of every song (and "member": true). Anyone else - not
  signed in, or signed in to a different team - never receives them.

  The app writes the snapshot to lineupShares/{token} when someone
  taps "Share this lineup". Firestore rules stop the app from reading
  those docs directly; this endpoint reads them with the server's
  service-account key. "Stop sharing" sets revoked = true.

  Needs FIREBASE_SERVICE_ACCOUNT_KEY on Vercel (already set for push).
*/

export default async function handler(req, res){

  res.setHeader('Cache-Control', 'no-store');

  if(req.method !== 'GET'){

    res.status(405).json({ error:'Method not allowed' });
    return;

  }

  const token = String((req.query && req.query.token) || '').trim();

  if(!/^[A-Za-z0-9]{12,64}$/.test(token)){

    res.status(400).json({ error:'That link is not valid.' });
    return;

  }

  if(!process.env.FIREBASE_SERVICE_ACCOUNT_KEY){

    res.status(503).json({ error:'Sharing is not set up on the server yet.' });
    return;

  }

  try{

    const { initializeApp, cert, getApps } =
      await import('firebase-admin/app');

    const { getFirestore } =
      await import('firebase-admin/firestore');

    const app =
      getApps()[0] ||
      initializeApp({
        credential: cert(
          JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
        )
      });

    const db = getFirestore(app);

    const snap = await db.collection('lineupShares').doc(token).get();

    if(!snap.exists){

      res.status(404).json({ error:'This lineup link was not found.' });
      return;

    }

    const data = snap.data() || {};

    if(data.revoked){

      res.status(410).json({ error:'This lineup link has been turned off.' });
      return;

    }

    /* Who is asking? 'anonymous' (no/invalid sign-in), 'signed-in'
       (valid account but not on this team) or 'member'. */
    let viewer = 'anonymous';

    const authHeader = String(req.headers.authorization || '');

    if(/^Bearer /i.test(authHeader)){

      try{

        const { getAuth } = await import('firebase-admin/auth');

        const decoded =
          await getAuth(app).verifyIdToken(authHeader.replace(/^Bearer\s+/i, ''));

        viewer = 'signed-in';

        if(data.teamId){

          const teamSnap =
            await db.collection('teams').doc(String(data.teamId)).get();

          const memberUids =
            (teamSnap.exists && Array.isArray(teamSnap.data().memberUids))
              ? teamSnap.data().memberUids
              : [];

          if(memberUids.includes(decoded.uid))viewer = 'member';

        }

      }catch(error){

        viewer = 'anonymous';

      }

    }

    const text = (value, max) => String(value || '').slice(0, max);

    const songs =
      (Array.isArray(data.songs) ? data.songs : [])
        .slice(0, 50)
        .map(song => ({
          title: text(song && song.title, 120) || 'Untitled Song',
          key: text(song && song.key, 12)
        }));

    if(viewer === 'member'){

      const detail = Array.isArray(data.memberSongs) ? data.memberSongs : [];

      songs.forEach((song, index) => {

        const full = detail[index];

        song.sections =
          (full && Array.isArray(full.sections) ? full.sections : [])
            .slice(0, 30)
            .map(section => ({
              name: text(section && section.name, 60),
              lines: (Array.isArray(section && section.lines) ? section.lines : [])
                .slice(0, 300)
                .map(line => text(line, 300)),
              chords: (Array.isArray(section && section.chords) ? section.chords : [])
                .filter(value => Number.isInteger(value))
            }));

      });

    }

    res.status(200).json({

      ok: true,
      viewer,
      member: viewer === 'member',
      title: text(data.title, 120) || 'Worship Lineup',
      dateKey: text(data.dateKey, 20),
      dateLabel: text(data.dateLabel, 80),
      teamId: text(data.teamId, 80),
      songs,
      updatedAt: Number(data.updatedAt) || 0

    });

  }catch(error){

    console.error('lineup-share failed', error);

    res.status(500).json({ error:'Could not load this lineup. Try again in a moment.' });

  }

}
