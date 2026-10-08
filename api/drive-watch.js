import { getStoredChannel, replaceWatchChannel, getWebhookUrl } from './_lib/watch.js';
import { redis } from './_lib/kv.js';

/*
  Merged drive-watch endpoint (replaces drive-watch-setup / -renew / -status
  so the project stays under Vercel Hobby's 12-function limit).

  Old URLs still work through the rewrites in vercel.json:
    /api/drive-watch-setup   ->  /api/drive-watch?action=setup
    /api/drive-watch-renew   ->  /api/drive-watch?action=renew
    /api/drive-watch-status  ->  /api/drive-watch?action=status
*/

const ONE_DAY_MS = 1000 * 60 * 60 * 24;

const SEEN_FILES_KEY = 'drive:seenFileIds';
const SUBSCRIPTIONS_KEY = 'push:subscriptions';
const PAGE_TOKEN_KEY = 'drive:pageToken';

function hasValidSecret(req){

  const providedSecret =
    req.headers['x-setup-secret'];

  return (
    !!process.env.DRIVE_WEBHOOK_SECRET &&
    providedSecret === process.env.DRIVE_WEBHOOK_SECRET
  );

}

/* POST + x-setup-secret: start Drive watching (run once after deploy). */

async function setup(req, res){

  if(req.method !== 'POST'){
    return res.status(405).json({ error:'POST only' });
  }

  if(!hasValidSecret(req)){
    return res.status(401).json({ error:'Unauthorized' });
  }

  try{

    const webhookUrl =
      getWebhookUrl(req);

    const channel =
      await replaceWatchChannel(webhookUrl);

    return res.status(200).json({
      ok:true,
      webhookUrl,
      channel
    });

  }catch(error){

    console.error('drive-watch setup failed:', error);

    return res.status(500).json({ error:error.message });

  }

}

/* Called by Vercel Cron (Bearer CRON_SECRET) to keep the channel alive. */

async function renew(req, res){

  if(process.env.CRON_SECRET){

    const auth =
      req.headers['authorization'];

    if(auth !== `Bearer ${process.env.CRON_SECRET}`){
      return res.status(401).json({ error:'Unauthorized' });
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
      await replaceWatchChannel(webhookUrl);

    return res.status(200).json({
      ok:true,
      channel
    });

  }catch(error){

    console.error('drive-watch renew failed:', error);

    return res.status(500).json({ error:error.message });

  }

}

/* GET + x-setup-secret: check whether Drive watching is alive. */

async function status(req, res){

  if(req.method !== 'GET'){
    return res.status(405).json({ error:'GET only' });
  }

  if(!hasValidSecret(req)){
    return res.status(401).json({ error:'Unauthorized' });
  }

  try{

    const channel =
      await getStoredChannel();

    const pageToken =
      await redis('GET', PAGE_TOKEN_KEY);

    const seenFileCount =
      await redis('SCARD', SEEN_FILES_KEY) || 0;

    const subscriptionCount =
      await redis('HLEN', SUBSCRIPTIONS_KEY) || 0;

    const msUntilExpiration =
      channel
        ? channel.expiration - Date.now()
        : null;

    return res.status(200).json({

      watching:
        !!channel,

      channel:
        channel
          ? {
              id:channel.id,
              resourceId:channel.resourceId,
              expiresAt:
                new Date(channel.expiration).toISOString(),
              expiresInHours:
                msUntilExpiration !== null
                  ? Math.round(msUntilExpiration / 3600000 * 10) / 10
                  : null,
              expired:
                msUntilExpiration !== null
                  ? msUntilExpiration <= 0
                  : null
            }
          : null,

      hasPageToken:
        !!pageToken,

      seenFileCount,

      subscriptionCount,

      folderId:
        process.env.GOOGLE_DRIVE_FOLDER_ID || null

    });

  }catch(error){

    console.error('drive-watch status failed:', error);

    return res.status(500).json({ error:error.message });

  }

}

export default async function handler(req, res){

  const action =
    String(req.query?.action || '').toLowerCase();

  if(action === 'setup') return setup(req, res);
  if(action === 'renew') return renew(req, res);
  if(action === 'status') return status(req, res);

  return res.status(400).json({
    error:'Unknown action. Use ?action=setup, renew or status.'
  });

}
