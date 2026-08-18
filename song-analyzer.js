(function(){
  'use strict';

  const originalOpenSearch = window.openSearch;
  const originalAnalyzeSong = window.analyzeSong;

  /* =========================================================
     CHORD BANK
     =========================================================
     Chord qualities used/referenced by the app. The transposer
     separates the ROOT from the suffix, so Fdim, Fdim7, F#dim,
     C#m7, Bb7, sus chords, add chords, slash chords, etc. keep
     their quality while the root/bass note is transposed.
  ========================================================= */
  const CHORD_BANK = {
    triads:['','m','dim','aug'],
    sevenths:['7','maj7','m7','min7','dim7','mMaj7','maj7#5','aug7'],
    extensions:['6','m6','9','m9','maj9','11','m11','13','m13'],
    suspended:['sus2','sus4','7sus4'],
    added:['add2','add4','add9','add11','add13'],
    alterations:['5','b5','#5','b9','#9','#11','b13'],
    symbols:['M','min','maj','°','ø','Δ','+','-']
  };

  const PITCH={
    C:0,'B#':0,'C#':1,Db:1,D:2,'D#':3,Eb:3,E:4,Fb:4,
    F:5,'E#':5,'F#':6,Gb:6,G:7,'G#':8,Ab:8,A:9,
    'A#':10,Bb:10,B:11,Cb:11
  };

  function pitchOf(n){
    return PITCH[n] ?? null;
  }

  function normalizeKeyName(k){
    if(k==='A#') return 'Bb';
    if(k==='D#') return 'Eb';
    if(k==='G#') return 'Ab';
    return k;
  }

  function rootForPitch(value,targetKey){
    const p=((value%12)+12)%12;
    const key=normalizeKeyName(targetKey);

    // Prefer the accidental family normally used by the target key.
    const flatKeys=new Set(['F','Bb','Eb','Ab','Db','Gb']);
    const sharpKeys=new Set(['G','D','A','E','B','F#','C#']);
    const flats=['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
    const sharps=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

    if(flatKeys.has(key)) return flats[p];
    if(sharpKeys.has(key)) return sharps[p];

    // C and other neutral cases: retain the app's practical spelling.
    return ['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'][p];
  }

  function splitChord(chord){
    const text=String(chord ?? '').trim();
    const m=text.match(/^([A-G](?:#|b)?)(.*)$/);
    return m ? {root:m[1],suffix:m[2]} : null;
  }

  function transposeChordFromBank(chord,interval,targetKey){
    if(!chord) return chord;

    const text=String(chord).trim();

    // Compact chord-only rows can contain several separate chords.
    if(/\s+/.test(text)){
      const parts=text.split(/\s+/);
      if(parts.length>1 && parts.every(x=>splitChord(x))){
        return parts.map(x=>transposeChordFromBank(x,interval,targetKey)).join(' ');
      }
    }

    const parts=splitChord(text);
    if(!parts) return chord;

    const rootPitch=pitchOf(parts.root);
    if(rootPitch===null) return chord;

    // The original transpose button calls transposeChord(chord, interval)
    // before it changes currentKey. Therefore derive the target key from
    // the current key shown in the UI plus the requested interval.
    if(!targetKey){
      const displayed=document.getElementById('key')?.textContent?.trim() || 'C';
      const currentPitch=pitchOf(displayed);
      if(currentPitch!==null){
        targetKey=rootForPitch(currentPitch+interval,'C');
      }else{
        targetKey='C';
      }
    }

    // Preserve every suffix exactly: dim, dim7, m7, maj7, sus4,
    // add9, altered extensions, symbols, etc.
    let suffix=parts.suffix;

    // Slash chords: transpose the bass note independently.
    suffix=suffix.replace(/\/([A-G](?:#|b)?)/g,(full,bass)=>{
      const bassPitch=pitchOf(bass);
      if(bassPitch===null) return full;
      return '/'+rootForPitch(bassPitch+interval,targetKey);
    });

    return rootForPitch(rootPitch+interval,targetKey)+suffix;
  }

  // Replace only the chord conversion function. The original
  // applyTranspose/render/save flow remains untouched and protected.
  window.transposeChord=transposeChordFromBank;
  window.__worshipChordBank=CHORD_BANK;

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
    // Broad recognition: root + any common chord suffix + optional slash bass.
    // This deliberately accepts new extensions instead of dropping them.
    return /^(?:[A-G](?:#|b)?)[A-Za-z0-9+#b°øΔ+\-]*(?:\([^)]*\))?(?:\/[A-G](?:#|b)?)?$/.test(token);
  }

  function looksLikeChordLine(line){
    const s=line.trim();
    if(!s || s.length>140) return false;
    const tokens=s.split(/\s+/).filter(Boolean);
    if(!tokens.length || tokens.length>16) return false;
    return tokens.every(isChordToken);
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
