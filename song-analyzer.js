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
      <div class="muted" style="margin:5px 0 9px">Paste a public chord/lyrics page URL and analyze its available song text.</div>
      <div class="searchbox" style="margin:8px 0 0">
        <input class="input" id="songUrl" placeholder="https://example.com/song/...">
        <button type="button" class="btn primary" id="analyzeUrlBtn">Analyze Link</button>
      </div>
      <div id="urlAnalysisStatus" class="muted" style="margin-top:7px"></div>`;
    if(hr) hr.parentNode.insertBefore(box,hr); else results.parentNode.appendChild(box);
    document.getElementById('analyzeUrlBtn').onclick=analyzeSongUrl;
  }

  window.openSearch=function(){
    originalOpenSearch();
    injectUrlUI();
  };

  function extractMeta(text,url){
    const lines=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    let title='',artist='';
    for(const line of lines.slice(0,40)){
      if(!title && /^(title|song)\s*:/i.test(line)) title=line.replace(/^(title|song)\s*:\s*/i,'').trim();
      if(!artist && /^(artist|by)\s*:/i.test(line)) artist=line.replace(/^(artist|by)\s*:\s*/i,'').trim();
    }
    if(!title){
      const h=lines.find(x=>/^#{1,3}\s+/.test(x));
      if(h) title=h.replace(/^#{1,3}\s+/,'').trim();
    }
    if(!title){
      try{
        const part=new URL(url).pathname.split('/').filter(Boolean).pop()||'Imported Song';
        title=decodeURIComponent(part).replace(/[-_]+/g,' ').replace(/\.[a-z0-9]+$/i,'').replace(/\b\w/g,c=>c.toUpperCase());
      }catch(_){title='Imported Song';}
    }
    return {title:title||'Imported Song',artist:artist||'Unknown Artist'};
  }

  function cleanText(text){
    return text.replace(/\r/g,'')
      .replace(/^\s*(Title|Artist|Source|URL)\s*:\s*.*$/gim,'')
      .replace(/^#{1,6}\s+/gm,'')
      .replace(/\[([^\]]+)\]\([^)]*\)/g,'$1')
      .replace(/\u00a0/g,' ')
      .replace(/[ \t]+$/gm,'').trim();
  }

  function normalizeSections(text){
    return text.split(/\r?\n/).map(line=>{
      const m=line.trim().match(/^\[?((?:intro|verse(?:\s*\d+)?|pre[- ]?chorus|chorus|bridge|tag|ad[- ]?lib|adlib|interlude|outro))\]?\s*:?[ \t]*$/i);
      return m ? '['+m[1]+']' : line;
    }).join('\n');
  }

  async function analyzeSongUrl(){
    const input=document.getElementById('songUrl');
    const status=document.getElementById('urlAnalysisStatus');
    const result=document.getElementById('analysisResult');
    const url=(input?.value||'').trim();
    if(!url){status.textContent='Paste a song page URL first.';return;}
    try{ const u=new URL(url); if(!/^https?:$/.test(u.protocol)) throw new Error('Only http/https links are supported.'); }
    catch(e){status.textContent='Please enter a valid http/https URL.';return;}

    status.textContent='Reading song page…';
    try{
      const response=await fetch('https://r.jina.ai/'+url,{headers:{Accept:'text/plain'}});
      if(!response.ok) throw new Error('The page could not be read ('+response.status+').');
      const raw=await response.text();
      if(!raw || raw.trim().length<20) throw new Error('No readable song text was found.');
      const meta=extractMeta(raw,url);
      const text=normalizeSections(cleanText(raw));
      document.getElementById('importTitle').value=meta.title;
      document.getElementById('importArtist').value=meta.artist;
      document.getElementById('songText').value=text;
      status.textContent='Page loaded. Analyzing structure…';
      base={};
      originalAnalyzeSong();
      status.textContent='Analysis complete. Review the detected sections below.';
    }catch(e){
      console.error(e);
      status.textContent='Could not analyze this link: '+(e.message||'Unknown error');
      if(result) result.innerHTML='<div class="card"><b>Link analysis failed.</b><div class="muted" style="margin-top:6px">Try a public chord/lyrics page, or paste the song text below.</div></div>';
    }
  }

  window.analyzeSongUrl=analyzeSongUrl;
  window.__songAnalyzerLoaded=true;
})();
