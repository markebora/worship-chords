(function(){
'use strict';
function install(){
 if(document.getElementById('song-import-panel')) return;
 const panel=document.createElement('section');
 panel.id='song-import-panel';
 panel.style.cssText='margin:18px 0;padding:16px;border:1px solid #293039;border-radius:12px;background:#151a20';
 panel.innerHTML='<div style="font-size:18px;font-weight:800;margin-bottom:6px">Import Song</div><div style="color:#929ca6;font-size:13px;margin-bottom:12px">Paste an Ultimate Guitar chord-page link.</div><div style="display:flex;gap:8px;flex-wrap:wrap"><input id="ug-url" type="url" placeholder="https://tabs.ultimate-guitar.com/..." style="flex:1;min-width:260px;padding:11px;border-radius:9px;border:1px solid #3a424b;background:#0f1317;color:#fff"><button id="ug-load" class="btn primary" type="button">Load Song</button></div><div id="ug-status" class="muted" style="margin-top:10px"></div><div id="ug-content-wrap" style="display:none;margin-top:14px"><div style="font-weight:700;margin-bottom:6px">Song Content</div><textarea id="ug-content" rows="12" placeholder="Paste song lyrics/chords you are authorized to use here." style="width:100%;padding:12px;border-radius:9px;border:1px solid #3a424b;background:#0f1317;color:#fff;resize:vertical"></textarea><button id="ug-analyze" class="btn primary" type="button" style="margin-top:10px">🤖 Analyze Song</button></div>';
 const main=document.querySelector('main')||document.body; main.insertBefore(panel,main.firstChild);
 const status=document.getElementById('ug-status'); const wrap=document.getElementById('ug-content-wrap'); const content=document.getElementById('ug-content');
 document.getElementById('ug-load').onclick=function(){
  const url=document.getElementById('ug-url').value.trim();
  if(!/^https?:\/\/(www\.)?(tabs\.)?ultimate-guitar\.com\//i.test(url)){status.textContent='Please paste a valid Ultimate Guitar chord-page link.';return;}
  localStorage.setItem('worshipChordsSourceUrl',url); wrap.style.display='block'; content.focus();
  status.textContent='Link saved. Direct browser loading of Ultimate Guitar is restricted by cross-origin access; the backend importer will provide the automatic load in the next step.';
 };
 document.getElementById('ug-analyze').onclick=function(){
  const text=content.value.trim(); if(!text){status.textContent='Paste the song content first.';return;}
  localStorage.setItem('worshipChordsImportedText',text);
  window.dispatchEvent(new CustomEvent('worshipchords:song-imported',{detail:{sourceUrl:document.getElementById('ug-url').value.trim(),text:text}}));
  status.textContent='Song content is ready for the AI analyzer.';
 };
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install); else install();
})();
