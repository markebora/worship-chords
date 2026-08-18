export default async function handler(req, res) {
  // Allow GitHub Pages to call this Vercel API.
  res.setHeader(
    'Access-Control-Allow-Origin',
    'https://markebora.github.io'
  );
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  try {
    const { url } = req.body || {};

    if (!url) {
      return res.status(400).json({
        error: 'Missing Ultimate Guitar URL.'
      });
    }

    const target = new URL(url);

    if (!target.hostname.endsWith('ultimate-guitar.com')) {
      return res.status(400).json({
        error: 'Only Ultimate Guitar URLs are supported.'
      });
    }

    const response = await fetch(target.toString(), {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36',
        'Accept':
          'text/html,application/xhtml+xml,application/json'
      }
    });

    if (!response.ok) {
      return res.status(502).json({
        error: `Ultimate Guitar returned HTTP ${response.status}.`
      });
    }

    const html = await response.text();

    /*
     * Ultimate Guitar commonly stores tab/song information
     * inside JSON embedded in the page.
     */

    let extracted = '';

    // Look for JSON-LD / embedded page data.
    const patterns = [
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
      /window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});/gi,
      /window\.__NEXT_DATA__\s*=\s*({[\s\S]*?});/gi
    ];

    for (const pattern of patterns) {
      const match = pattern.exec(html);

      if (!match) continue;

      try {
        const json = JSON.parse(match[1]);

        extracted += '\n' + findSongText(json);
      } catch (e) {
        // Ignore invalid embedded JSON and continue.
      }
    }

    /*
     * Also search for common Ultimate Guitar content fields.
     */
    const fieldPatterns = [
      /"tab_view"\s*:\s*"([\s\S]*?)"/i,
      /"content"\s*:\s*"([\s\S]*?)"/i,
      /"songContent"\s*:\s*"([\s\S]*?)"/i,
      /"tabContent"\s*:\s*"([\s\S]*?)"/i
    ];

    for (const pattern of fieldPatterns) {
      const match = pattern.exec(html);

      if (match) {
        extracted += '\n' + decodeEscaped(match[1]);
      }
    }

    /*
     * Fallback: remove scripts/styles and extract visible text.
     */
    if (!extracted.trim()) {
      extracted = html
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
    }

    const text = cleanSongText(extracted);

    if (!text) {
      return res.status(422).json({
        error:
          'No readable song content was found. Ultimate Guitar may have changed its page structure.'
      });
    }

    return res.status(200).json({
      sourceUrl: target.toString(),
      text
    });

  } catch (error) {
    return res.status(500).json({
      error: error?.message || 'Importer failed.'
    });
  }
}


/*
 * Recursively search embedded JSON for useful song/tab text.
 */
function findSongText(value) {
  if (!value) return '';

  if (typeof value === 'string') {
    const decoded = decodeEscaped(value);

    // Keep strings that look like actual song/chord content.
    if (
      decoded.length > 40 &&
      (
        /[A-G](?:#|b)?(?:m|maj|min|dim|aug|sus|add)?\d*(?:\/[A-G](?:#|b)?)?/i.test(decoded) ||
        /\b(verse|chorus|bridge|intro|outro)\b/i.test(decoded)
      )
    ) {
      return decoded;
    }

    return '';
  }

  if (Array.isArray(value)) {
    return value.map(findSongText).join('\n');
  }

  if (typeof value === 'object') {
    return Object.values(value)
      .map(findSongText)
      .join('\n');
  }

  return '';
}


/*
 * Decode JSON escaped strings.
 */
function decodeEscaped(value) {
  return value
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '')
    .replace(/\\t/g, '\t')
    .replace(/\\\\/g, '\\')
    .replace(/\\u0026/g, '&')
    .replace(/\\u003c/g, '<')
    .replace(/\\u003e/g, '>');
}


/*
 * Clean the extracted song content.
 */
function cleanSongText(text) {
  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
