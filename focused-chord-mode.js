(function(){
'use strict';

// Chord-focused analysis for Intro, Interlude, Instrumental, Adlib and Outro.
// It preprocesses chord progressions before the legacy analyzer sees them,
// while leaving the protected key/transpose engine untouched.

const SECTION_RE=/^(intro|verse(?:\s*\d+)?|pre[- ]?chorus|chorus|bridge|tag|ad[- ]?lib|adlib|interlude|instrumental|outro)$/i;
const FOCUS=/^(intro|interlude|instrumental|ad[- ]?lib|adlib|outro)$/i;
const CHORD=/^[A-G](?:#|b)?(?:m|min|maj|dim|aug|sus|add)?\d*(?:[#b]\d+)?(?:\/[A-G](?:#|b)?)?$/i;

function normSection(s){
  return s.toLowerCase()
    .replace(/^pre chorus$/,'pre-chorus')
    .replace(/^prechorus$/,'pre-chorus')
    .replace(/^ad lib$/,'adlib')
    .replace(/^verse$/,'verse 1')
    .replace(/^./,c=>c.toUpperCase())
    .replace(/^Adlib$/,'Adlib')
    .replace(/^Pre-chorus$/,'Pre-Chorus');
}

function chordTokens(line){
  const normalized=String(line||'')
    .replace(/&ndash;|&#8211;|&#x2013;/gi,'–')
    .replace(/&mdash;|&#8212;|&#x2014;/gi,'—');
  const parts=normalized
    .split(/\s*(?:-|–|—)\s*|\s+/)
    .filter(Boolean);
  return parts.length>1 && parts.every(x=>CHORD.test(x)) ? parts : null;
}

function install(){
  if(typeof window.analyzeSong!=='function'){setTimeout(install,50);return;}
  if(window.__focusedChordAnalyzerInstalled)return;
  window.__focusedChordAnalyzerInstalled=true;

  const original=window.analyzeSong;

  window.analyzeSong=function(){
    const textarea=document.getElementById('songText');
    if(!textarea)return original.apply(this,arguments);

    const originalText=textarea.value;
    const lines=originalText.split(/\r?\n/);
    const out=[];
    const fixes=[];
    const sectionOrder=[];
    let section='Verse 1';
    let sectionRow=0;

    for(const raw of lines){
      const line=raw.replace(/\t/g,' ').trim();
      if(!line)continue;

      const marker=line.replace(/^\[|\]$/g,'').replace(/:$/,'').trim();
      if(SECTION_RE.test(marker)){
        section=normSection(marker);
        if(!sectionOrder.includes(section))sectionOrder.push(section);
        out.push(raw);
        sectionRow=0;
        continue;
      }

      if(FOCUS.test(section)){
        const tokens=chordTokens(line);
        if(tokens){
          for(const token of tokens){
            out.push(token);
            if(/[#b]\d+$/i.test(token)){
              fixes.push({section,row:sectionRow,token});
            }
            sectionRow++;
          }
          continue;
        }
      }

      out.push(raw);
      sectionRow++;
    }

    // Feed the legacy analyzer a chord-per-line representation only inside
    // chord-focused sections. This makes every chord a real chord row.
    textarea.value=out.join('\n');
    const result=original.apply(this,arguments);
    textarea.value=originalText;

    // The legacy regex does not preserve extensions such as E7#9. Restore
    // those exact spellings through the existing editing API.
    setTimeout(()=>{
      try{
        for(const fix of fixes){
          const pi=sectionOrder.indexOf(fix.section);
          if(pi<0 || typeof window.updateLine!=='function')continue;
          window.updateLine(pi,fix.row,0,fix.token);
          window.updateLine(pi,fix.row,1,'');
        }
      }catch(error){
        console.warn('Focused chord correction failed',error);
      }
    },0);

    return result;
  };
}

install();
})();
