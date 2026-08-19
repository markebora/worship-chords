(function(){'use strict';
const STYLE_ID='librarySearchUIStyle';
const IMPORT_API='https://worship-chords-rho.vercel.app/api/import';
function esc(s){return String(s||'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));}
function isUG(url){return /^https?:\/\/(www\.)?(tabs\.)?ultimate-guitar\.com\//i.test(url);}
function normalize(text){return String(text||'').replace(/&ndash;|&#8211;|&#x2013;/gi,'–').replace(/&mdash;|&#8212;|&#x2014;/gi,'—');}
function install(){
 if(document.getElementById(STYLE_ID))return;
 const style=document.createElement('style');style.id=STYLE_ID;textContent='';
 style.textContent=`
 #song-import-panel{display:none!important}
 #search-module,#search-song-panel,#song-search-panel,.song-search-panel,.import-song-panel{display:none!important}
 #librarySearchButton{position:fixed;right:18px;top:18px;width:42px;height:42px;border:1px solid #59616b;border-radius:50%;background:transparent;color:inherit;font-size:24px;line-height:1;z-index:10000;cursor:pointer}
 #librarySearchOverlay{position:fixed;inset:0;background:rgba(0,0,0,.72);display:none;align-items:flex-start;justify-content:center;padding:70px 16px 20px;z-index:10001;box-sizing:border-box}
 #librarySearchPanel{width:min(560px,100%);background:#11151a;border:1px solid #30343a;border-radius:16px;padding:16px;box-sizing:border-box;box-shadow:0 12px 40px rgba(0,0,0,.5)}
 #librarySearchPanel .head{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;font-weight:700;font-size:18px}
 #librarySearchClose{border:0;background:transparent;color:inherit;font-size:24px;cursor:pointer}
 #libraryUnifiedInput{width:100%;box-sizing:border-box;padding:13px;border:1px solid #3a4149;border-radius:10px;background:#090b0e;color:inherit;font-size:16px;margin-bottom:8px}
 #librarySearchHint{font-size:12px;opacity:.7;margin-bottom:10px}
 #librarySearchResults{max-height:42vh;overflow:auto}
 .librarySearchResult{padding:12px;border-bottom:1px solid #292e34;cursor:pointer}
 .librarySearchResult:last-child{border-bottom:0}
 .librarySearchResult small{opacity:.7;display:block;margin-top:3px}
 #libraryAnalyzeRow{display:none;margin-top:12px;padding-top:12px;border-top:1px solid #30343a}
 #libraryAnalyzeButton{width:100%;padding:12px;border:1px solid #59616b;border-radius:10px;background:#181d23;color:inherit;font-weight:700;cursor:pointer}
 #libraryImportStatus{font-size:13px;margin-top:9px;opacity:.8;line-height:1.4}
 `;document.head.appendChild(style);
 const btn=document.createElement('button');btn.id='librarySearchButton';btn.title='Search library or import Ultimate Guitar';btn.setAttribute('aria-label','Search library or paste Ultimate Guitar link');btn.textContent='⌕';document.body.appendChild(btn);
 const overlay=document.createElement('div');overlay.id='librarySearchOverlay';overlay.innerHTML=`<div id="librarySearchPanel"><div class="head"><span>Search Library / Import Song</span><button id="librarySearchClose" aria-label="Close">×</button></div><input id="libraryUnifiedInput" placeholder="Search your saved songs, or paste an Ultimate Guitar link." autocomplete="off"><div id="librarySearchHint">Search your saved songs, or paste an Ultimate Guitar link.</div><div id="librarySearchResults"></div><div id="libraryAnalyzeRow"><button id="libraryAnalyzeButton" type="button">Analyze Song</button><div id="libraryImportStatus"></div></div></div>`;document.body.appendChild(overlay);
 const input=overlay.querySelector('#libraryUnifiedInput'),results=overlay.querySelector('#librarySearchResults'),analyzeRow=overlay.querySelector('#libraryAnalyzeRow'),analyzeBtn=overlay.querySelector('#libraryAnalyzeButton'),status=overlay.querySelector('#libraryImportStatus');
 function list(){try{return JSON.parse(localStorage.getItem('worshipChordsSongs')||'[]')}catch(e){return[]}}
 function show(q){const needle=q.trim().toLowerCase();if(isUG(q.trim())){results.innerHTML='<div style="padding:12px;opacity:.7">Ultimate Guitar link detected.</div>';analyzeRow.style.display='block';status.textContent='';return;}analyzeRow.style.display='none';status.textContent='';const arr=list().filter(s=>!needle||String(s.title||'').toLowerCase().includes(needle)||String(s.artist||'').toLowerCase().includes(needle));results.innerHTML=arr.length?arr.map(s=>`<div class="librarySearchResult" data-title="${esc(s.title)}"><b>${esc(s.title||'Untitled')}</b><small>${esc(s.artist||'Unknown Artist')} • Key: ${esc(s.key||'—')}</small></div>`).join(''):'<div style="padding:12px;opacity:.7">No saved songs found.</div>';results.querySelectorAll('.librarySearchResult').forEach(el=>el.onclick=()=>{const title=el.dataset.title;const idx=list().findIndex(s=>(s.title||'')===title);overlay.style.display='none';if(idx>=0&&window.__worshipOpenSaved)window.__worshipOpenSaved(idx);});}
 btn.onclick=()=>{overlay.style.display='flex';input.value='';show('');setTimeout(()=>input.focus(),50)};
 overlay.querySelector('#librarySearchClose').onclick=()=>overlay.style.display='none';overlay.onclick=e=>{if(e.target===overlay)overlay.style.display='none'};input.oninput=()=>show(input.value);
 analyzeBtn.onclick=async()=>{const url=input.value.trim();if(!isUG(url)){show(url);return;}analyzeBtn.disabled=true;analyzeBtn.textContent='Loading Song...';status.textContent='Fetching song content...';try{const response=await fetch(IMPORT_API,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({url})});const raw=await response.text();let data={};try{data=JSON.parse(raw)}catch(e){throw new Error('Importer returned an unexpected response.')};if(!response.ok)throw new Error(data.error||('Importer returned HTTP '+response.status));if(!data.text)throw new Error('Importer returned no readable song content.');const text=normalize(data.text);localStorage.setItem('worshipChordsSourceUrl',data.sourceUrl||url);localStorage.setItem('worshipChordsImportedText',text);window.dispatchEvent(new CustomEvent('worshipchords:song-imported',{detail:{sourceUrl:data.sourceUrl||url,text}}));status.textContent='Song loaded. Starting analysis...';analyzeBtn.textContent='Analyzing...';setTimeout(()=>{const candidates=['#analyze-song','#analyzeSong','button'];const b=candidates.map(s=>document.querySelector(s)).find(el=>el&&el!==analyzeBtn&&/analy/i.test(el.textContent||''));if(b)b.click();else window.dispatchEvent(new CustomEvent('worshipchords:analyze-imported',{detail:{sourceUrl:data.sourceUrl||url,text}}));},50);}catch(error){status.textContent='⚠️ '+(error.message||'Could not load the song.');analyzeBtn.disabled=false;analyzeBtn.textContent='Analyze Song';}};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();