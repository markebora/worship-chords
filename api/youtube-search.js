/*
  api/youtube-search.js

  Proxies YouTube Data API search requests so the API key never
  ships to the browser or sits in the repo. The client (see
  searchYouTube() in index.html) calls this with just a query
  string; this holds the real key (as a Vercel env var) and
  forwards the request to Google.

  Requires a YOUTUBE_API_KEY environment variable — Vercel
  Project → Settings → Environment Variables. Get a key at
  https://console.cloud.google.com → APIs & Services → Credentials
  (enable "YouTube Data API v3" first). Since this now runs
  server-side, set Application restrictions to "None" on the key
  (there's no browser referrer to restrict by from here) — keep
  API restrictions limited to YouTube Data API v3 as the safety net.
*/

export default async function handler(req, res){

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if(req.method === 'OPTIONS')return res.status(204).end();

  const query = req.query.q;

  if(!query){

    return res.status(400).json({
      error:'Missing q parameter'
    });

  }

  if(!process.env.YOUTUBE_API_KEY){

    return res.status(500).json({
      error:'YOUTUBE_API_KEY is not configured on the server'
    });

  }

  try{

    const url =
      'https://www.googleapis.com/youtube/v3/search' +
      '?part=snippet&type=video&maxResults=8&q=' +
      encodeURIComponent(query) +
      '&key=' + process.env.YOUTUBE_API_KEY;

    const googleResponse = await fetch(url);
    const data = await googleResponse.json();

    if(!googleResponse.ok){

      return res.status(googleResponse.status).json({
        error: (data && data.error && data.error.message) || 'YouTube search failed'
      });

    }

    // Cache briefly — search terms repeat often within a session
    // and this cuts into your free daily quota (10,000 units/day,
    // 100 per search).
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');

    return res.status(200).json(data);

  }catch(error){

    console.error(
      'youtube-search failed:',
      error
    );

    return res.status(500).json({
      error: error.message || 'YouTube search failed.'
    });

  }

}
