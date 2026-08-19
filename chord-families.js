(function(){
'use strict';
const ROOTS=['C','Db','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
const MAJOR_INTERVALS=[0,2,4,5,7,9,11],MINOR_INTERVALS=[0,2,3,5,7,8,10];
function pc(root){const map={C:0,'C#':1,Db:1,D:2,'D#':3,Eb:3,E:4,F:5,'F#':6,Gb:6,G:7,'G#':8,Ab:8,A:9,'A#':10,Bb:10,B:11};return map[root];}
function rootOf(chord){const m=String(chord||'').trim().match(/^([A-G](?:#|b)?)/);return m?m[1]:'';}
function qualityOf(chord){const s=String(chord||'').trim().replace(/^[A-G](?:#|b)?/,'');if(/^m(?!aj)/i.test(s)||/min/i.test(s))return 'minor';if(/dim|°/i.test(s))return 'diminished';return 'major';}
function normalizeRoot(root){const enh={'C#':'Db','D#':'Eb','G#':'Ab','A#':'Bb','Gb':'F#'};return enh[root]||root;}
function familyForKey(root,mode){const r=pc(root),ints=mode==='minor'?MINOR_INTERVALS:MAJOR_INTERVALS;return ints.map(n=>ROOTS.find(x=>pc(x)===(r+n)%12)||'').filter(Boolean);}
function extractChordTokens(sections){const out=[];function walk(v){if(typeof v==='string'){const parts=v.match(/\b[A-G](?:#|b)?(?:m|min|maj|dim|aug|sus|add)?\d*(?:\/[A-G](?:#|b)?)?\b/g)||[];parts.forEach(x=>out.push(x));return;}if(Array.isArray(v)){v.forEach(walk);return;}if(v&&typeof v==='object')Object.values(v).forEach(walk);}walk(sections);return out;}
function detectKey(sections){const chords=extractChordTokens(sections),roots=chords.map(rootOf).filter(Boolean).map(normalizeRoot);if(!roots.length)return{key:'',mode:'major',score:0,family:[]};const counts={};roots.forEach(r=>counts[r]=(counts[r]||0)+1);const candidates=[];for(const root of ROOTS){for(const mode of ['major','minor']){const family=familyForKey(root,mode);let score=0;for(const chord of chords){const cr=normalizeRoot(rootOf(chord)),q=qualityOf(chord),idx=family.indexOf(cr);if(idx<0)continue;const weights=mode==='major'?[9,2,3,4,8,3,1]:[9,2,4,3,8,4,1];score+=weights[idx];if(cr===root)score+=counts[cr]*4;if(q==='minor'&&mode==='major'&&[1,2,5].includes(idx))score+=2;if(q==='minor'&&mode==='minor'&&[0,2,5].includes(idx))score+=2;if(q==='diminished'&&idx===6)score+=3;}score+=((counts[root]||0)*8);candidates.push({key:root+(mode==='minor'?'m':''),mode,score,family});}}candidates.sort((a,b)=>b.score-a.score);return candidates[0];}
window.WorshipChordFamilies={ROOTS,MAJOR_INTERVALS,MINOR_INTERVALS,familyForKey,detectKey,collectChords:extractChordTokens};
})();
