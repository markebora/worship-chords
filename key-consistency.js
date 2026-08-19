(function(){
'use strict';

/* KEY CONSISTENCY PATCH
   The displayed Key is derived from the actual chord shapes in the song,
   NOT from a website's metadata / "Key of ..." label.

   This is intentional for capo songs:
     Ultimate Guitar: Key D, Capo 2
     Chord shapes in the lyrics: C G Am F
     App Key: C

   The transpose engine works from the chord shapes shown in the app.
*/
const KEY_NAMES=['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'];

function keyNormalize(k){
  const x=String(k||'').trim();
  const aliases={'A#':'Bb','D#':'Eb','Db':'C#','G#':'Ab','Gb':'F#'};
  return aliases[x] || (KEY_NAMES.includes(x)?x:'');
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
  }catch(e){
    return {base:{},arrangement:[],currentKey:'',title:'Imported Song',artist:'Unknown Artist'};
  }
}

function setCurrentKey(k){
  const key=keyNormalize(k);
  if(!key)return '';
  try{window.eval('currentKey='+JSON.stringify(key));}catch(e){}
  return key;
}

/* Detect the key from the chords currently displayed in the song. */
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

/*
   IMPORTANT:
   Never prefer imported/page metadata here.
   The chords are the source of truth for the app's displayed Key.
*/
function chooseKey(preferred){
  const detected=detectKeyFromBase();
  if(detected)return detected;
  const p=keyNormalize(preferred);
  if(p)return p;
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
  Object.keys(ids).forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=ids[id];});
  return k;
}

function syncUI(){
  const s=getState();
  /* Re-detect from the current chord shapes every time the song is rendered. */
  const detected=detectKeyFromBase();
  const k=detected || keyNormalize(s.currentKey) || 'C';
  return setMeta(s.title,s.artist,k);
}

function saveCurrentKeyToStorage(){
  try{
    const raw=localStorage.getItem('worshipChordsCurrentSong');
    if(raw){
      const song=JSON.parse(raw);
      const detected=detectKeyFromBase();
      song.key=detected || chooseKey(song.key||getState().currentKey);
      localStorage.setItem('worshipChordsCurrentSong',JSON.stringify(song));
    }
  }catch(e){}
}

/* Saved-song Open: restore chords first, then derive the Key from those chords. */
window.__worshipOpenSaved=function(i){
  try{
    const list=JSON.parse(localStorage.getItem('worshipChordsSongs')||'[]');
    const s=list[i];
    if(!s)return;
    const sections=s.sections||{};
    const order=Array.isArray(s.arrangement)&&s.arrangement.length?s.arrangement:Object.keys(sections);

    window.eval(
      'base='+JSON.stringify(sections)+';'+
      'transposeSource=JSON.parse(JSON.stringify(base));'+
      'arrangement='+JSON.stringify(order)+';'+
      'activeSection=arrangement[0]||\'Verse 1\';'
    );

    /* Ignore s.key here. It may be the original website's key metadata. */
    const key=detectKeyFromBase() || keyNormalize(s.key) || 'C';
    const title=s.title||'Imported Song';
    const artist=s.artist||'Unknown Artist';

    setMeta(title,artist,key);
    localStorage.setItem('worshipChordsCurrentSong',JSON.stringify(Object.assign({},s,{key:key,arrangement:order,sections:sections})));
    if(typeof window.renderSong==='function')window.renderSong();
    if(typeof window.showTab==='function')window.showTab('song');
    syncUI();
    if(typeof window.toast==='function')window.toast('Song opened in key of '+key);
  }catch(e){console.error('Key consistency: open failed',e);}
};

/* Ordinary Open button: derive the Key from the displayed chords. */
window.openSong=function(){
  syncUI();
  if(typeof window.showTab==='function')window.showTab('song');
  syncUI();
};

/* Save with the same chord-derived key that the UI uses. */
const originalSave=window.saveLocal;
window.saveLocal=function(show){
  syncUI();
  saveCurrentKeyToStorage();
  if(typeof originalSave==='function')return originalSave(show);
};

/* Repair the state after the existing importer/song-manager listener finishes. */
window.addEventListener('worshipchords:song-imported',function(){
  setTimeout(function(){
    const s=getState();
    const key=detectKeyFromBase() || keyNormalize(s.currentKey) || 'C';
    setMeta(s.title,s.artist,key);
    saveCurrentKeyToStorage();
    if(typeof window.renderSong==='function')window.renderSong();
    syncUI();
  },0);
});

function install(){
  syncUI();
  if(typeof window.__worshipRenderLibrary==='function')window.__worshipRenderLibrary();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
setTimeout(install,50);
setTimeout(install,250);

})();
