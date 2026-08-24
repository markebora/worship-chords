import { getStoredChannel } from './_lib/watch.js';
import { redis } from './_lib/kv.js';

const SEEN_FILES_KEY = 'drive:seenFileIds';
const SUBSCRIPTIONS_KEY = 'push:subscriptions';
const PAGE_TOKEN_KEY = 'drive:pageToken';

/*
  GET this (with header x-setup-secret matching DRIVE_WEBHOOK_SECRET)
  to check whether Drive watching is actually alive, without
  poking around in Redis by hand.
*/

export default async function handler(req, res){

  if(req.method !== 'GET'){

    return res.status(405).json({
      error:'GET only'
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

    const channel =
      await getStoredChannel();

    const pageToken =
      await redis('GET', PAGE_TOKEN_KEY);

    const seenFileCount =
      await redis('SCARD', SEEN_FILES_KEY) || 0;

    const subscriptionCount =
      await redis('HLEN', SUBSCRIPTIONS_KEY) || 0;

    const now = Date.now();

    const msUntilExpiration =
      channel
        ? channel.expiration - now
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

    console.error(
      'drive-watch-status failed:',
      error
    );

    return res.status(500).json({
      error:error.message
    });

  }

}
