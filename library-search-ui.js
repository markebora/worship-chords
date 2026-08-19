(function(){'use strict';
const STYLE_ID='librarySearchUIStyle';
function esc(s){return String(s||'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));}
function install(){
 if(document.getElementById(STYLE_ID))return;
 const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
 #librarySearchButton{position:fixed;right:18px;top:18px;width:42px;height:42px;border:1px solid #59616b;border-radius:50%;background:transparent;color:inherit;font-size:24px;line-height:1;z-index:10000;cursor:pointer}
 #librarySearchOverlay{position:fixed;inset:0;background:rgba(0,0,0,.72);display:none;align-items:flex-start;justify-content:center;padding:70px 16px 20px;z-index:10001;box-sizing:border-box}
 #librarySearchPanel{width:min(520px,100%);background:#11151a;border:1px solid #30343a;border-radius:16px;padding:16px;box-sizing:border-box;box-shadow:0 12px 40px rgba(0,0,0,.5)}
 #librarySearchPanel .head{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;font-weight:700;font-size:18px}
 #librarySearchClose{border:0;background:transparent;color:inherit;font-size:24px;cursor:pointer}
 #librarySearchPanel input{width:100%;box-sizing:border-box;padding:12px;border:1px solid #3a4149;border-radius:10px;background:#090b0e;color:inherit;font-size:16px;margin-bottom:10px}
 #librarySearchResults{max-height:45vh;overflow:auto}
 .librarySearchResult{padding:12px;border-bottom:1px solid #292e34;cursor:pointer}
 .librarySearchResult:last-child{border-bottom:0}
 .librarySearchResult small{opacity:.7;display:block;margin-top:3px}
 .ugImportRow{border-top:1px solid #30343a;margin-top:14px;padding-top:14px}
 .ugImportRow button{width:100%;padding:11px;border:1px solid #59616b;border-radius:10px;background:#181d23;color:inherit;cursor:pointer}
 `;document.head.appendChild(style);
 const btn=document.createElement('button');btn.id='librarySearchButton';btn.title='Search library / import Ultimate Guitar';btn.setAttribute('aria-label','Search library or paste Ultimate Guitar link');btn.textContent='⌕';document.body.appendChild(btn);
 const overlay=document.createElement('div');overlay.id='librarySearchOverlay';overlay.innerHTML=`<div id="librarySearchPanel"><div class="head"><span>Search / Import</span><button id="librarySearchClose" aria-label="Close">×</button></div><input id="librarySearchInput" placeholder="Search song in Library" autocomplete="off"><div id="librarySearchResults"></div><div class="ugImportRow"><input id="libraryUGInput" placeholder="Paste Ultimate Guitar link"><button id="libraryUGButton">Import Song</button></div></div>`;document.body.appendChild(overlay);
 const input=overlay.querySelector('#librarySearchInput'),results=overlay.querySelector('#librarySearchResults');
 function list(){try{return JSON.parse(localStorage.getItem('worshipChordsSongs')||'[]')}catch(e){return[]}}
 function show(q){const needle=q.trim().toLowerCase(),arr=list().filter(s=>!needle||String(s.title||'').toLowerCase().includes(needle)||String(s.artist||'').toLowerCase().includes(needle));results.innerHTML=arr.length?arr.map((s,i)=>`<div class="librarySearchResult" data-title="${esc(s.title)}"><b>${esc(s.title||'Untitled')}</b><small>${esc(s.artist||'Unknown Artist')} • Key: ${esc(s.key||'—')}</small></div>`).join(''):'<div style="padding:12px;opacity:.7">No saved songs found.</div>';results.querySelectorAll('.librarySearchResult').forEach(el=>el.onclick=()=>{const title=el.dataset.title;const idx=list().findIndex(s=>(s.title||'')===title);overlay.style.display='none';if(idx>=0&&window.__worshipOpenSaved)window.__worshipOpenSaved(idx);});}
 btn.onclick=()=>{overlay.style.display='flex';input.value='';show('');setTimeout(()=>input.focus(),50)};
 overlay.querySelector('#librarySearchClose').onclick=()=>overlay.style.display='none';overlay.onclick=e=>{if(e.target===overlay)overlay.style.display='none'};input.oninput=()=>show(input.value);
 overlay.querySelector('#libraryUGButton').onclick=()=>{const url=overlay.querySelector('#libraryUGInput').value.trim();if(!url)return alert('Paste an Ultimate Guitar link first.');overlay.style.display='none';const candidates=['#songUrl','#urlInput','#searchInput','#songSearchInput'];const target=candidates.map(s=>document.querySelector(s)).find(Boolean);if(target){target.value=url;target.dispatchEvent(new Event('input',{bubbles:true}));target.dispatchEvent(new Event('change',{bubbles:true}));const b=Array.from(document.querySelectorAll('button')).find(x=>/import|search|analy/i.test(x.textContent||''));if(b)b.click();else alert('The Ultimate Guitar importer is ready; use the Import/Analyze control.');}else alert('Paste the link into the existing Ultimate Guitar importer.');};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();