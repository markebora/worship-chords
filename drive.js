/*
  Google Drive access via plain REST + fetch — no googleapis
  dependency. Uses a stored refresh token (obtained once,
  manually, from the Google account that owns the songs
  folder) to mint short-lived access tokens on demand.

  Needs these env vars:

    GOOGLE_CLIENT_ID
    GOOGLE_CLIENT_SECRET
    GOOGLE_REFRESH_TOKEN
    GOOGLE_DRIVE_FOLDER_ID     (the songs folder to watch)
*/

export async function getAccessToken(){

  const params =
    new URLSearchParams({

      client_id:
        process.env.GOOGLE_CLIENT_ID,

      client_secret:
        process.env.GOOGLE_CLIENT_SECRET,

      refresh_token:
        process.env.GOOGLE_REFRESH_TOKEN,

      grant_type:
        'refresh_token'

    });

  const response =
    await fetch(
      'https://oauth2.googleapis.com/token',
      {

        method:'POST',

        headers:{
          'Content-Type':
            'application/x-www-form-urlencoded'
        },

        body:
          params.toString()

      }
    );

  const data =
    await response.json();

  if(!response.ok){

    throw new Error(

      'Google token refresh failed: ' +
      (data.error_description || data.error || response.status)

    );

  }

  return data.access_token;

}


export async function driveFetch(path, accessToken, options={}){

  const response =
    await fetch(
      `https://www.googleapis.com/drive/v3/${path}`,
      {

        ...options,

        headers:{

          Authorization:
            `Bearer ${accessToken}`,

          'Content-Type':
            'application/json',

          ...(options.headers || {})

        }

      }
    );

  const data =
    await response.json()
      .catch(() => ({}));

  if(!response.ok){

    throw new Error(

      `Drive API ${path} failed: ` +
      (data.error?.message || response.status)

    );

  }

  return data;

}


export async function getStartPageToken(accessToken){

  const data =
    await driveFetch(
      'changes/startPageToken?supportsAllDrives=true',
      accessToken
    );

  return data.startPageToken;

}


export async function watchChanges(
  accessToken,
  { channelId, webhookUrl, channelToken, pageToken, expirationMs }
){

  return driveFetch(
    `changes/watch?pageToken=${encodeURIComponent(pageToken)}&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    accessToken,
    {

      method:'POST',

      body:
        JSON.stringify({

          id:channelId,
          type:'web_hook',
          address:webhookUrl,
          token:channelToken,
          expiration:String(expirationMs)

        })

    }
  );

}


export async function stopChannel(accessToken, { channelId, resourceId }){

  try{

    await driveFetch(
      'channels/stop',
      accessToken,
      {

        method:'POST',

        body:
          JSON.stringify({
            id:channelId,
            resourceId
          })

      }
    );

  }catch(error){

    /*
      Stopping an already-expired/unknown channel returns an
      error from Google — harmless, we're replacing it anyway.
    */

    console.warn(
      'stopChannel (non-fatal):',
      error.message
    );

  }

}


export async function listChanges(accessToken, pageToken){

  const fields =
    'newStartPageToken,nextPageToken,' +
    'changes(fileId,removed,file(id,name,parents,mimeType,trashed,createdTime,webViewLink))';

  return driveFetch(
    `changes?pageToken=${encodeURIComponent(pageToken)}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=${encodeURIComponent(fields)}`,
    accessToken
  );

}
