import { replaceWatchChannel, getWebhookUrl } from './_lib/watch.js';

/*
  Call this once (POST, with header x-setup-secret matching your
  DRIVE_WEBHOOK_SECRET env var) after deploying, to start Drive
  watching. The daily cron (drive-watch-renew) keeps it alive
  after that — you shouldn't need to call this again unless the
  channel gets stopped or your webhook URL changes.
*/

export default async function handler(req, res){

  if(req.method !== 'POST'){

    return res.status(405).json({
      error:'POST only'
    });

  }

  const providedSecret =
    req.headers['x-setup-secret'];

  if(
    !process.env.DRIVE_WEBHOOK_SECRET ||
    providedSecret !== process.env.DRIVE_WEBHOOK_SECRET
  ){

    return res.status(401).json({
      error:'Unauthorized'
    });

  }

  try{

    const webhookUrl =
      getWebhookUrl(req);

    const channel =
      await replaceWatchChannel(
        webhookUrl
      );

    return res.status(200).json({
      ok:true,
      webhookUrl,
      channel
    });

  }catch(error){

    console.error(
      'drive-watch-setup failed:',
      error
    );

    return res.status(500).json({
      error:error.message
    });

  }

}
