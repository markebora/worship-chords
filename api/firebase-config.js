/*
  Serves the Firebase web config to index.html at runtime instead
  of it being hardcoded in that file's source — see the FIREBASE
  CLIENT comment near the top of index.html for the full context.

  Requires these environment variables to be set in Vercel →
  Project → Settings → Environment Variables (copy the values
  from Firebase Console → Project settings → General → "Your
  apps" → SDK setup and configuration → Config):

    FIREBASE_API_KEY
    FIREBASE_AUTH_DOMAIN
    FIREBASE_PROJECT_ID
    FIREBASE_STORAGE_BUCKET
    FIREBASE_MESSAGING_SENDER_ID
    FIREBASE_APP_ID

  Note: this keeps the config out of the repo's source code, but
  it's still visible to anyone using the app (any signed-in
  browser has to receive it to talk to Firebase at all — that's
  normal and expected). Firebase's own docs say the apiKey isn't
  meant to be a secret; what actually gates access is Firestore
  Security Rules (see firestore.rules), never this value.
*/

export default async function handler(req, res){

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if(req.method === 'OPTIONS')return res.status(204).end();

  if(req.method !== 'GET'){

    return res.status(405).json({
      error:'GET only'
    });

  }

  const firebaseConfig = {

    apiKey: process.env.FIREBASE_API_KEY || '',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.FIREBASE_APP_ID || ''

  };

  if(!firebaseConfig.apiKey || !firebaseConfig.projectId){

    return res.status(500).json({
      error:'Firebase environment variables are not set on the server.'
    });

  }

  return res.status(200).json(firebaseConfig);

}
