/*
  Minimal Upstash Redis client using its REST API directly —
  no SDK dependency. Every Redis command is just a POST with
  a JSON array like ["HSET", key, field, value].

  Needs two env vars (from the Upstash dashboard, or the
  Vercel Marketplace "Upstash" integration):

    UPSTASH_REDIS_REST_URL
    UPSTASH_REDIS_REST_TOKEN
*/

export async function redis(...command) {

  const baseUrl =
    process.env.UPSTASH_REDIS_REST_URL;

  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!baseUrl || !token) {
    throw new Error(
      'Upstash Redis env vars (UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN) are not set.'
    );
  }

  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(command)
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(`Redis error on ${command[0]}: ${data.error}`);
  }

  return data.result;

}
