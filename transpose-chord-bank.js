(function(){
'use strict';

/* =========================================================
   CHORD BANK — SINGLE SOURCE OF TRUTH FOR TRANSPOSITION
   =========================================================
   The bank stores pitch classes only. Chord quality/extensions
   are preserved exactly as written; only root and slash-bass
   pitches are moved.
*/
const CHORD_BANK={
  roots:{
    C:0,'C#':1,Db:1,D:2,'D#':3,Eb:3,E:4,F:5,
    'F#':6,Gb:6,G:7,'G#':8,Ab:8,A:9,'A#':10,
    Bb:10,B:11
  },
  display:['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B']
};

function cbNormalize(s){
  return String(s).replace(/♯/g,'#').replace(/♭/g,'b');
}

function cbPitch(root){
  root=cbNormalize(root);
  return Object.prototype.hasOwnProperty.call(CHORD_BANK.roots,root)
    ? CHORD_BANK.roots[root] : null;
}

function cbDisplay(pitch){
  return CHORD_BANK.display[((pitch%12)+12)%12];
}

function cbTransposeToken(token,interval){
  const text=cbNormalize(token);
  const match=text.match(/^([A-G](?:#|b)?)(.*)$/);
  if(!match) return token;

  const rootPitch=cbPitch(match[1]);
  if(rootPitch===null) return token;

  let suffix=match[2];
  suffix=suffix.replace(/\/([A-G](?:#|b)?)/g,function(full,bass){
    const bassPitch=cbPitch(bass);
    return bassPitch===null ? full : '/'+cbDisplay(bassPitch+interval);
  });

  return cbDisplay(rootPitch+interval)+suffix;
}

/*
  Transposes every chord token in a field. This fixes lines such as:
  "Fdim C# G#" without changing the spaces between chords.
*/
window.transposeChord=function(chord,interval){
  if(chord==null) return chord;
  return String(chord)
    .split(/(\s+)/)
    .map(function(part){
      return /^\s+$/.test(part) ? part : cbTransposeToken(part,interval);
    })
    .join('');
};

window.CHORD_BANK=CHORD_BANK;
})();
