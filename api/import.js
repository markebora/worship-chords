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

    // Ultimate Guitar stores the song in a .js-store element.
    // The chord sheet is normally at:
    // store.page.data.tab_view.wiki_tab.content
    const storeObjects = extractJsStoreObjects(html);
    const candidates = [];

    for (const store of storeObjects) {
      const content = store?.store?.page?.data?.tab_view?.wiki_tab?.content;
      if (typeof content === 'string' && content.trim()) {
        candidates.push(content);
      }
    }

    // Fallback for slight variations in the embedded object structure.
    if (!candidates.length) {
      for (const store of storeObjects) {
        const content = findWikiTabContent(store);
        if (content) candidates.push(content);
      }
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

function extractJsStoreObjects(html) {
  const results = [];

  // data-content contains the JSON-encoded page state.
  const patterns = [
    /<[^>]*class=["'][^"']*js-store[^"']*["'][^>]*data-content=["']([\s\S]*?)["'][^>]*>/gi,
    /<[^>]*data-content=["']([\s\S]*?)["'][^>]*class=["'][^"']*js-store[^"']*["'][^>]*>/gi
  ];

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const decoded = decodeHtmlEntities(match[1]);
      try {
        results.push(JSON.parse(decoded));
      } catch {
        try {
          results.push(JSON.parse(decoded.replace(/\\"/g, '"')));
        } catch {
          // Ignore malformed candidates.
        }
      }
    }
  }

  return results;
}

function findWikiTabContent(value) {
  if (!value || typeof value !== 'object') return '';

  if (typeof value.content === 'string' && looksLikeSongContent(value.content)) {
    return value.content;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findWikiTabContent(item);
      if (found) return found;
    }
    return '';
  }

  for (const child of Object.values(value)) {
    const found = findWikiTabContent(child);
    if (found) return found;
  }

  return '';
}

function looksLikeSongContent(value) {
  if (!value || value.length < 40) return false;
  if (/https?:\/\//i.test(value)) return false;
  if (/ultimate-guitar\.com\/u\//i.test(value)) return false;

  const section = /\[(?:intro|verse|pre[- ]?chorus|chorus|bridge|outro|interlude|solo|instrumental)[^\]]*\]/i;
  const chord = /\[ch\][\s\S]*?\[\/ch\]/i;
  const plainChord = /\b[A-G](?:#|b)?(?:m|min|maj|dim|aug|sus|add)?\d*(?:\/[A-G](?:#|b)?)?\b/;

  return section.test(value) && (chord.test(value) || plainChord.test(value));
}

function chooseBestCandidate(candidates) {
  const unique = [...new Set(candidates.map(cleanSongText).filter(Boolean))];
  if (!unique.length) return '';
  unique.sort((a, b) => scoreCandidate(b) - scoreCandidate(a));
  return unique[0];
}

function scoreCandidate(value) {
  const lines = value.split('\n').length;
  const chords = (value.match(/\[ch\][\s\S]*?\[\/ch\]/gi) || []).length;
  const sections = (value.match(/\[[^\]]*(?:intro|verse|pre[- ]?chorus|chorus|bridge|outro|interlude|solo)[^\]]*\]/gi) || []).length;
  return Math.min(value.length, 20000) + lines * 50 + chords * 25 + sections * 200;
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
    .replace(/<[^>]+>/g, '')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
