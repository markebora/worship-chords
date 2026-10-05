import webpush from 'web-push';
import { redis } from './kv.js';

const SUBSCRIPTIONS_KEY = 'push:subscriptions';

let configured = false;

function ensureConfigured(){

  if(configured)return;

  if(!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY){

    throw new Error('VAPID keys are not set.');

  }

  webpush.setVapidDetails(

    process.env.VAPID_SUBJECT ||
    'mailto:admin@example.com',

    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY

  );

  configured = true;

}


export async function saveSubscription(subscription){

  if(!subscription?.endpoint){

    throw new Error(
      'Invalid push subscription.'
    );

  }

  await redis(
    'HSET',
    SUBSCRIPTIONS_KEY,
    subscription.endpoint,
    JSON.stringify(subscription)
  );

}


export async function removeSubscription(endpoint){

  await redis(
    'HDEL',
    SUBSCRIPTIONS_KEY,
    endpoint
  );

}


export async function getAllSubscriptions(){

  const flat =
    await redis(
      'HGETALL',
      SUBSCRIPTIONS_KEY
    ) || [];

  const subscriptions = [];

  /* HGETALL returns a flat [field,value,field,value,...] array. */

  for(let i = 0; i < flat.length; i += 2){

    try{

      subscriptions.push(
        JSON.parse(flat[i + 1])
      );

    }catch{

      /* Skip a corrupted entry rather than fail the whole batch. */

    }

  }

  return subscriptions;

}


async function broadcastWebPush(payload){

  ensureConfigured();

  const subscriptions =
    await getAllSubscriptions();

  const body =
    JSON.stringify(payload);

  const results =
    await Promise.allSettled(

      subscriptions.map(subscription =>

        webpush.sendNotification(
          subscription,
          body
        )

      )

    );

  /*
    A 404/410 response means the browser/OS has invalidated
    that subscription (uninstalled, permission revoked, etc).
    Prune it so future sends don't keep failing on it.
  */

  await Promise.all(

    results.map((result, index) => {

      if(result.status !== 'rejected'){

        return null;

      }

      const statusCode =
        result.reason?.statusCode;

      if(statusCode === 404 || statusCode === 410){

        return removeSubscription(
          subscriptions[index].endpoint
        );

      }

      console.warn(
        'Push send failed:',
        result.reason?.message || result.reason
      );

      return null;

    })

  );

  return {

    sent:
      results.filter(r => r.status === 'fulfilled').length,

    total:
      subscriptions.length

  };

}


/* =========================================================
   NATIVE APP PUSH (Firebase Cloud Messaging)

   The Capacitor Android app can't use Web Push; it registers an
   FCM token instead. Tokens live in their own Redis hash, and
   broadcastNotification() below sends to BOTH kinds of devices.

   Needs one extra Vercel env var:
     FIREBASE_SERVICE_ACCOUNT_KEY  the full service-account JSON
       (Firebase Console → Project settings → Service accounts →
       Generate new private key) — the same JSON the GitHub
       reminders workflow already uses.
========================================================= */

const FCM_TOKENS_KEY = 'push:fcmTokens';

const FCM_CHANNEL_ID = 'disciples-updates';

export async function saveFcmToken(token){

  if(typeof token !== 'string' || token.length < 20){

    throw new Error('Invalid push token.');

  }

  await redis(
    'HSET',
    FCM_TOKENS_KEY,
    token,
    JSON.stringify({ token, savedAt: Date.now() })
  );

}

export async function removeFcmToken(token){

  await redis(
    'HDEL',
    FCM_TOKENS_KEY,
    token
  );

}

async function getAllFcmTokens(){

  return (await redis('HKEYS', FCM_TOKENS_KEY)) || [];

}

let fcmMessaging = null;

async function getFcmMessaging(){

  if(fcmMessaging)return fcmMessaging;

  if(!process.env.FIREBASE_SERVICE_ACCOUNT_KEY)return null;

  /* Loaded lazily so browser-only pushes never pay for it. */
  const { initializeApp, cert, getApps } =
    await import('firebase-admin/app');

  const { getMessaging } =
    await import('firebase-admin/messaging');

  const app =
    getApps()[0] ||
    initializeApp({
      credential: cert(
        JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
      )
    });

  fcmMessaging = getMessaging(app);

  return fcmMessaging;

}

async function broadcastFcm(payload){

  const tokens =
    await getAllFcmTokens();

  if(!tokens.length)return { sent:0, total:0 };

  const messaging =
    await getFcmMessaging();

  if(!messaging){

    console.warn('FCM skipped: FIREBASE_SERVICE_ACCOUNT_KEY is not set.');

    return { sent:0, total:tokens.length };

  }

  let sent = 0;

  for(let i = 0; i < tokens.length; i += 500){

    const batch =
      tokens.slice(i, i + 500);

    const androidNotification = {
      channelId: FCM_CHANNEL_ID
    };

    if(payload.tag)androidNotification.tag = String(payload.tag);

    const response =
      await messaging.sendEachForMulticast({

        tokens: batch,

        notification: {
          title: payload.title || 'Disciples',
          body: payload.body || ''
        },

        data: {
          url: String(payload.url || '/'),
          tag: String(payload.tag || '')
        },

        android: {
          priority: 'high',
          notification: androidNotification
        }

      });

    sent += response.successCount;

    /* Prune tokens Google says are dead (app uninstalled, etc). */
    await Promise.all(

      response.responses.map((result, index) => {

        if(result.success)return null;

        const code =
          result.error && result.error.code;

        if(
          code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token'
        ){

          return removeFcmToken(batch[index]);

        }

        console.warn(
          'FCM send failed:',
          (result.error && result.error.message) || code
        );

        return null;

      })

    );

  }

  return { sent, total: tokens.length };

}

export async function broadcastNotification(payload){

  const [web, fcm] =
    await Promise.all([

      broadcastWebPush(payload).catch(error => {

        console.warn('Web push skipped:', error.message);

        return { sent:0, total:0 };

      }),

      broadcastFcm(payload).catch(error => {

        console.error('FCM broadcast failed:', error);

        return { sent:0, total:0 };

      })

    ]);

  return {
    sent: web.sent + fcm.sent,
    total: web.total + fcm.total,
    web,
    fcm
  };

}


/*
  Sends ONE test push to a single device and reports exactly what
  Firebase answered. Used by the "Send test" button in the app's
  Profile → Notifications, so a failure names its cause (wrong
  project, FCM API off, bad key...) instead of failing silently.
*/
export async function sendFcmTest(token){

  let serverProject = '';

  try{

    serverProject =
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}').project_id || '';

  }catch(error){

    return {
      ok:false,
      code:'bad-service-account-json',
      message:'FIREBASE_SERVICE_ACCOUNT_KEY on Vercel is not valid JSON. Paste the whole key file again.'
    };

  }

  if(!process.env.FIREBASE_SERVICE_ACCOUNT_KEY){

    return {
      ok:false,
      code:'no-service-account',
      message:'FIREBASE_SERVICE_ACCOUNT_KEY is not set on Vercel (or Vercel has not redeployed since you added it).'
    };

  }

  try{

    const messaging =
      await getFcmMessaging();

    await messaging.send({

      token,

      notification: {
        title: 'Disciples',
        body: 'Test notification — it works!'
      },

      data: { url:'/', tag:'test' },

      android: {
        priority:'high',
        notification: { channelId: FCM_CHANNEL_ID }
      }

    });

    return { ok:true, serverProject };

  }catch(error){

    return {
      ok:false,
      code: error.code || 'unknown',
      message: String(error.message || error).slice(0, 300),
      serverProject
    };

  }

}
