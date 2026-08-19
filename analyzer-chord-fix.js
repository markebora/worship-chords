(function(){
'use strict';

// Analyzer-only fix: teach the existing analyzer how to recognize
// chord-only lines containing multiple chords and extended chords.
// This deliberately leaves the transpose/key engine untouched.

const CHORD_RE=/^[A-G](?:#|b)?(?:m|min|maj|dim|aug|sus|add)?\d*(?:[#b]\d+)?(?:\/[A-G](?:#|b)?)?$/i;
const EXTENSION_RE=/^[#b]\d+$/i;

function isChordToken(value){
  return CHORD_RE.test(String(value||'').trim());
}

function expandChordOnlyRows(){
  if(!window.base || typeof window.base!=='object') return;

  for(const part of Object.keys(window.base)){
    const rows=Array.isArray(window.base[part]) ? window.base[part] : [];
    const out=[];

    for(const row of rows){
      const chord=String(row?.[0]??'').trim();
      let lyric=String(row?.[1]??'').trim();

      if(!chord){
        out.push(row);
        continue;
      }

      const words=lyric ? lyric.split(/\s+/).filter(Boolean) : [];

      // The old analyzer may parse E7#9 as chord=E7, lyric=#9.
      // Reattach the extension before testing the remaining tokens.
      let firstChord=chord;
      let start=0;
      if(words.length && EXTENSION_RE.test(words[0])){
        const combined=chord+words[0];
        if(isChordToken(combined)){
          firstChord=combined;
          start=1;
        }
      }

      const remaining=words.slice(start);

      // If everything after the first detected chord is also a chord,
      // this was a chord-only line. Split it into real chord rows.
      if(isChordToken(firstChord) && (!lyric || remaining.length===0 || remaining.every(isChordToken))){
        out.push([firstChord,'']);
        for(const token of remaining) out.push([token,'']);
        continue;
      }

      out.push([chord,lyric]);
    }

    window.base[part]=out;
  }

  if(typeof window.compactChordOnlyLines==='function'){
    window.compactChordOnlyLines();
  }

  if(typeof window.detectKey==='function'){
    window.currentKey=window.detectKey();
  }

  if(typeof window.transposeSource!=='undefined'){
    window.transposeSource=JSON.parse(JSON.stringify(window.base));
  }

  if(typeof window.renderSong==='function'){
    window.renderSong();
  }
}

function install(){
  if(typeof window.analyzeSong!=='function'){
    setTimeout(install,50);
    return;
  }
  if(window.__worshipChordAnalyzerFixInstalled) return;
  window.__worshipChordAnalyzerFixInstalled=true;

  const originalAnalyze=window.analyzeSong;
  window.analyzeSong=function(){
    const result=originalAnalyze.apply(this,arguments);
    try{ expandChordOnlyRows(); }catch(error){ console.warn('Analyzer chord normalization failed:',error); }
    return result;
  };
}

install();
})();
