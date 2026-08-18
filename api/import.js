export default async function handler(req, res) {
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/json'
      }
    });

    if (!response.ok) {
      return res.status(502).json({ error: `Ultimate Guitar returned HTTP ${response.status}.` });
    }

    const html = await response.text();

    // Prefer fields that are likely to contain the actual tab/chord body.
    // Do not recursively collect arbitrary page strings: that also captures
    // user profiles, comments, image URLs and navigation links.
    const candidates = [];

    const directPatterns = [
      /"content"\s*:\s*"((?:\\.|[^"\\])*)"/gi,
      /"tab_view"\s*:\s*"((?:\\.|[^"\\])*)"/gi,
      /"tabContent"\s*:\s*"((?:\\.|[^"\\])*)"/gi,
      /"songContent"\s*:\s*"((?:\\.|[^"\\])*)"/gi,
      /data-content=["']([^"']+)["']/gi
    ];

    for (const pattern of directPatterns) {
      for (const match of html.matchAll(pattern)) {
        const value = decodeHtmlEntities(decodeEscaped(match[1]));
        if (looksLikeSongContent(value)) candidates.push(value);
      }
    }

    // Some pages put the tab in a JSON object under a script element.
    const scriptBlocks = html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi);
    for (const block of scriptBlocks) {
      const script = block[1];
      if (!/tab_view|tabContent|songContent|content/i.test(script)) continue;

      for (const pattern of directPatterns.slice(0, 4)) {
        for (const match of script.matchAll(pattern)) {
          const value = decodeHtmlEntities(decodeEscaped(match[1]));
          if (looksLikeSongContent(value)) candidates.push(value);
        }
      }
    }

    // Last-resort visible-text fallback, but remove navigation/comments/URLs.
    if (!candidates.length) {
      const visible = html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>|<\/div>|<\/li>|<\/tr>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\r/g, '');

      const filtered = visible
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !/^https?:\/\//i.test(line))
        .filter(line => !/ultimate-guitar\.com\/u\//i.test(line))
        .filter(line => !/static\/users\//i.test(line))
        .join('\n');

      if (looksLikeSongContent(filtered)) candidates.push(filtered);
    }

    const text = chooseBestCandidate(candidates);

    if (!text) {
      return res.status(422).json({
        error: 'Could not locate the actual song/chord content in the Ultimate Guitar page. The page structure may have changed.'
      });
    }

    return res.status(200).json({
      sourceUrl: target.toString(),
      text
    });
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Importer failed.' });
  }
}

function looksLikeSongContent(value) {
  if (!value || value.length < 60) return false;

  // Reject obvious non-song material.
  if (/https?:\/\//i.test(value)) return false;
  if (/ultimate-guitar\.com\/u\//i.test(value)) return false;
  if (/static\/users\//i.test(value)) return false;

  const chord = /\b[A-G](?:#|b)?(?:m|min|maj|dim|aug|sus|add)?\d*(?:\/[A-G](?:#|b)?)?\b/;
  const section = /\b(?:intro|verse|pre[- ]?chorus|chorus|bridge|outro|interlude)\b/i;

  return chord.test(value) && (section.test(value) || value.split('\n').length >= 4);
}

function chooseBestCandidate(candidates) {
  const unique = [...new Set(candidates.map(cleanSongText).filter(Boolean))];
  if (!unique.length) return '';

  // Prefer a substantial candidate with multiple lines and chord/section data.
  unique.sort((a, b) => scoreCandidate(b) - scoreCandidate(a));
  return unique[0];
}

function scoreCandidate(value) {
  const lines = value.split('\n').length;
  const chords = (value.match(/\b[A-G](?:#|b)?(?:m|min|maj|dim|aug|sus|add)?\d*(?:\/[A-G](?:#|b)?)?\b/g) || []).length;
  const sections = (value.match(/\b(?:intro|verse|pre[- ]?chorus|chorus|bridge|outro|interlude)\b/gi) || []).length;
  return Math.min(value.length, 20000) + lines * 50 + chords * 25 + sections * 200;
}

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

function decodeHtmlEntities(value) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function cleanSongText(text) {
  return decodeHtmlEntities(text)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
