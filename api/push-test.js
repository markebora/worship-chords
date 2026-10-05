import { sendFcmTest } from './_lib/push.js';

/*
  Sends a single test push to ONE phone (the FCM token it supplies).
  Same shared-secret check as notify-new-song, so strangers can't use
  it. Always answers 200 with {ok, code, message} so the app can show
  the real reason when Firebase refuses.
*/

export default async function handler(req, res){

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Notify-Secret');

  if(req.method === 'OPTIONS')return res.status(204).end();

  if(req.method !== 'POST'){

    return res.status(405).json({ error:'POST only' });

  }

  if(
    !process.env.NOTIFY_SECRET ||
    req.headers['x-notify-secret'] !== process.env.NOTIFY_SECRET
  ){

    return res.status(401).json({ error:'Unauthorized (NOTIFY_SECRET does not match).' });

  }

  const { fcmToken } =
    req.body || {};

  if(typeof fcmToken !== 'string' || fcmToken.length < 20){

    return res.status(400).json({ error:'Missing push token.' });

  }

  const result =
    await sendFcmTest(fcmToken);

  return res.status(200).json(result);

}
