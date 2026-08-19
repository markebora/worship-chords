(function(){
'use strict';
var installed=false;
function getBase(){try{return JSON.parse(window.eval('JSON.stringify(base)'));}catch(e){return null;}}
function setBase(obj){window.eval('base='+JSON.stringify(obj)+'; transposeSource=JSON.parse(JSON.stringify(base)); arrangement=Object.keys(base);');}
function displayName(name){return String(name||'').replace(/\u200B/g,'');}
function render(){if(typeof window.renderSong==='function')window.renderSong();}
function addControls(){
  var tabs=document.getElementById('tabs'); if(!tabs)return;
  tabs.querySelectorAll('button').forEach(function(tab){
    if(tab.dataset.wcEnhanced==='1')return;
    var raw=tab.dataset.section || tab.getAttribute('data-section') || tab.textContent.trim();
    if(!raw)return;
    tab.dataset.wcSection=raw;
    tab.dataset.wcEnhanced='1';
    var wrap=document.createElement('span');
    wrap.style.cssText='display:inline-flex;align-items:center;gap:3px';
    tab.parentNode.insertBefore(wrap,tab);wrap.appendChild(tab);
    var dup=document.createElement('button');
    dup.type='button';dup.className='btn';dup.textContent='⧉';dup.title='Duplicate '+displayName(raw);dup.style.cssText='padding:6px 8px;font-size:12px;display:none';
    dup.onclick=function(e){e.preventDefault();e.stopPropagation();duplicate(raw);};
    var del=document.createElement('button');
    del.type='button';del.className='btn';del.textContent='×';del.title='Delete '+displayName(raw);del.style.cssText='padding:6px 8px;font-size:12px;display:none';
    del.onclick=function(e){e.preventDefault();e.stopPropagation();remove(raw);};
    wrap.appendChild(dup);wrap.appendChild(del);
    tab._wcDupButton=dup;tab._wcDelButton=del;
  });
  var editing=document.body.classList.contains('editMode');
  tabs.querySelectorAll('button[data-wc-section]').forEach(function(tab){
    if(tab._wcDupButton)tab._wcDupButton.style.display=editing?'inline-block':'none';
    if(tab._wcDelButton)tab._wcDelButton.style.display=editing?'inline-block':'none';
  });
}
function duplicate(raw){
  var base=getBase(); if(!base||!Object.prototype.hasOwnProperty.call(base,raw))return;
  var copy=JSON.parse(JSON.stringify(base[raw]));
  /* Zero-width suffix keeps the internal key unique while displaying the exact same name. */
  var unique=raw+'\u200B'.repeat(Date.now()%97+1);
  while(Object.prototype.hasOwnProperty.call(base,unique))unique+='\u200B';
  var out={};
  Object.keys(base).forEach(function(k){out[k]=base[k];if(k===raw)out[unique]=copy;});
  setBase(out);render();
}
function remove(raw){
  var base=getBase();if(!base||!Object.prototype.hasOwnProperty.call(base,raw))return;
  var keys=Object.keys(base);if(keys.length<=1){alert('A song must keep at least one section.');return;}
  if(!confirm('Delete the entire '+displayName(raw)+' section, including its chords and lyrics?'))return;
  var out={};keys.forEach(function(k){if(k!==raw)out[k]=base[k];});
  setBase(out);render();
}
function hook(){
  if(installed)return;installed=true;
  var tries=0;
  function installWhenReady(){
    if(typeof window.renderSong==='function'){
      var original=window.renderSong;
      window.renderSong=function(){var r=original.apply(this,arguments);addControls();return r;};
      addControls();return;
    }
    if(++tries<100)setTimeout(installWhenReady,50);
  }
  installWhenReady();
  document.addEventListener('click',function(e){if(e.target&&e.target.id==='editBtn')setTimeout(addControls,0);});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',hook);else hook();
})();
