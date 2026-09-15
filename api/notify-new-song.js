import { broadcastNotification } from './_lib/push.js';

/*
  Called directly by index.html right after a brand-new song is
  successfully added to the shared Firestore library (see
  uploadNewSongToDrive() in index.html) — no more watching a
  Drive folder for changes, since the library isn't stored in
  Drive anymore. Whoever's device made the save just tells the
  backend "a song was added," and the backend fans that out as
  a push notification to everyone else.

  Protected by a shared secret (NOTIFY_SECRET env var) baked
  into index.html as NOTIFY_SECRET near the top, next to the
  Firebase config — just enough to stop randoms who find your
  API URL from spamming notifications; it isn't meant to be
  cryptographically strong for a private ~10-person app.
*/

export default async function handler(req, res){

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Notify-Secret');

  if(req.method === 'OPTIONS')return res.status(204).end();

  if(req.method !== 'POST'){

    return res.status(405).json({
      error:'POST only'
    });

  }

  const providedSecret =
    req.headers['x-notify-secret'];

  if(
    !process.env.NOTIFY_SECRET ||
    providedSecret !== process.env.NOTIFY_SECRET
  ){

    return res.status(401).json({
      error:'Unauthorized'
    });

  }

  try{

    const { title, heading } =
      req.body || {};

    if(!title || typeof title !== 'string'){

      return res.status(400).json({
        error:'Missing song title.'
      });

    }

    const result =
      await broadcastNotification({

        title: (typeof heading === 'string' && heading) || 'New song added',
        body: title.slice(0,120),
        url:'/',
        tag:'new-song-' + Date.now()

      });

    return res.status(200).json({
      ok:true,
      ...result
    });

  }catch(error){

    console.error(
      'notify-new-song failed:',
      error
    );

    return res.status(500).json({
      error: error.message || 'Notify failed.'
    });

  }

}
