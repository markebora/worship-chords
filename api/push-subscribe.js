import {
  saveSubscription,
  removeSubscription,
  saveFcmToken,
  removeFcmToken
} from './_lib/push.js';

export default async function handler(req, res){

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if(req.method === 'OPTIONS')return res.status(204).end();

  if(req.method === 'POST'){

    try{

      const { subscription, fcmToken } =
        req.body || {};

      if(fcmToken){

        /* Native Android app (Capacitor + Firebase Cloud Messaging) */
        await saveFcmToken(fcmToken);

      }else{

        await saveSubscription(
          subscription
        );

      }

      return res.status(200).json({ ok:true });

    }catch(error){

      return res.status(400).json({
        error:error.message || 'Could not save subscription.'
      });

    }

  }

  if(req.method === 'DELETE'){

    try{

      const { endpoint, fcmToken } =
        req.body || {};

      if(fcmToken){

        await removeFcmToken(fcmToken);

        return res.status(200).json({ ok:true });

      }

      if(!endpoint){

        return res.status(400).json({
          error:'Missing endpoint.'
        });

      }

      await removeSubscription(
        endpoint
      );

      return res.status(200).json({ ok:true });

    }catch(error){

      return res.status(400).json({
        error:error.message || 'Could not remove subscription.'
      });

    }

  }

  return res.status(405).json({
    error:'POST or DELETE only'
  });

}
