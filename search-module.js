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
      <div>
        <h2 style="margin:0">🔎 Search Song</h2>
        <div class="muted">Find lyrics & chords from Ultimate Guitar</div>
      </div>
      <button type="button" class="btn" onclick="closeModal()">Close</button>
    </div>
    <div class="card" style="margin-top:15px">
      <label class="muted">Song title or artist</label>
      <div style="display:flex;gap:8px;margin-top:7px">
        <input id="ugSearchInput" class="chordInput" style="flex:1;width:auto" placeholder="e.g. Way Maker Sinach" autocomplete="off">
        <button type="button" class="btn primary" onclick="runSongSearch()">Search</button>
      </div>
      <div class="muted" style="margin-top:8px">You can also paste an Ultimate Guitar chord-page link.</div>
    </div>
    <div id="ugSearchResults"></div>
  `;
  modal.style.display='flex';
  const input=document.getElementById('ugSearchInput');
  if(input){input.focus();input.addEventListener('keydown',e=>{if(e.key==='Enter')runSongSearch();});}
}

window.openSearch=renderSearch;

window.runSongSearch=function(){
  const input=document.getElementById('ugSearchInput');
  const box=document.getElementById('ugSearchResults');
  const q=(input?.value||'').trim();
  if(!box||!q)return;

  if(isUgUrl(q)){
    box.innerHTML=`<div class="card" style="margin-top:15px"><b>Ultimate Guitar link detected</b><div class="muted" style="margin:7px 0 12px">Open the chord page, then use the Import/Analyze step when available.</div><a class="btn primary" href="${searchEsc(q)}" target="_blank" rel="noopener noreferrer">Open Ultimate Guitar</a></div>`;
    return;
  }

  const url=ugSearchUrl(q);
  box.innerHTML=`<div class="card" style="margin-top:15px"><b>Search results</b><div class="muted" style="margin:7px 0 12px">Ultimate Guitar search is opened with chord/lyrics results. Select the version you want to analyze.</div><a class="btn primary" href="${searchEsc(url)}" target="_blank" rel="noopener noreferrer">Search Ultimate Guitar for “${searchEsc(q)}”</a></div>`;
};

})();
