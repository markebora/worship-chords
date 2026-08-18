(function(){
'use strict';

/* CHORD BANK — SINGLE SOURCE OF TRUTH FOR TRANSPOSITION */
const CHORD_BANK={
  roots:{C:0,'C#':1,Db:1,D:2,'D#':3,Eb:3,E:4,F:5,'F#':6,Gb:6,G:7,'G#':8,Ab:8,A:9,'A#':10,Bb:10,B:11},
  display:['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B']
};

function cbNormalize(s){
  return String(s).replace(/♯/g,'#').replace(/♭/g,'b');
}
function cbPitch(root){
  root=cbNormalize(root);
  return Object.prototype.hasOwnProperty.call(CHORD_BANK.roots,root)?CHORD_BANK.roots[root]:null;
}
function cbDisplay(n){return CHORD_BANK.display[((n%12)+12)%12];}

/*
  Parse a chord token using the bank only.
  Root is ALWAYS the first A-G note plus optional #/b.
  Everything after it is preserved as the chord quality/extension.
  A slash bass is independently transposed.
*/
function cbTransposeToken(token,interval){
  const original=String(token);
  const text=cbNormalize(original);
  const match=text.match(/^([A-G](?:#|b)?)(.*)$/);
  if(!match) return original;

  const rootPitch=cbPitch(match[1]);
  if(rootPitch===null) return original;

  let suffix=match[2];
  suffix=suffix.replace(/\/([A-G](?:#|b)?)(?=$|[^A-Za-z])/g,function(full,bass){
    const p=cbPitch(bass);
    return p===null?full:'/'+cbDisplay(p+interval);
  });

  return cbDisplay(rootPitch+interval)+suffix;
}

window.transposeChord=function(chord,interval){
  if(chord==null) return chord;
  return String(chord).split(/(\s+)/).map(function(part){
    return /^\s+$/.test(part)?part:cbTransposeToken(part,interval);
  }).join('');
};
window.CHORD_BANK=CHORD_BANK;
})();
