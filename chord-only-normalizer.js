/*
 * Chord-only line normalizer
 *
 * Converts imported rows such as:
 *   ['A G A G', '']
 *   ['A – G – A – G – E7#9', '']
 * into individual chord rows so the existing renderer and transpose
 * engine receive real chord tokens instead of plain text.
 *
 * This is deliberately isolated from key detection and transpose logic.
 */
(function(){
  'use strict';

  const ROOT = '[A-G](?:#|b)?';
  const QUALITY = '(?:(?:maj|min|m|dim|aug|sus|add|no|omit)?(?:2|4|5|6|7|9|11|13)?(?:[#b](?:2|4|5|6|7|9|11|13))*)';
  const BASS = '(?:\\/' + ROOT + ')?';
  const CHORD_RE = new RegExp('^' + ROOT + QUALITY + BASS + '$');

  function cleanToken(token){
    return String(token || '')
      .replace(/&ndash;|&mdash;|&minus;/gi, '–')
      .replace(/[“”‘’]/g, '')
      .trim();
  }

  function isChord(token){
    const t = cleanToken(token);
    if(!t) return false;
    return CHORD_RE.test(t);
  }

  function splitChordLine(text){
    let s = String(text || '')
      .replace(/&ndash;|&mdash;|&minus;/gi, '–')
      .replace(/[−—–]/g, '-')
      .replace(/\s*-\s*/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if(!s) return [];

    const tokens = s.split(' ')
      .map(cleanToken)
      .filter(Boolean);

    return tokens.length && tokens.every(isChord) ? tokens : null;
  }

  function normalizeObject(obj){
    if(!obj || typeof obj !== 'object') return;

    Object.keys(obj).forEach(part => {
      if(!Array.isArray(obj[part])) return;

      const output = [];

      obj[part].forEach(row => {
        if(!Array.isArray(row)){
          output.push(row);
          return;
        }

        const chord = String(row[0] ?? '').trim();
        const lyric = String(row[1] ?? '').trim();

        // Never touch a lyric-bearing row. Existing chord+lyric behavior
        // is intentionally preserved.
        if(!lyric || !chord){
          const tokens = splitChordLine(chord);
          if(tokens && tokens.length){
            tokens.forEach(c => output.push([c, '']));
            return;
          }
        }

        output.push(row);
      });

      obj[part] = output;
    });
  }

  function normalize(){
    try{
      if(typeof base !== 'undefined') normalizeObject(base);
      if(typeof transposeSource !== 'undefined') normalizeObject(transposeSource);
    }catch(e){
      console.warn('Chord-only normalization skipped:', e);
    }
  }

  // Expose a small diagnostic API without touching transpose functions.
  window.WorshipChordOnlyNormalizer = {
    isChord,
    splitChordLine,
    normalize
  };

  // Imported/analyzed songs trigger this event. Delay one tick so the
  // existing importer/analyzer can finish populating base first.
  document.addEventListener('worshipchords:song-imported', () => {
    setTimeout(() => {
      normalize();
      if(typeof renderSong === 'function') renderSong();
    }, 0);
  });

  // Also normalize immediately after the script loads and wrap renderSong
  // so future renders (including transpose/save flows) keep chord-only rows
  // as individual chord records.
  setTimeout(() => {
    normalize();

    if(typeof window.renderSong === 'function' && !window.__chordOnlyRenderWrapped){
      const originalRenderSong = window.renderSong;
      window.renderSong = function(){
        normalize();
        return originalRenderSong.apply(this, arguments);
      };
      window.__chordOnlyRenderWrapped = true;
    }
  }, 0);
})();
