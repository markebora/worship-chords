import webpush from 'web-push';
import { redis } from './kv.js';

const SUBSCRIPTIONS_KEY = 'push:subscriptions';

let configured = false;

function ensureConfigured(){

  if(configured)return;

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


export async function broadcastNotification(payload){

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
