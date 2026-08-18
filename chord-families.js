(function(){
'use strict';

const ROOTS=['C','Db','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
const MAJOR_INTERVALS=[0,2,4,5,7,9,11];
const MINOR_INTERVALS=[0,2,3,5,7,8,10];
const MINOR_NAMES=['Am','Bbm','Bm','Cm','C#m','Dm','Ebm','Em','Fm','F#m','Gm','G#m'];

function pc(root){
  const map={C:0,'C#':1,Db:1,D:2,'D#':3,Eb:3,E:4,F:5,'F#':6,Gb:6,G:7,'G#':8,Ab:8,A:9,'A#':10,Bb:10,B:11};
  return map[root];
}
function rootOf(chord){
  const m=String(chord||'').trim().match(/^([A-G](?:#|b)?)/);
  return m?m[1]:'';
}
function qualityOf(chord){
  const s=String(chord||'').trim().replace(/^[A-G](?:#|b)?/,'');
  if(/^m(?!aj)/i.test(s)||/min/i.test(s))return 'minor';
  if(/dim|°/i.test(s))return 'diminished';
  return 'major';
}
function normalizeRoot(root){
  const enh={ 'C#':'Db','D#':'Eb','G#':'Ab','A#':'Bb','F#':'F#' };
  return enh[root]||root;
}
function familyForKey(root,mode){
  const r=pc(root), ints=mode==='minor'?MINOR_INTERVALS:MAJOR_INTERVALS;
  return ints.map((n,i)=>ROOTS.find(x=>pc(x)===(r+n)%12)||'').filter(Boolean);
}
function collectChords(sections){
  const out=[];
  function walk(v){
    if(Array.isArray(v)){ if(typeof v[0]==='string') out.push(v[0]); else v.forEach(walk); }
    else if(v&&typeof v==='object')Object.values(v).forEach(walk);
  }
  walk(sections);
  return out.join(' ').split(/\s+/).map(x=>x.replace(/[^A-G#b/0-9a-z°]/gi,'')).filter(x=>/^[A-G](?:#|b)?/.test(x));
}
function detectKey(sections){
  const chords=collectChords(sections);
  const roots=chords.map(rootOf).filter(Boolean).map(normalizeRoot);
  if(!roots.length)return {key:'',mode:'major',score:0,family:[]};
  const counts={};roots.forEach(r=>counts[r]=(counts[r]||0)+1);
  const candidates=[];
  for(const root of ROOTS){
    for(const mode of ['major','minor']){
      const family=familyForKey(root,mode), tonic=root;
      let score=0;
      for(const chord of chords){
        const cr=normalizeRoot(rootOf(chord)), q=qualityOf(chord);
        const index=family.indexOf(cr);
        if(index<0)continue;
        const degreeWeight=mode==='major'?[5,2,2,4,5,3,1][index]:[5,2,4,2,5,4,1][index];
        score+=degreeWeight;
        if(cr===tonic)score+=2;
        if((mode==='major'&&q==='minor'&&[1,2,5].includes(index))||(mode==='minor'&&q==='minor'&&[0,2,5].includes(index)))score+=2;
        if(q==='diminished'&&index===6)score+=2;
      }
      candidates.push({key:root+(mode==='minor'?'m':''),mode,score,family});
    }
  }
  candidates.sort((a,b)=>b.score-a.score);
  return candidates[0]||{key:'',mode:'major',score:0,family:[]};
}
window.WorshipChordFamilies={ROOTS,MAJOR_INTERVALS,MINOR_INTERVALS,familyForKey,detectKey,collectChords};
})();
