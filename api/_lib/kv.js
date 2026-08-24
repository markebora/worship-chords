/*
  Minimal Upstash Redis client using its REST API directly —
  no SDK dependency. Every Redis command is just a POST with
  a JSON array like ["HSET", key, field, value].

  Vercel's Upstash integration prefixes env var names with your
  project name (e.g. disciples_KV_REST_API_URL) rather than the
  plain UPSTASH_REDIS_REST_URL Upstash itself uses — this checks
  both so it works regardless of which one actually got created.
*/

function firstDefined(...names){

  for(const name of names){

    if(process.env[name]){

      return process.env[name];

    }

  }

  return undefined;

}

export async function redis(...command) {

  const baseUrl =
    firstDefined(
      'UPSTASH_REDIS_REST_URL',
      'disciples_KV_REST_API_URL'
    );

  const token =
    firstDefined(
      'UPSTASH_REDIS_REST_TOKEN',
      'disciples_KV_REST_API_TOKEN'
    );

  if (!baseUrl || !token) {
    throw new Error(
      'Upstash Redis env vars are not set (checked UPSTASH_REDIS_REST_URL/TOKEN and disciples_KV_REST_API_URL/TOKEN).'
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

