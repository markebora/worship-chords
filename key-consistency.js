(function(){
'use strict';

/* =========================================================
   KEY CONSISTENCY PATCH
   ---------------------------------------------------------
   One authoritative key is used everywhere:
     - imported/analyzed song
     - song header
     - Library
     - saved song
     - reopened saved song

   This patch intentionally does NOT change transpose logic.
   ========================================================= */

const KEY_NAMES=['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
const KEY_PC={C:0,'C#':1,Db:1,D:2,'D#':3,Eb:3,E:4,F:5,'F#':6,Gb:6,G:7,'G#':8,Ab:8,A:9,'A#':10,Bb:10,B:11};

function keyNormalize(k){
  const x=String(k||'').trim();
  const aliases={A#:'Bb',D#:'Eb',Db:'C#',G#:'Ab',Gb:'F#'};
  return aliases[x]|| (KEY_NAMES.includes(x)?x:'');
}

function getState(){
  try{
    return {
      base:window.eval('JSON.parse(JSON.stringify(base))'),
      arrangement:window.eval('JSON.parse(JSON.stringify(arrangement))'),
      currentKey:window.eval('currentKey'),
      title:window.eval('currentSongTitle'),
      artist:window.eval('currentArtist')
    };
  }catch(e){return {base:{},arrangement:[],currentKey:'',title:'Imported Song',artist:'Unknown Artist'};}
}

function setCurrentKey(k){
  const key=keyNormalize(k);
  if(!key)return '';
  try{window.eval('currentKey='+JSON.stringify(key));}catch(e){}
  return key;
}

function detectKeyFromBase(){
  try{
    const b=getState().base;
    if(window.WorshipChordFamilies&&typeof window.WorshipChordFamilies.detectKey==='function'){
      const result=window.WorshipChordFamilies.detectKey(b);
      const detected=keyNormalize(result&&result.key);
      if(detected)return detected;
    }
  }catch(e){}
  return '';
}

function chooseKey(preferred){
  const p=keyNormalize(preferred);
  if(p)return p;
  const detected=detectKeyFromBase();
  if(detected)return detected;
  return 'C';
}

function setMeta(title,artist,key){
  const k=chooseKey(key);
  const t=String(title||'Imported Song').trim()||'Imported Song';
  const a=String(artist||'Unknown Artist').trim()||'Unknown Artist';
  try{
    window.eval('currentSongTitle='+JSON.stringify(t)+';currentArtist='+JSON.stringify(a));
  }catch(e){}
  setCurrentKey(k);
  const ids={songTitle:t,songArtist:a,key:k,libraryTitle:t,libraryArtist:a+' • Key '+k};
  Object.keys(ids).forEach(id=>{
    const el=document.getElementById(id);
    if(el)el.textContent=ids[id];
  });
  return k;
}

function syncUI(){
  const s=getState();
  const k=chooseKey(s.currentKey);
  setMeta(s.title,s.artist,k);
  return k;
}

function saveCurrentKeyToStorage(){
  try{
    const raw=localStorage.getItem('worshipChordsCurrentSong');
    if(raw){
      const song=JSON.parse(raw);
      song.key=chooseKey(song.key||getState().currentKey);
      localStorage.setItem('worshipChordsCurrentSong',JSON.stringify(song));
    }
  }catch(e){}
}

/* Saved-song Open: always restore the saved key BEFORE renderSong(). */
window.__worshipOpenSaved=function(i){
  try{
    const list=JSON.parse(localStorage.getItem('worshipChordsSongs')||'[]');
    const s=list[i];
    if(!s)return;

    const sections=s.sections||{};
    const order=Array.isArray(s.arrangement)&&s.arrangement.length?s.arrangement:Object.keys(sections);
    const key=chooseKey(s.key);
    const title=s.title||'Imported Song';
    const artist=s.artist||'Unknown Artist';

    window.eval(
      'base='+JSON.stringify(sections)+';'+
      'transposeSource=JSON.parse(JSON.stringify(base));'+
      'arrangement='+JSON.stringify(order)+';'+
      'activeSection=arrangement[0]||\'Verse 1\';'
    );

    setMeta(title,artist,key);
    localStorage.setItem('worshipChordsCurrentSong',JSON.stringify(Object.assign({},s,{key:key,arrangement:order,sections:sections})));

    if(typeof window.renderSong==='function')window.renderSong();
    if(typeof window.showTab==='function')window.showTab('song');
    syncUI();
    if(typeof window.toast==='function')window.toast('Song opened in key of '+key);
  }catch(e){console.error('Key consistency: open failed',e);}
};

/* Keep the app's ordinary Open button from changing the key. */
window.openSong=function(){
  syncUI();
  if(typeof window.showTab==='function')window.showTab('song');
  syncUI();
};

/* Ensure save uses the same key shown on screen. */
const originalSave=window.saveLocal;
window.saveLocal=function(show){
  const key=syncUI();
  saveCurrentKeyToStorage();
  if(typeof originalSave==='function')return originalSave(show);
};

/* The importer dispatches this event after AI/import analysis. The existing
   song-manager handler runs first; this listener then repairs the key state
   before the user sees the result. */
window.addEventListener('worshipchords:song-imported',function(){
  setTimeout(function(){
    const s=getState();
    const detected=chooseKey(s.currentKey||detectKeyFromBase());
    setMeta(s.title,s.artist,detected);
    saveCurrentKeyToStorage();
    if(typeof window.renderSong==='function')window.renderSong();
    syncUI();
  },0);
});

/* Initial repair after all existing modules have loaded. */
function install(){
  syncUI();
  if(typeof window.__worshipRenderLibrary==='function')window.__worshipRenderLibrary();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
setTimeout(install,50);
setTimeout(install,250);

})();
