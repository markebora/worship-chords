/*
  api/youtube-search.js

  Proxies YouTube Data API search requests so the API key never
  ships to the browser or sits in the repo. The client calls this
  with just a query string; this holds the real key (as a Vercel
  env var) and forwards the request to Google.

  Requires a YOUTUBE_API_KEY environment variable — Vercel
  Project → Settings → Environment Variables. Get a key at
  https://console.cloud.google.com → APIs & Services → Credentials
  (enable "YouTube Data API v3" first). Restrict the key to that
  one API — cheap extra safety even though it's server-side only now.
*/

module.exports = async function handler(req, res) {

  const query = req.query.q;

  if (!query) {
    res.status(400).json({ error: 'Missing q parameter' });
    return;
  }

  if (!process.env.YOUTUBE_API_KEY) {
    res.status(500).json({ error: 'YOUTUBE_API_KEY is not configured on the server' });
    return;
  }

  try {

    const url =
      'https://www.googleapis.com/youtube/v3/search' +
      '?part=snippet&type=video&maxResults=8&q=' +
      encodeURIComponent(query) +
      '&key=' + process.env.YOUTUBE_API_KEY;

    const googleResponse = await fetch(url);
    const data = await googleResponse.json();

    if (!googleResponse.ok) {
      res.status(googleResponse.status).json({
        error: (data && data.error && data.error.message) || 'YouTube search failed'
      });
      return;
    }

    // Cache briefly — search terms repeat often within a session
    // and this cuts into your free daily quota (10,000 units/day,
    // 100 per search).
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    res.status(200).json(data);

  } catch (error) {

    console.error('youtube-search failed:', error);
    res.status(500).json({ error: error.message });

  }

};
