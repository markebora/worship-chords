/* Focused analyzer layer
   Fixes chord-only progressions in Intro, Interlude, Instrumental,
   Adlib/Ad-lib, and Outro without touching key/transpose logic.
*/
(function(){
  'use strict';

  const FOCUSED = /^(intro|interlude|instrumental|ad[- ]?lib|adlib|outro)$/i;
  const SECTION = /^(intro|verse(?:\s*\d+)?|pre[- ]?chorus|chorus|bridge|tag|ad[- ]?lib|adlib|interlude|instrumental|outro)$/i;

  function chordToken(value){
    const s = String(value || '').trim();
    if(!s) return false;
    return /^[A-G](?:#|b)?(?:maj|min|m|dim|aug|sus|add|no|omit)?(?:\d+)?(?:(?:#|b)(?:5|9|11|13))?(?:sus(?:2|4))?(?:\/[A-G](?:#|b)?)?$/.test(s);
  }

  function normalizeSeparators(line){
    return String(line || '')
      .replace(/&ndash;|&#8211;|&mdash;|&#8212;/gi, ' ')
      .replace(/[–—−]/g, ' ')
      .replace(/\s+-\s+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  function chordSequence(line){
    const cleaned = normalizeSeparators(line);
    if(!cleaned) return null;
    const tokens = cleaned.split(/\s+/).filter(Boolean);
    if(!tokens.length) return null;
    if(tokens.every(chordToken)) return tokens;
    return null;
  }

  function titleCaseSection(marker){
    const m = marker.toLowerCase();
    if(/^verse$/.test(m)) return 'Verse 1';
    if(/^pre[- ]?chorus$/.test(m)) return 'Pre-Chorus';
    if(/^ad[- ]?lib$/.test(m)) return 'Adlib';
    if(/^intro$/.test(m)) return 'Intro';
    if(/^interlude$/.test(m)) return 'Interlude';
    if(/^instrumental$/.test(m)) return 'Instrumental';
    if(/^outro$/.test(m)) return 'Outro';
    if(/^chorus$/.test(m)) return 'Chorus';
    if(/^bridge$/.test(m)) return 'Bridge';
    if(/^tag$/.test(m)) return 'Tag';
    return marker.replace(/^./, c => c.toUpperCase());
  }

  function analyzeSongFocused(){
    const title = (document.getElementById('importTitle')?.value || '').trim() || 'Imported Song';
    const artist = (document.getElementById('importArtist')?.value || '').trim() || 'Unknown Artist';
    const text = (document.getElementById('songText')?.value || '').trim();
    const result = document.getElementById('analysisResult');

    if(!text){
      if(result) result.innerHTML = '<div class="card">Paste lyrics/chords first.</div>';
      return;
    }

    const lines = text.split(/\r?\n/);
    const sections = [];
    let current = 'Verse 1';
    let bucket = [];

    function flush(){
      if(bucket.length){
        base[current] = bucket;
        if(!sections.includes(current)) sections.push(current);
        bucket = [];
      }
    }

    for(const raw of lines){
      const line = String(raw || '').replace(/\t/g, ' ').trim();
      if(!line) continue;

      const marker = line.replace(/^\[|\]$/g,'').replace(/:$/,'').trim();
      if(SECTION.test(marker)){
        flush();
        current = titleCaseSection(marker);
        if(!Array.isArray(base[current])) base[current] = [];
        continue;
      }

      const focused = FOCUSED.test(current);
      const sequence = chordSequence(line);

      /* In chord-focused sections, a pure chord sequence is ALWAYS
         stored as chord data, never as lyric text. */
      if(sequence){
        if(focused){
          bucket.push([sequence.join(' '), '']);
          continue;
        }
        /* Also recognize pure chord-only lines in normal sections. */
        bucket.push([sequence.join(' '), '']);
        continue;
      }

      /* Preserve the existing simple chord + lyric behavior. */
      const m = line.match(/^([A-G](?:#|b)?(?:maj|min|m|dim|aug|sus|add|no|omit)?(?:\d+)?(?:(?:#|b)(?:5|9|11|13))?(?:sus(?:2|4))?(?:\/[A-G](?:#|b)?)?)(?:\s+|$)/i);
      const chord = m ? m[1] : '';
      bucket.push([chord, chord ? line.slice(chord.length).trim() : line]);
    }

    flush();

    if(!sections.length){
      base['Verse 1'] = lines.filter(Boolean).map(x => ['', String(x).trim()]);
      sections.push('Verse 1');
    }

    arrangement = sections;
    activeSection = arrangement[0] || '';
    currentSongTitle = title;
    currentArtist = artist;
    currentKey = detectKey();
    transposeSource = JSON.parse(JSON.stringify(base));

    if(result){
      result.innerHTML = `
        <div class="card">
          <b>Detected structure</b>
          <div class="muted" style="margin:7px 0 12px">
            ${sections.length} sections • ${sections.map(esc).join(' • ')}
          </div>
          <button type="button" class="btn primary" style="width:100%" onclick="finishImport()">
            ✓ Open Analyzed Song
          </button>
        </div>
      `;
    }
  }

  /* Replace only the analyzer entry point. Key/transpose functions are untouched. */
  window.analyzeSong = analyzeSongFocused;
})();
