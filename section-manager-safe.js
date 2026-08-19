(function(){
'use strict';

/* Safe section controls: no MutationObserver, no polling, no page-wide DOM watcher. */
var installed=false;
function getBase(){try{return JSON.parse(window.eval('JSON.stringify(base)'));}catch(e){return null;}}
function setBase(obj){
  window.eval('base='+JSON.stringify(obj)+'; transposeSource=JSON.parse(JSON.stringify(base)); arrangement=Object.keys(base); activeSection=arrangement[0]||Object.keys(base)[0]||\'Verse 1\';');
}
function cleanName(name){return String(name||'').replace(/__WC_DUP_[0-9]+$/,'');}
function render(){if(typeof window.renderSong==='function')window.renderSong();}
function refreshLabels(){
  var tabs=document.getElementById('tabs'); if(!tabs)return;
  tabs.querySelectorAll('button[data-wc-section]').forEach(function(b){b.textContent=cleanName(b.dataset.wcSection);});
}
function addControls(){
  var tabs=document.getElementById('tabs'); if(!tabs)return;
  tabs.querySelectorAll('button').forEach(function(tab){
    if(tab.dataset.wcEnhanced==='1')return;
    var raw=tab.dataset.section || tab.getAttribute('data-section') || tab.textContent.trim();
    if(!raw)return;
    tab.dataset.wcSection=raw;
    tab.dataset.wcEnhanced='1';
    var wrap=document.createSpan ? document.createSpan() : document.createElement('span');
    wrap.style.display='inline-flex';wrap.style.alignItems='center';wrap.style.gap='3px';
    tab.parentNode.insertBefore(wrap,tab);wrap.appendChild(tab);
    var dup=document.createElement('button');
    dup.type='button';dup.className='btn';dup.textContent='⧉';dup.title='Duplicate '+cleanName(raw);dup.style.cssText='padding:6px 8px;font-size:12px;display:none';
    dup.onclick=function(e){e.preventDefault();e.stopPropagation();duplicate(raw);};
    var del=document.createElement('button');
    del.type='button';del.className='btn';del.textContent='×';del.title='Delete '+cleanName(raw);del.style.cssText='padding:6px 8px;font-size:12px;display:none';
    del.onclick=function(e){e.preventDefault();e.stopPropagation();remove(raw);};
    wrap.appendChild(dup);wrap.appendChild(del);
    tab.dataset.wcDupButton=dup;tab.dataset.wcDelButton=del;
  });
  var editing=document.body.classList.contains('editMode');
  tabs.querySelectorAll('button[data-wc-section]').forEach(function(tab){
    var d=tab.dataset.wcDupButton,x=tab.dataset.wcDelButton;
    if(d)d.style.display=editing?'inline-block':'none';
    if(x)x.style.display=editing?'inline-block':'none';
  });
  refreshLabels();
}
function duplicate(raw){
  var base=getBase(); if(!base||!Object.prototype.hasOwnProperty.call(base,raw))return;
  var copy=JSON.parse(JSON.stringify(base[raw]));
  var unique=raw+'__WC_DUP_'+Date.now();
  var out={};
  Object.keys(base).forEach(function(k){out[k]=base[k];if(k===raw)out[unique]=copy;});
  setBase(out);render();setTimeout(addControls,0);
}
function remove(raw){
  var base=getBase();if(!base||!Object.prototype.hasOwnProperty.call(base,raw))return;
  var keys=Object.keys(base);if(keys.length<=1){alert('A song must keep at least one section.');return;}
  if(!confirm('Delete the entire '+cleanName(raw)+' section, including its chords and lyrics?'))return;
  var out={};keys.forEach(function(k){if(k!==raw)out[k]=base[k];});
  setBase(out);render();setTimeout(addControls,0);
}
function hook(){
  if(installed)return;installed=true;
  /* Wrap renderSong once so controls are recreated only when the app renders. */
  var tries=0;
  function installWhenReady(){
    if(typeof window.renderSong==='function'){
      var original=window.renderSong;
      window.renderSong=function(){var r=original.apply(this,arguments);try{setTimeout(addControls,0);}catch(e){}return r;};
      addControls();
      return;
    }
    if(++tries<100)setTimeout(installWhenReady,50);
  }
  installWhenReady();
  document.addEventListener('click',function(e){
    if(e.target && e.target.id==='editBtn')setTimeout(addControls,0);
  });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',hook);else hook();
})();
