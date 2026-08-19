(function(){
'use strict';

const IMPORT_API='https://worship-chords-rho.vercel.app/api/import';

function normalizeImportedSongText(text){
 return String(text||'')
  .replace(/&ndash;|&#8211;|&#x2013;/gi,'–')
  .replace(/&mdash;|&#8212;|&#x2014;/gi,'—')
  .split('\n')
  .map(line=>normalizeChordSeparatorLine(line))
  .join('\n');
}

function normalizeChordSeparatorLine(line){
 const trimmed=line.trim();
 if(!trimmed) return line;

 const chordToken='[A-G](?:#|b)?(?:m|min|maj|dim|aug|sus|add)?\\d*(?:[#b]\\d+)?(?:/[A-G](?:#|b)?)?';
 const chordRe=new RegExp('^'+chordToken+'$','i');
 const separatorRe=/\\s*(?:-|–|—)\\s*/g;

 if(!/(?:-|–|—)/.test(trimmed)) return line;
 const parts=trimmed.split(separatorRe);
 if(parts.length<2 || !parts.every(part=>chordRe.test(part.trim()))) return line;

 const indent=line.match(/^\\s*/)?.[0]||'';
 return indent+parts.map(part=>part.trim()).join('   ');
}

function install(){
 if(document.getElementById('song-import-panel')) return;
 const panel=document.createElement('section');
 panel.id='song-import-panel';
 panel.style.cssText='margin:18px 0;padding:16px;border:1px solid #293039;border-radius:12px;background:#151a20';
 panel.innerHTML='<div style="font-size:18px;font-weight:800;margin-bottom:6px">Import Song</div><div style="color:#929ca6;font-size:13px;margin-bottom:12px">Paste an Ultimate Guitar chord-page link.</div><div style="display:flex;gap:8px;flex-wrap:wrap"><input id="ug-url" type="url" placeholder="https://tabs.ultimate-guitar.com/..." style="flex:1;min-width:260px;padding:11px;border-radius:9px;border:1px solid #3a424b;background:#0f1317;color:#fff"><button id="ug-load" class="btn primary" type="button">Load Song</button></div><div id="ug-status" class="muted" style="margin-top:10px"></div><div id="ug-content-wrap" style="display:none;margin-top:14px"><div style="font-weight:700;margin-bottom:6px">Song Content</div><textarea id="ug-content" rows="12" placeholder="Loaded song content will appear here." style="width:100%;padding:12px;border-radius:9px;border:1px solid #3a424b;background:#0f1317;color:#fff;resize:vertical"></textarea><button id="ug-analyze" class="btn primary" type="button" style="margin-top:10px">🤖 Analyze Song</button></div>';
 const main=document.querySelector('main')||document.body; main.insertBefore(panel,main.firstChild);
 const status=document.getElementById('ug-status');
 const wrap=document.getElementById('ug-content-wrap');
 const content=document.getElementById('ug-content');

 document.getElementById('ug-load').onclick=async function(){
  const url=document.getElementById('ug-url').value.trim();
  if(!/^https?:\/\/(www\.)?(tabs\.)?ultimate-guitar\.com\//i.test(url)){
   status.textContent='Please paste a valid Ultimate Guitar chord-page link.';
   return;
  }

  const button=document.getElementById('ug-load');
  button.disabled=true;
  button.textContent='Loading...';
  status.textContent='⏳ Fetching song content from the importer...';
  wrap.style.display='none';
  content.value='';

  try{
   const response=await fetch(IMPORT_API,{
    method:'POST',
    headers:{'Content-Type':'application/json','Accept':'application/json'},
    body:JSON.stringify({url:url})
   });

   const raw=await response.text();
   let data={};
   try{data=JSON.parse(raw);}catch(e){
    throw new Error('The backend returned an unexpected response. Please check the Vercel deployment.');
   }

   if(!response.ok) throw new Error(data.error||('Importer returned HTTP '+response.status));
   if(!data.text) throw new Error('The importer returned no readable song content.');

   const normalizedText=normalizeImportedSongText(data.text);
   localStorage.setItem('worshipChordsSourceUrl',data.sourceUrl||url);
   localStorage.setItem('worshipChordsImportedText',normalizedText);
   content.value=normalizedText;
   wrap.style.display='block';
   status.textContent='✅ Song loaded successfully. The content is ready for AI analysis.';
   content.focus();
  }catch(error){
   status.textContent='⚠️ '+(error.message||'Could not load the song.');
   wrap.style.display='block';
  }finally{
   button.disabled=false;
   button.textContent='Load Song';
  }
 };

 document.getElementById('ug-analyze').onclick=function(){
  const text=normalizeImportedSongText(content.value.trim());
  if(!text){status.textContent='No song content is available to analyze.';return;}
  content.value=text;
  localStorage.setItem('worshipChordsImportedText',text);
  window.dispatchEvent(new CustomEvent('worshipchords:song-imported',{
   detail:{sourceUrl:document.getElementById('ug-url').value.trim(),text:text}
  }));
  status.textContent='Song content is ready for the AI analyzer.';
 };
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install); else install();
})();
