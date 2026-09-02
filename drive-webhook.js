import { getAccessToken, listChanges } from './_lib/drive.js';
import { redis } from './_lib/kv.js';
import { broadcastNotification } from './_lib/push.js';

const PAGE_TOKEN_KEY = 'drive:pageToken';
const SEEN_FILES_KEY = 'drive:seenFileIds';

export default async function handler(req, res){

  if(req.method !== 'POST'){

    return res.status(405).end();

  }

  const channelToken =
    req.headers['x-goog-channel-token'];

  if(
    !process.env.DRIVE_WEBHOOK_SECRET ||
    channelToken !== process.env.DRIVE_WEBHOOK_SECRET
  ){

    /*
      Wrong/missing token — not a real Drive notification.
      Respond 401 without doing any work.
    */

    return res.status(401).end();

  }

  const resourceState =
    req.headers['x-goog-resource-state'];

  /*
    Google expects a fast 2xx response (a few seconds). Respond
    immediately, then keep working — Vercel keeps the function
    running until the handler's promise settles, even though
    the response already went out.
  */

  res.status(200).end();

  if(resourceState === 'sync'){

    /* Initial handshake when the channel is first created — no changes yet. */

    return;

  }

  try{

    await processChanges();

  }catch(error){

    console.error(
      'drive-webhook processing failed:',
      error
    );

  }

}


async function processChanges(){

  const folderId =
    process.env.GOOGLE_DRIVE_FOLDER_ID;

  const pageToken =
    await redis('GET', PAGE_TOKEN_KEY);

  if(!pageToken){

    /* Watch channel hasn't been set up via /api/drive-watch-setup yet. */

    return;

  }

  const accessToken =
    await getAccessToken();

  const data =
    await listChanges(accessToken, pageToken);

  const newFiles = [];

  for(const change of (data.changes || [])){

    if(change.removed)continue;

    const file = change.file;

    if(!file || file.trashed)continue;
    if(file.mimeType === 'application/vnd.google-apps.folder')continue;
    if(!file.parents || !file.parents.includes(folderId))continue;

    const alreadySeen =
      await redis('SISMEMBER', SEEN_FILES_KEY, file.id);

    if(alreadySeen)continue;

    await redis('SADD', SEEN_FILES_KEY, file.id);

    newFiles.push(file);

  }

  /*
    Advance the page token even if nothing in this batch was
    relevant — otherwise the next webhook call re-scans the
    same (growing) range of changes forever.
  */

  if(data.newStartPageToken){

    await redis(
      'SET',
      PAGE_TOKEN_KEY,
      data.newStartPageToken
    );

  }

  for(const file of newFiles){

    await broadcastNotification({

      title:'New song added',
      body:file.name,
      url:'/',
      tag:'drive-song-' + file.id

    });

  }

}
