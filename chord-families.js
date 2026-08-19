(function(){
'use strict';

/* CHORD FAMILY / CHORD PARSER
   A chord is parsed as:
   ROOT + SUFFIX + optional /BASS.
   The suffix is intentionally preserved instead of using a fixed chord list.
   This allows CM7, D/C, Bm7, E7sus, F#dim7, Cmaj7/E, etc.
*/
const ROOTS=['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
const MAJOR_INTERVALS=[0,2,4,5,7,9,11];
const MINOR_INTERVALS=[0,2,3,5,7,8,10];
const PC={C:0,'C#':1,Db:1,D:2,'D#':3,Eb:3,E:4,F:5,'F#':6,Gb:6,G:7,'G#':8,Ab:8,A:9,'A#':10,Bb:10,B:11};

function normalizeRoot(r){
  return ({'C#':'C#','Db':'C#','D#':'Eb','Eb':'Eb','Gb':'F#','G#':'Ab','Ab':'Ab','A#':'Bb','Bb':'Bb'})[r]||r;
}
function pc(r){return PC[r]===undefined?null:PC[r];}

/* Accepts the common worship chord grammar without enumerating every chord. */
const CHORD_RE=/^([A-G](?:#|b)?)([^/\s]*)(?:\/([A-G](?:#|b)?))?$/;
function parseChord(token){
  const text=String(token||'').trim().replace(/♯/g,'#').replace(/♭/g,'b');
  const m=text.match(CHORD_RE);
  if(!m || pc(normalizeRoot(m[1]))===null)return null;
  const root=normalizeRoot(m[1]);
  const bass=m[3]?normalizeRoot(m[3]):'';
  return {raw:text,root,rootPitch:pc(root),suffix:m[2]||'',bass:bass,bassPitch:bass?pc(bass):null,
    quality: /^(?:m|min)(?!aj)/i.test(m[2]||'')?'minor':(/dim|°/i.test(m[2]||'')?'diminished':(/aug|\+/i.test(m[2]||'')?'augmented':'major'))};
}

function rootOf(c){const p=parseChord(c);return p?p.root:'';}
function qualityOf(c){const p=parseChord(c);return p?p.quality:'major';}
function familyForKey(root,mode){const r=pc(root),ints=mode==='minor'?MINOR_INTERVALS:MAJOR_INTERVALS;return ints.map(n=>ROOTS.find(x=>pc(x)===(r+n)%12)||'').filter(Boolean);}

function extractChordTokens(sections){
  const out=[];
  const seen=new Set();
  function add(x){const p=parseChord(x);if(p&&!seen.has(p.raw)){seen.add(p.raw);out.push(p.raw);}}
  function walk(v){
    if(typeof v==='string'){
      /* Capture slash chords and arbitrary suffixes, but avoid ordinary words. */
      const parts=v.match(/(?:^|\s|\|)([A-G](?:#|b)?[^\s|]*)(?=\s|\||$)/g)||[];
      parts.forEach(raw=>{
        const token=raw.trim().replace(/^\|/,'');
        if(parseChord(token))add(token);
      });
      return;
    }
    if(Array.isArray(v)){v.forEach(walk);return;}
    if(v&&typeof v==='object')Object.values(v).forEach(walk);
  }
  walk(sections);
  return out;
}

function detectKey(sections){
  const chords=extractChordTokens(sections), roots=chords.map(rootOf).filter(Boolean);
  if(!roots.length)return{key:'',mode:'major',score:0,family:[]};
  const counts={};roots.forEach(r=>counts[r]=(counts[r]||0)+1);
  const candidates=[];
  for(const root of ROOTS)for(const mode of ['major','minor']){
    const family=familyForKey(root,mode);let score=0;
    for(const chord of chords){
      const cr=rootOf(chord),q=qualityOf(chord),idx=family.indexOf(cr);if(idx<0)continue;
      const w=mode==='major'?[6,1,2,3,5,2,1]:[6,1,3,2,5,3,1];
      score+=w[idx];
      if(cr===root)score+=10;
      if(q==='minor'&&mode==='major'&&[1,2,5].includes(idx))score+=2;
      if(q==='minor'&&mode==='minor'&&[0,2,5].includes(idx))score+=2;
      if(q==='diminished'&&idx===6)score+=2;
    }
    score+=(counts[root]||0)*12;
    if(roots[0]===root)score+=18;
    if(roots[roots.length-1]===root)score+=18;
    if(mode==='major'){
      const tonic=family[0],sub=family[3],dom=family[4];
      for(let i=0;i<roots.length-1;i++){
        if(roots[i]===tonic&&roots[i+1]===sub)score+=8;
        if(roots[i]===tonic&&roots[i+1]===dom)score+=8;
        if(roots[i]===dom&&roots[i+1]===tonic)score+=10;
      }
    }
    candidates.push({key:root+(mode==='minor'?'m':''),mode,score,family});
  }
  candidates.sort((a,b)=>b.score-a.score);return candidates[0];
}

window.WorshipChordFamilies={ROOTS,MAJOR_INTERVALS,MINOR_INTERVALS,familyForKey,detectKey,collectChords:extractChordTokens,parseChord,rootOf,qualityOf};
window.WorshipChordParser={parse:parseChord,isChord:function(x){return !!parseChord(x)}};
})();
