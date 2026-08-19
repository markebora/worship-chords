(function(){'use strict';
const STYLE_ID='librarySearchUIStyle';
function esc(s){return String(s||'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));}
function install(){
 if(document.getElementById(STYLE_ID))return;
 const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
 #librarySearchButton{position:fixed;right:18px;top:18px;width:42px;height:42px;border:1px solid #59616b;border-radius:50%;background:transparent;color:inherit;font-size:25px;line-height:1;z-index:10000;cursor:pointer}
 #librarySearchOverlay{position:fixed;inset:0;background:rgba(0,0,0,.72);display:none;align-items:flex-start;justify-content:center;padding:70px 16px 20px;z-index:10001;box-sizing:border-box}
 #librarySearchPanel{width:min(560px,100%);background:#11151a;border:1px solid #30343a;border-radius:16px;padding:16px;box-sizing:border-box;box-shadow:0 12px 40px rgba(0,0,0,.5)}
 #librarySearchPanel .head{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;font-weight:700;font-size:18px}
 #librarySearchClose{border:0;background:transparent;color:inherit;font-size:24px;cursor:pointer}
 #librarySearchPanel input{width:100%;box-sizing:border-box;padding:12px;border:1px solid #3a4149;border-radius:10px;background:#090b0e;color:inherit;font-size:16px;margin-bottom:10px}
 #librarySearchHint{font-size:12px;opacity:.65;margin:-3px 0 10px}
 #librarySearchResults{max-height:45vh;overflow:auto}
 .librarySearchResult{padding:12px;border-bottom:1px solid #292e34;cursor:pointer}
 .librarySearchResult:last-child{border-bottom:0}
 .librarySearchResult small{opacity:.7;display:block;margin-top:3px}
 #libraryAnalyzeRow{display:none;border-top:1px solid #30343a;margin-top:14px;padding-top:14px}
 #libraryAnalyzeButton{width:100%;padding:12px;border:1px solid #59616b;border-radius:10px;background:#fff;color:#111;font-weight:800;cursor:pointer}
 `;document.head.appendChild(style);
 const btn=document.createElement('button');btn.id='librarySearchButton';btn.title='Search library or paste Ultimate Guitar link';btn.setAttribute('aria-label','Search library or paste Ultimate Guitar link');btn.textContent='⌕';document.body.appendChild(btn);
 const overlay=document.createElement('div');overlay.id='librarySearchOverlay';overlay.innerHTML=`<div id="librarySearchPanel"><div class="head"><span>Search Library / Import Song</span><button id="librarySearchClose" aria-label="Close">×</button></div><input id="librarySearchInput" placeholder="Search song or paste Ultimate Guitar link" autocomplete="off"><div id="librarySearchHint">Search your saved songs, or paste an Ultimate Guitar link.</div><div id="librarySearchResults"></div><div id="libraryAnalyzeRow"><button id="libraryAnalyzeButton">Analyze Song</button></div></div>`;document.body.appendChild(overlay);
 const input=overlay.querySelector('#librarySearchInput'),results=overlay.querySelector('#librarySearchResults'),analyzeRow=overlay.querySelector('#libraryAnalyzeRow'),analyzeBtn=overlay.querySelector('#libraryAnalyzeButton');
 function list(){try{return JSON.parse(localStorage.getItem('worshipChordsSongs')||'[]')}catch(e){return[]}}
 function isUG(q){return /ultimate-guitar\.com/i.test(q)||/https?:\/\//i.test(q)}
 function findImporterInput(){return ['#songUrl','#urlInput','#searchInput','#songSearchInput'].map(s=>document.querySelector(s)).find(Boolean)}
 function findAnalyzeButton(){return Array.from(document.querySelectorAll('button')).find(x=>/analy[sz]e\s*song/i.test((x.textContent||'').trim()))}
 function show(q){const needle=q.trim().toLowerCase();if(isUG(q)){results.innerHTML='<div style="padding:12px">Ultimate Guitar link detected.</div>';analyzeRow.style.display='block';return;}analyzeRow.style.display='none';const arr=list().filter(s=>!needle||String(s.title||'').toLowerCase().includes(needle)||String(s.artist||'').toLowerCase().includes(needle));results.innerHTML=arr.length?arr.map(s=>`<div class="librarySearchResult" data-title="${esc(s.title)}"><b>${esc(s.title||'Untitled')}</b><small>${esc(s.artist||'Unknown Artist')} • Key: ${esc(s.key||'—')}</small></div>`).join(''):'<div style="padding:12px;opacity:.7">No saved songs found.</div>';results.querySelectorAll('.librarySearchResult').forEach(el=>el.onclick=()=>{const title=el.dataset.title;const idx=list().findIndex(s=>(s.title||'')===title);overlay.style.display='none';if(idx>=0&&window.__worshipOpenSaved)window.__worshipOpenSaved(idx);});}
 btn.onclick=()=>{overlay.style.display='flex';input.value='';analyzeRow.style.display='none';show('');setTimeout(()=>input.focus(),50)};
 overlay.querySelector('#librarySearchClose').onclick=()=>overlay.style.display='none';overlay.onclick=e=>{if(e.target===overlay)overlay.style.display='none'};input.oninput=()=>show(input.value);
 analyzeBtn.onclick=()=>{const url=input.value.trim();const target=findImporterInput();if(!target){alert('Ultimate Guitar importer is not available.');return;}target.value=url;target.dispatchEvent(new Event('input',{bubbles:true}));target.dispatchEvent(new Event('change',{bubbles:true}));const existing=findAnalyzeButton();overlay.style.display='none';if(existing)existing.click();else{const importer=Array.from(document.querySelectorAll('button')).find(x=>/import|search/i.test((x.textContent||'').trim()));if(importer)importer.click();else alert('The link was entered, but the Analyze Song control was not found.');}};
 // Hide the old permanent search/add/import controls while preserving their underlying functionality.
 const hideOld=()=>{Array.from(document.querySelectorAll('button')).forEach(b=>{if(b===btn||b.closest('#librarySearchOverlay'))return;const t=(b.textContent||'').replace(/\s+/g,' ').trim();if(/add\s*\/\s*search song|search song|import song|paste ultimate guitar|ultimate guitar/i.test(t))b.style.display='none';});};
 hideOld();new MutationObserver(hideOld).observe(document.body,{childList:true,subtree:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();