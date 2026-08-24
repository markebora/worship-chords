import { saveSubscription, removeSubscription } from './_lib/push.js';

export default async function handler(req, res){

  if(req.method === 'POST'){

    try{

      const { subscription } =
        req.body || {};

      await saveSubscription(
        subscription
      );

      return res.status(200).json({ ok:true });

    }catch(error){

      return res.status(400).json({
        error:error.message || 'Could not save subscription.'
      });

    }

  }

  if(req.method === 'DELETE'){

    try{

      const { endpoint } =
        req.body || {};

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
