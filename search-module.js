(function(){
'use strict';

const UG_SEARCH='https://www.ultimate-guitar.com/search.php';
const UG_DOMAIN='tabs.ultimate-guitar.com';

function searchEsc(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function ugSearchUrl(q){return UG_SEARCH+'?search_type=title&value='+encodeURIComponent(q);}
function isUgUrl(value){try{return new URL(value).hostname.endsWith(UG_DOMAIN);}catch(e){return false;}}

function renderSearch(){
  const modal=document.getElementById('modal');
  const body=document.getElementById('modalBody');
  if(!modal||!body)return;
  body.innerHTML=`
    <div class="row" style="align-items:center">
      <div><h2 style="margin:0">🔎 Search Song</h2><div class="muted">Load an Ultimate Guitar chord page into Worship Chords.</div></div>
      <button type="button" class="btn" onclick="closeModal()">Close</button>
    </div>
    <div class="card" style="margin-top:15px">
      <label class="muted">Ultimate Guitar chord-page link</label>
      <div style="display:flex;gap:8px;margin-top:7px;flex-wrap:wrap">
        <input id="ugSearchInput" class="chordInput" style="flex:1;min-width:260px;width:auto" placeholder="https://tabs.ultimate-guitar.com/..." autocomplete="off">
        <button type="button" class="btn primary" onclick="runSongSearch()">Load Song</button>
      </div>
      <div id="ugSearchResults" style="margin-top:12px"></div>
    </div>`;
  modal.style.display='flex';
  const input=document.getElementById('ugSearchInput');
  if(input){input.focus();input.addEventListener('keydown',e=>{if(e.key==='Enter')runSongSearch();});}
}
window.openSearch=renderSearch;

window.runSongSearch=async function(){
  const input=document.getElementById('ugSearchInput');
  const box=document.getElementById('ugSearchResults');
  const q=(input?.value||'').trim();
  if(!box||!q)return;

  if(!isUgUrl(q)){
    box.innerHTML=`<div class="muted">Please paste a direct Ultimate Guitar chord-page URL.</div>`;
    return;
  }

  box.innerHTML=`<div class="muted">⏳ Loading song from Ultimate Guitar…</div>`;
  try{
    const response=await fetch('/api/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:q})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(data.error||`Importer returned HTTP ${response.status}`);

    localStorage.setItem('worshipChordsSourceUrl',data.sourceUrl||q);
    localStorage.setItem('worshipChordsImportedText',data.text||'');

    box.innerHTML=`
      <div style="font-weight:800">✅ Song loaded</div>
      <div class="muted" style="margin:6px 0 12px">The page content is now inside the app and ready for the analyzer.</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button type="button" class="btn primary" id="ugAnalyzeLoaded">🤖 Analyze Song</button>
        <a class="btn" href="${searchEsc(q)}" target="_blank" rel="noopener noreferrer">Open Source</a>
      </div>
      <textarea id="ugLoadedPreview" rows="12" style="width:100%;margin-top:12px;padding:12px;border-radius:9px;border:1px solid #3a424b;background:#0f1317;color:#fff">${searchEsc(data.text||'')}</textarea>`;

    document.getElementById('ugAnalyzeLoaded').onclick=()=>{
      window.dispatchEvent(new CustomEvent('worshipchords:song-imported',{detail:{sourceUrl:q,text:data.text||''}}));
      const btn=document.getElementById('ugAnalyzeLoaded');
      if(btn) btn.textContent='✅ Ready for AI Analyzer';
    };
  }catch(error){
    box.innerHTML=`<div class="card"><b>⚠️ Could not load the page</b><div class="muted" style="margin-top:7px">${searchEsc(error.message||'Importer failed.')}</div><div class="muted" style="margin-top:7px">The backend must be deployed for automatic loading. The current GitHub Pages site cannot run server-side API code.</div></div>`;
  }
};

})();
