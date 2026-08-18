(function(){
  'use strict';

  const originalOpenSearch = window.openSearch;
  const originalAnalyzeSong = window.analyzeSong;

  /* =========================================================
     CHORD BANK / MUSIC-THEORY REFERENCE
     =========================================================
     The transposer works on the ROOT of a chord and preserves
     its quality/suffix. This bank documents the chord qualities
     we explicitly recognize in the app.

     It intentionally accepts additional suffixes too, so a chord
     such as Fdim, Fdim7, C#m7, G#maj7, Bbadd9, or Dsus4 is not
     silently skipped just because a new extension appears.
  ========================================================= */
  const CHORD_BANK = {
    triads: ['', 'm', 'dim', 'aug'],
    sevenths: ['7', 'maj7', 'm7', 'min7', 'dim7', 'mMaj7', 'maj7#5', 'aug7'],
    extensions: ['6', 'm6', '9', 'm9', 'maj9', '11', 'm11', '13', 'm13'],
    suspended: ['sus2', 'sus4', '7sus4'],
    added: ['add2', 'add4', 'add9', 'add11', 'add13'],
    alterations: ['5', 'b5', '#5', 'b9', '#9', '#11', 'b13'],
    symbols: ['M', 'min', 'maj', '°', 'ø', '+', '-']
  };

  const CHORD_ROOT_PITCH = {
    C:0, 'C#':1, Db:1, D:2, 'D#':3, Eb:3,
    E:4, F:5, 'F#':6, Gb:6, G:7, 'G#':8,
    Ab:8, A:9, 'A#':10, Bb:10, B:11
  };

  // Common key spellings. The target key controls whether the
  // black-key roots are displayed with sharps or flats.
  const KEY_SPELLINGS = {
    C:  ['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'],
    'C#':['C#','D','D#','E','F','F#','G','G#','A','A#','B','C'],
    Db: ['Db','Eb','E','Gb','Ab','A','Bb','B','Db','D','Eb','F','Gb'],
    D:  ['D','Eb','E','F','F#','G','Ab','A','Bb','B','C','C#'],
    Eb: ['Eb','F','G','Ab','Bb','C','D','Eb','F','G','Ab','Bb'],
    E:  ['E','F#','G#','A','B','C#','D#','E','F#','G#','A','B'],
    F:  ['F','G','A','Bb','C','D','E','F','G','A','Bb','C'],
    'F#':['F#','G#','A#','B','C#','D#','E#','F#','G#','A#','B','C#'],
    Gb: ['Gb','Ab','Bb','Cb','Db','Eb','F','Gb','Ab','Bb','Cb','Db'],
    G:  ['G','A','B','C','D','E','F#','G','A','B','C','D'],
    Ab: ['Ab','Bb','C','Db','Eb','F','G','Ab','Bb','C','Db','Eb'],
    A:  ['A','B','C#','D','E','F#','G#','A','B','C#','D','E'],
    Bb: ['Bb','C','D','Eb','F','G','A','Bb','C','D','Eb','F'],
    B:  ['B','C#','D#','E','F#','G#','A#','B','C#','D#','E','F#']
  };

  const ENHARMONIC_PITCH = {
    C:0, 'B#':0,
    'C#':1, Db:1,
    D:2,
    'D#':3, Eb:3,
    E:4, Fb:4,
    F:5, 'E#':5,
    'F#':6, Gb:6,
    G:7,
    'G#':8, Ab:8,
    A:9,
    'A#':10, Bb:10,
    B:11, Cb:11
  };

  function pitchOf(root){
    return ENHARMONIC_PITCH[root] ?? null;
  }

  function normalizeTargetKey(k){
    if(k === 'A#') return 'Bb';
    if(k === 'D#') return 'Eb';
    if(k === 'G#') return 'Ab';
    if(k === 'Db') return 'C#';
    return k;
  }

  function preferredRootForPitch(pitch, targetKey){
    const p=((pitch%12)+12)%12;
    const key=normalizeTargetKey(targetKey);

    // Flat keys should display flat roots; sharp keys should display
    // sharp roots. Natural keys use the same practical convention
    // already used by the app.
    const flatKeys=new Set(['F','Bb','Eb','Ab','Db','Gb']);
    const sharpKeys=new Set(['G','D','A','E','B','F#','C#']);

    const flats=['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
    const sharps=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

    if(flatKeys.has(key)) return flats[p];
    if(sharpKeys.has(key)) return sharps[p];

    const table=KEY_SPELLINGS[key];
    if(table && table[p]) return table[p];
    return ['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'][p];
  }

  function splitChord(chord){
    const text=String(chord ?? '').trim();
    // Root is always the first letter plus optional #/b.
    const match=text.match(/^([A-G](?:#|b)?)(.*)$/);
    if(!match) return null;
    return {root:match[1], suffix:match[2]};
  }

  function transposeRoot(root, interval, targetKey){
    const p=pitchOf(root);
    if(p===null) return root;
    return preferredRootForPitch(p+interval,targetKey);
  }

  /*
     Robust chord transposer.

     Examples:
       Fdim  -> F#dim
       F#dim -> Gdim
       C#m7  -> Dm7
       Bb7   -> B7
       C/G   -> D/A
       F#dim/A -> Gdim/Bb

     The chord quality is NOT interpreted as a root. Everything
     after the first root is preserved, while slash-bass notes
     are transposed separately.
  */
  function transposeChordFromBank(chord, interval, targetKey){
    if(!chord) return chord;

    // A compact chord-only line may contain several chords.
    const text=String(chord).trim();
    if(/\s+/.test(text)){
      const tokens=text.split(/\s+/);
      if(tokens.length>1 && tokens.every(t=>splitChord(t))){
        return tokens.map(t=>transposeChordFromBank(t,interval,targetKey)).join(' ');
      }
    }

    const parts=splitChord(text);
    if(!parts) return chord;

    const rootPitch=pitchOf(parts.root);
    if(rootPitch===null) return chord;

    let suffix=parts.suffix;

    // Transpose slash-bass separately, while preserving all quality
    // symbols such as dim, aug, sus4, maj7, add9, etc.
    suffix=suffix.replace(/\/([A-G](?:#|b)?)/g,(full,bass)=>{
      const bassPitch=pitchOf(bass);
      if(bassPitch===null) return full;
      return '/'+preferredRootForPitch(bassPitch+interval,targetKey);
    });

    return preferredRootForPitch(rootPitch+interval,targetKey)+suffix;
  }

  /* =========================================================
     OVERRIDE THE ORIGINAL TRANSPOSER
     ========================================================= */
  window.transposeChord=transposeChordFromBank;

  /* The original applyTranspose only knows about the old 12-name
     key list. Replace it so target-key spelling is passed into the
     chord-bank transposer. */
  window.applyTranspose=function(target){
    target=normalizeTargetKey(target);
    const fromKey=normalizeTargetKey(window.currentKey || 'C');
    const from=pitchOf(fromKey);
    const to=pitchOf(target);

    if(from===null || to===null){
      if(typeof window.toast==='function') window.toast('Invalid key');
      return;
    }

    const interval=(to-from+12)%12;
    const source=JSON.parse(JSON.stringify(window.transposeSource || window.base || {}));

    Object.keys(source).forEach(part=>{
      source[part]=(source[part]||[]).map(row=>{
        const chord=row?.[0] ?? '';
        const lyric=row?.[1] ?? '';
        return [transposeChordFromBank(chord,interval,target),lyric];
      });
    });

    window.base=source;
    window.currentKey=target;
    window.transposeSource=JSON.parse(JSON.stringify(source));

    if(typeof window.closeModal==='function') window.closeModal();
    if(typeof window.renderSong==='function') window.renderSong();
    if(typeof window.saveLocal==='function') window.saveLocal(false);
    if(typeof window.toast==='function') window.toast('Song is now in the key of '+target);
  };

  /* =========================================================
     SEARCH / URL ANALYZER
     ========================================================= */
  function injectUrlUI(){
    if(document.getElementById('songUrlAnalyzer')) return;
    const results=document.getElementById('searchResults');
    const hr=results && results.nextElementSibling;
    if(!results) return;

    const box=document.createElement('div');
    box.id='songUrlAnalyzer';
    box.className='card';
    box.style.marginTop='12px';
    box.innerHTML=`<b>Analyze from song link</b>
      <div class="muted" style="margin:5px 0 9px">Paste a public chord/lyrics page URL and analyze its song content.</div>
      <div class="searchbox" style="margin:8px 0 0">
        <input class="input" id="songUrl" placeholder="https://tabs.ultimate-guitar.com/tab/...">
        <button type="button" class="btn primary" id="analyzeUrlBtn">Analyze Link</button>
      </div>
      <div id="urlAnalysisStatus" class="muted" style="margin-top:7px"></div>`;

    if(hr) hr.parentNode.insertBefore(box,hr);
    else results.parentNode.appendChild(box);
    document.getElementById('analyzeUrlBtn').onclick=analyzeSongUrl;
  }

  window.openSearch=function(){
    originalOpenSearch();
    injectUrlUI();
  };

  function extractMeta(text,url){
    const lines=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    let title='',artist='';

    for(const line of lines.slice(0,80)){
      if(!title && /^(?:title|song)\s*:/i.test(line)) title=line.replace(/^(?:title|song)\s*:\s*/i,'').trim();
      if(!artist && /^(?:artist|by)\s*:/i.test(line)) artist=line.replace(/^(?:artist|by)\s*:\s*/i,'').trim();
      const ug=line.match(/^(.+?)\s+chords?\s+by\s+(.+)$/i);
      if(!title && ug) title=ug[1].trim();
      if(!artist && ug) artist=ug[2].trim();
    }

    if(!title){
      const heading=lines.find(x=>/^#{1,4}\s+/.test(x));
      if(heading) title=heading.replace(/^#{1,4}\s+/,'').trim();
    }

    if(!title){
      try{
        const parts=new URL(url).pathname.split('/').filter(Boolean);
        const part=parts[parts.length-1]||'Imported Song';
        title=decodeURIComponent(part).replace(/[-_]+/g,' ').replace(/\.[a-z0-9]+$/i,'').replace(/\b\w/g,c=>c.toUpperCase());
      }catch(_){ title='Imported Song'; }
    }

    return {title:title||'Imported Song',artist:artist||'Unknown Artist'};
  }

  function isChordToken(token){
    // Supports roots, accidentals, qualities, extensions, symbols,
    // parenthesized alterations, and slash chords.
    return /^(?:[A-G](?:#|b)?)(?:[A-Za-z0-9+#b°øΔ+\-]*(?:\([^)]*\))?)(?:\/[A-G](?:#|b)?)?$/.test(token);
  }

  function looksLikeChordLine(line){
    const s=line.trim();
    if(!s || s.length>140) return false;
    const tokens=s.split(/\s+/).filter(Boolean);
    if(!tokens.length || tokens.length>16) return false;
    return tokens.every(isChordToken) && tokens.length>=1;
  }

  function normalizeChordSpacing(text){
    return text.split(/\r?\n/).map(line=>{
      const s=line.trim();
      if(looksLikeChordLine(s)) return s.split(/\s+/).join(' ');
      return line.replace(/[ \t]+$/,'');
    }).join('\n');
  }

  function normalizeSections(text){
    const sectionNames='intro|verse(?:\\s*\\d+)?|pre[- ]?chorus|chorus|refrain|bridge|tag|ad[- ]?lib|adlib|interlude|instrumental|outro|ending';
    return text.split(/\r?\n/).map(line=>{
      const s=line.trim();
      const m=s.match(new RegExp('^\\[?(' + sectionNames + ')\\]?(?:\\s*[:\\-]\\s*)?$', 'i'));
      return m ? '['+m[1]+']' : line;
    }).join('\n');
  }

  function cleanFetchedText(text,url){
    let out=text.replace(/\r/g,'').replace(/\u00a0/g,' ');
    out=out.replace(/\[([^\]]+)\]\([^)]*\)/g,'$1');
    const noise=[
      /^\s*(ultimate guitar|tabs|chords|lyrics|official|pro|premium)\s*$/i,
      /^\s*(transpose|capo|tuning|difficulty|rating|comments?|views?)\s*:?\s*$/i,
      /^\s*(add to favorites|print|share|report|edit|sign in|log in)\s*$/i,
      /^\s*(back to top|related tabs?|similar tabs?)\s*$/i
    ];
    out=out.split('\n').filter(line=>!noise.some(rx=>rx.test(line))).join('\n');
    out=out.replace(/^\s*(?:Source|URL)\s*:\s*.*$/gim,'');
    out=out.replace(/^#{1,6}\s+/gm,'');
    out=out.replace(/\n{4,}/g,'\n\n\n');
    out=normalizeSections(out);
    out=normalizeChordSpacing(out);
    return out.trim();
  }

  function validateSongText(text){
    const lines=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    const chordLines=lines.filter(looksLikeChordLine).length;
    const lyricLike=lines.filter(x=>x.length>12 && /[A-Za-z]/.test(x) && !looksLikeChordLine(x)).length;
    return {lines:lines.length,chordLines,lyricLike};
  }

  async function fetchReadablePage(url){
    const readerUrl='https://r.jina.ai/'+url;
    const response=await fetch(readerUrl,{headers:{Accept:'text/plain'}});
    if(!response.ok) throw new Error('The song page could not be read ('+response.status+').');
    const raw=await response.text();
    if(!raw || raw.trim().length<40) throw new Error('The page returned no readable song content.');
    return raw;
  }

  async function analyzeSongUrl(){
    const input=document.getElementById('songUrl');
    const status=document.getElementById('urlAnalysisStatus');
    const url=(input?.value||'').trim();
    if(!url){ status.textContent='Paste a song page URL first.'; return; }

    try{
      const u=new URL(url);
      if(!/^https?:$/.test(u.protocol)) throw new Error('Only http/https links are supported.');
    }catch(e){ status.textContent='Please enter a valid http/https URL.'; return; }

    status.textContent='Reading song page…';

    try{
      const raw=await fetchReadablePage(url);
      status.textContent='Extracting lyrics and chords…';
      const meta=extractMeta(raw,url);
      const text=cleanFetchedText(raw,url);
      const stats=validateSongText(text);

      if(stats.lyricLike===0) throw new Error('The page was reached, but no lyric text was detected. The source may be blocking song content.');

      const titleEl=document.getElementById('importTitle');
      const artistEl=document.getElementById('importArtist');
      const textEl=document.getElementById('songText');
      if(!titleEl || !artistEl || !textEl) throw new Error('The song analyzer form is not available.');

      titleEl.value=meta.title;
      artistEl.value=meta.artist;
      textEl.value=text;
      status.textContent='Lyrics found. Detecting song sections…';
      originalAnalyzeSong();
      status.textContent='Analysis complete — '+stats.chordLines+' chord lines and '+stats.lyricLike+' lyric lines detected.';
    }catch(e){
      console.error('Song URL analyzer:',e);
      status.textContent='Could not analyze this link: '+(e.message||'Unknown error');
    }
  }

  window.analyzeSongUrl=analyzeSongUrl;
  window.__songAnalyzerLoaded=true;
})();
