export default async function handler(req, res) {
  // Allow the GitHub Pages frontend to call this Vercel API.
  res.setHeader('Access-Control-Allow-Origin', 'https://markebora.github.io');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const { url } = req.body || {};
    if (!url) return res.status(400).json({ error: 'Missing Ultimate Guitar URL.' });

    const target = new URL(url);
    if (!target.hostname.endsWith('ultimate-guitar.com')) {
      return res.status(400).json({ error: 'Only Ultimate Guitar URLs are supported.' });
    }

    const response = await fetch(target.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WorshipChordsImporter/1.0)',
        'Accept': 'text/html,application/xhtml+xml'
      }
    });

    if (!response.ok) {
      return res.status(502).json({ error: `Ultimate Guitar returned HTTP ${response.status}.` });
    }

    const html = await response.text();

    let text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>|<\/div>|<\/li>|<\/tr>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&#x27;/gi, "'")
      .replace(/\r/g, '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (!text) return res.status(422).json({ error: 'No readable page text was found. Ultimate Guitar may have blocked the request or changed its page structure.' });

    return res.status(200).json({ sourceUrl: target.toString(), text });
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Importer failed.' });
  }
}
