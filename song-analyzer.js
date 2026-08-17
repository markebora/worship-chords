(function(){
  'use strict';

  const originalOpenSearch = window.openSearch;
  const originalAnalyzeSong = window.analyzeSong;

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

    // Common metadata forms.
    for(const line of lines.slice(0,80)){
      if(!title && /^(?:title|song)\s*:/i.test(line)){
        title=line.replace(/^(?:title|song)\s*:\s*/i,'').trim();
      }
      if(!artist && /^(?:artist|by)\s*:/i.test(line)){
        artist=line.replace(/^(?:artist|by)\s*:\s*/i,'').trim();
      }

      // Ultimate Guitar-style heading: "Song Title Chords by Artist".
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
        title=decodeURIComponent(part)
          .replace(/[-_]+/g,' ')
          .replace(/\.[a-z0-9]+$/i,'')
          .replace(/\b\w/g,c=>c.toUpperCase());
      }catch(_){
        title='Imported Song';
      }
    }

    return {
      title:title||'Imported Song',
      artist:artist||'Unknown Artist'
    };
  }

  function isChordToken(token){
    // Covers common chord spellings including slash chords and extensions.
    return /^(?:[A-G](?:#|b)?)(?:maj|min|m|dim|aug|sus|add|6|7|9|11|13|M|Δ|°|\+|-)*(?:\([^)]*\))?(?:\/[A-G](?:#|b)?)?$/.test(token);
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

    // Remove markdown links while retaining their visible text.
    out=out.replace(/\[([^\]]+)\]\([^)]*\)/g,'$1');

    // Remove obvious page/navigation noise, but never remove ordinary lyric lines.
    const noise=[
      /^\s*(ultimate guitar|tabs|chords|lyrics|official|pro|premium)\s*$/i,
      /^\s*(transpose|capo|tuning|difficulty|rating|comments?|views?)\s*:?\s*$/i,
      /^\s*(add to favorites|print|share|report|edit|sign in|log in)\s*$/i,
      /^\s*(back to top|related tabs?|similar tabs?)\s*$/i
    ];
    out=out.split('\n').filter(line=>!noise.some(rx=>rx.test(line))).join('\n');

    // Remove source/URL metadata lines.
    out=out.replace(/^\s*(?:Source|URL)\s*:\s*.*$/gim,'');

    // Keep headings long enough for section detection, but remove markdown markers.
    out=out.replace(/^#{1,6}\s+/gm,'');

    // Collapse excessive blank lines without destroying lyric/chord separation.
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
    // GitHub Pages cannot directly fetch many song sites because of CORS.
    // Jina Reader converts public pages into readable text/markdown.
    const readerUrl='https://r.jina.ai/'+url;
    const response=await fetch(readerUrl,{headers:{Accept:'text/plain'}});
    if(!response.ok){
      throw new Error('The song page could not be read ('+response.status+').');
    }
    const raw=await response.text();
    if(!raw || raw.trim().length<40){
      throw new Error('The page returned no readable song content.');
    }
    return raw;
  }

  async function analyzeSongUrl(){
    const input=document.getElementById('songUrl');
    const status=document.getElementById('urlAnalysisStatus');
    const url=(input?.value||'').trim();
    if(!url){
      status.textContent='Paste a song page URL first.';
      return;
    }

    try{
      const u=new URL(url);
      if(!/^https?:$/.test(u.protocol)) throw new Error('Only http/https links are supported.');
    }catch(e){
      status.textContent='Please enter a valid http/https URL.';
      return;
    }

    status.textContent='Reading song page…';

    try{
      const raw=await fetchReadablePage(url);
      status.textContent='Extracting lyrics and chords…';

      const meta=extractMeta(raw,url);
      const text=cleanFetchedText(raw,url);
      const stats=validateSongText(text);

      if(stats.lyricLike===0){
        throw new Error('The page was reached, but no lyric text was detected. The source may be blocking song content.');
      }

      // Feed the cleaned result into the SAME analyzer used by pasted text.
      const titleEl=document.getElementById('importTitle');
      const artistEl=document.getElementById('importArtist');
      const textEl=document.getElementById('songText');

      if(!titleEl || !artistEl || !textEl){
        throw new Error('The song analyzer form is not available.');
      }

      titleEl.value=meta.title;
      artistEl.value=meta.artist;
      textEl.value=text;

      status.textContent='Lyrics found. Detecting song sections…';

      // Preserve the existing song-analysis pipeline; do not replace its logic.
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
