import crypto from 'crypto';
import { redis } from './kv.js';
import {
  getAccessToken,
  getStartPageToken,
  watchChanges,
  stopChannel
} from './drive.js';

const CHANNEL_KEY = 'drive:channel';
const PAGE_TOKEN_KEY = 'drive:pageToken';

/*
  Google allows longer, but we renew daily via cron anyway —
  keeping this short means a missed/late cron run still fails
  safe (worst case: a short gap in real-time notifications,
  never a permanently dead channel).
*/
const CHANNEL_TTL_MS = 1000 * 60 * 60 * 24 * 2;


export function getWebhookUrl(req){

  const explicit =
    process.env.PUBLIC_BASE_URL;

  if(explicit){

    return `${explicit.replace(/\/$/, '')}/api/drive-webhook`;

  }

  const host =
    req.headers['x-forwarded-host'] ||
    req.headers.host;

  const proto =
    req.headers['x-forwarded-proto'] ||
    'https';

  return `${proto}://${host}/api/drive-webhook`;

}


export async function getStoredChannel(){

  const raw =
    await redis('GET', CHANNEL_KEY);

  return raw
    ? JSON.parse(raw)
    : null;

}


async function createWatchChannel(webhookUrl){

  const accessToken =
    await getAccessToken();

  const pageToken =
    await getStartPageToken(accessToken);

  const channelId =
    crypto.randomUUID();

  const expiration =
    Date.now() + CHANNEL_TTL_MS;

  const watch =
    await watchChanges(accessToken, {

      channelId,
      webhookUrl,
      pageToken,
      expirationMs:expiration,

      channelToken:
        process.env.DRIVE_WEBHOOK_SECRET

    });

  await redis(
    'SET',
    CHANNEL_KEY,
    JSON.stringify({
      id:channelId,
      resourceId:watch.resourceId,
      expiration
    })
  );

  await redis(
    'SET',
    PAGE_TOKEN_KEY,
    pageToken
  );

  return {
    channelId,
    resourceId:watch.resourceId,
    expiration,
    pageToken
  };

}


export async function replaceWatchChannel(webhookUrl){

  const existing =
    await getStoredChannel();

  if(existing){

    const accessToken =
      await getAccessToken();

    await stopChannel(
      accessToken,
      existing
    );

  }

  return createWatchChannel(
    webhookUrl
  );

}
