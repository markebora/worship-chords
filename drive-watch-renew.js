import { getStoredChannel, replaceWatchChannel, getWebhookUrl } from './_lib/watch.js';

const ONE_DAY_MS = 1000 * 60 * 60 * 24;

export default async function handler(req, res){

  /*
    If CRON_SECRET is set, Vercel Cron automatically attaches it
    as a bearer token on scheduled calls — this rejects anyone
    else who tries to hit the endpoint directly.
  */

  if(process.env.CRON_SECRET){

    const auth =
      req.headers['authorization'];

    if(auth !== `Bearer ${process.env.CRON_SECRET}`){

      return res.status(401).json({
        error:'Unauthorized'
      });

    }

  }

  try{

    const existing =
      await getStoredChannel();

    if(
      existing &&
      existing.expiration - Date.now() > ONE_DAY_MS
    ){

      return res.status(200).json({
        ok:true,
        skipped:true,
        reason:'Channel still has more than a day left.'
      });

    }

    const webhookUrl =
      getWebhookUrl(req);

    const channel =
      await replaceWatchChannel(
        webhookUrl
      );

    return res.status(200).json({
      ok:true,
      channel
    });

  }catch(error){

    console.error(
      'drive-watch-renew failed:',
      error
    );

    return res.status(500).json({
      error:error.message
    });

  }

}
