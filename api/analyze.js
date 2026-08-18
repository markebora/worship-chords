export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://markebora.github.io');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'AI analyzer is not configured yet. Add OPENAI_API_KEY to the Vercel project environment variables.' });
  }

  try {
    const { text, sourceUrl = '' } = req.body || {};
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Missing song text.' });
    }
    if (text.length > 30000) {
      return res.status(413).json({ error: 'Song text is too large. Please analyze a shorter chart.' });
    }

    const prompt = `You are a worship-song chord-chart analyzer. Analyze the supplied song chart and return ONLY valid JSON.

Rules:
- Identify title and artist when present.
- Identify the original key when explicitly stated; otherwise return null.
- Split the chart into ordered sections such as Intro, Verse 1, Pre-Chorus, Chorus, Bridge, Tag, Instrumental, Outro, Ending.
- Preserve lyric wording exactly as supplied.
- Identify every chord token, including sharps, flats, diminished, augmented, sus, add, extensions, alterations, slash chords and chord symbols.
- Never silently delete an unfamiliar chord. Keep its original spelling in `rawChord` and use `normalizedChord` only when you are confident.
- A slash chord has a chord root and a separate bass note. Example: G/B means root G and bass B.
- Do NOT transpose anything. Transposition is handled separately by the deterministic chord engine.
- Keep chord order and lyric/chord alignment.

JSON shape:
{
  "title": string|null,
  "artist": string|null,
  "key": string|null,
  "sections": [
    {
      "name": string,
      "lines": [
        {
          "lyrics": string,
          "chords": [
            {"rawChord": string, "normalizedChord": string|null, "root": string|null, "bass": string|null}
          ]
        }
      ]
    }
  ]
}

Source URL: ${sourceUrl}

SONG CHART:
${text}`;

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-5.6-luna',
        input: prompt,
        text: { format: { type: 'json_object' } }
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(502).json({ error: data?.error?.message || `AI provider returned HTTP ${response.status}.` });
    }

    const output = data.output_text;
    if (!output) return res.status(502).json({ error: 'AI provider returned no analysis.' });

    let analysis;
    try {
      analysis = JSON.parse(output);
    } catch (_) {
      return res.status(502).json({ error: 'AI provider returned invalid JSON.' });
    }

    return res.status(200).json({ analysis });
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'AI analysis failed.' });
  }
}
