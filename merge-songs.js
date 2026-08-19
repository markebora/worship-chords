(function(){
'use strict';
const STORAGE_KEY='worshipChordsSongs';
let selected=[];
let pressTimer=null;
let suppressClick=false;
let rendering=false;

function songs(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');}catch(e){return [];}}
function saveSongs(list){localStorage.setItem(STORAGE_KEY,JSON.stringify(list));}
function esc(v){return String(v==null?'':v).replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));}
function ensureStyle(){
  if(document.getElementById('mergeSongsStyle'))return;
  const s=document.createElement('style');s.id='mergeSongsStyle';
  s.textContent='.mergeBar{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin:10px 0;padding:10px;border:1px solid #30343a;border-radius:10px;background:#11151a}.mergeHint{font-size:12px;opacity:.75;flex:1;min-width:180px}.mergeSelected{outline:2px solid #72b7ff!important;outline-offset:1px;background:#18202a!important}.mergeBadge{display:inline-flex;min-width:24px;height:24px;border-radius:50%;align-items:center;justify-content:center;background:#72b7ff;color:#071018;font-weight:800;margin-right:7px}.mergeModeHint{font-size:12px;opacity:.7;margin:8px 0}';
  document.head.appendChild(s);
}
function getBox(){return document.getElementById('savedSongsList');}
function clearSelection(){selected=[];render();}
function toggle(i){const p=selected.indexOf(i);if(p>=0)selected.splice(p,1);else selected.push(i);render();}
function merge(){
  if(selected.length<2)return;
  const list=songs(),parts=selected.map(i=>list[i]).filter(Boolean);if(parts.length<2)return;
  const sections={},arr=[];
  parts.forEach((song,idx)=>{const title=song.title||('Song '+(idx+1)),order=song.arrangement||Object.keys(song.sections||{});order.forEach(name=>{const key=title+' — '+name;sections[key]=song.sections&&song.sections[name]?JSON.parse(JSON.stringify(song.sections[name])):[];arr.push(key);});});
  const merged={title:'Merged Set — '+parts.map(s=>s.title||'Untitled').join(' + '),artist:parts.map(s=>s.artist||'Unknown Artist').join(' • '),key:'',sourceUrl:'',sections,arrangement:arr,parts:parts.map(s=>({title:s.title||'Untitled',artist:s.artist||'Unknown Artist',key:s.key||'',sourceUrl:s.sourceUrl||'',sections:s.sections||{},arrangement:s.arrangement||Object.keys(s.sections||{})})),merged:true,updatedAt:new Date().toISOString()};
  list.unshift(merged);saveSongs(list);selected=[];
  if(window.__worshipOpenSaved)window.__worshipOpenSaved(0);
  render();
}
function render(){
  if(rendering)return;rendering=true;
  try{
    const box=getBox();if(!box)return;
    const list=songs();
    const old=document.getElementById('mergeBar');if(old)old.remove();

    // Clean UI: do not show merge controls until two or more songs are selected.
    if(selected.length>=2){
      const bar=document.createElement('div');bar.id='mergeBar';bar.className='mergeBar';
      bar.innerHTML='<button type="button" class="btn" id="mergeDoBtn">🔗 Merge Selected ('+selected.length+')</button><button type="button" class="btn" id="mergeCancelBtn">Cancel</button><span class="mergeHint">Songs will merge in the order you selected them.</span>';
      box.parentNode.insertBefore(bar,box);
      bar.querySelector('#mergeDoBtn').onclick=merge;
      bar.querySelector('#mergeCancelBtn').onclick=clearSelection;
    }

    const items=Array.from(box.querySelectorAll(':scope > .item'));
    items.forEach((el,idx)=>{
      if(idx>=list.length)return;
      el.classList.toggle('mergeSelected',selected.includes(idx));
      const oldBadge=el.querySelector('.mergeBadge');if(oldBadge)oldBadge.remove();
      const pos=selected.indexOf(idx);
      if(pos>=0){const main=el.querySelector('.itemmain');if(main){const badge=document.createElement('span');badge.className='mergeBadge';badge.textContent=String(pos+1);main.prepend(badge);}}
    });
    attachHandlers(box);
  }finally{rendering=false;}
}
function attachHandlers(box){
  const list=songs();
  Array.from(box.querySelectorAll(':scope > .item')).forEach((el,idx)=>{
    if(idx>=list.length)return;
    // Avoid stacking duplicate listeners after each selection.
    if(el.dataset.mergeHandlers==='1')return;
    el.dataset.mergeHandlers='1';
    el.addEventListener('contextmenu',e=>{e.preventDefault();toggle(idx);});
    el.addEventListener('touchstart',()=>{suppressClick=false;clearTimeout(pressTimer);pressTimer=setTimeout(()=>{suppressClick=true;toggle(idx);},550);},{passive:true});
    ['touchend','touchcancel'].forEach(ev=>el.addEventListener(ev,()=>clearTimeout(pressTimer),{passive:true}));
    el.addEventListener('click',e=>{if(suppressClick){e.preventDefault();e.stopPropagation();suppressClick=false;}});
  });
}
function install(){
  ensureStyle();
  window.__worshipMergeRefresh=render;
  const previous=window.__worshipRenderLibrary;
  if(typeof previous==='function'&&!previous.__mergeWrapped){
    const wrapped=function(){const r=previous.apply(this,arguments);setTimeout(render,0);return r;};
    wrapped.__mergeWrapped=true;window.__worshipRenderLibrary=wrapped;
  }
  const box=getBox();
  if(box){render();return;}
  const mo=new MutationObserver(()=>{const b=getBox();if(b){mo.disconnect();render();}});
  mo.observe(document.body,{childList:true,subtree:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
