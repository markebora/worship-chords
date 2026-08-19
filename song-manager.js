(function(){
'use strict';
const STORAGE_KEY='worshipChordsSongs',CURRENT_KEY='worshipChordsCurrentSong';
function slugTitle(url){try{const p=new URL(url).pathname.split('/').filter(Boolean),s=p[p.length-1]||'Imported Song';return s.replace(/-\d+$/,'').replace(/-chords?$/i,'').replace(/-tabs?$/i,'').split('-').map(x=>x.charAt(0).toUpperCase()+x.slice(1)).join(' ');}catch(e){return 'Imported Song';}}
function artistFromUrl(url){try{const p=new URL(url).pathname.split('/').filter(Boolean),i=p.indexOf('tab');if(i>=0&&p[i+1])return p[i+1].split('-').map(x=>x.charAt(0).toUpperCase()+x.slice(1)).join(' ');}catch(e){}return 'Unknown Artist';}

/*
  IMPORTANT CHORD PARSER FIX
  --------------------------
  Do not use a short fixed list of chord qualities here.
  Worship songs commonly contain chords such as:
    CM7, Cmaj7, D/C, D/C#, Bm7, E7sus, E7sus4, F#dim7,
    Cadd9, G/B, Am9, etc.

  The chord-family parser already understands ROOT + arbitrary SUFFIX
  + optional /BASS, so use that parser for chord-line detection too.
*/
function isChordToken(s){
  const token=String(s||'').trim().replace(/♯/g,'#').replace(/♭/g,'b');
  if(!token)return false;
  if(window.WorshipChordParser&&typeof window.WorshipChordParser.isChord==='function'){
    return window.WorshipChordParser.isChord(token);
  }
  return /^(?:[A-G](?:#|b)?)(?:[^/\s]*)(?:\/[A-G](?:#|b)?)?$/.test(token);
}
function parseChordLine(line){
  const t=String(line||'').trim().split(/\s+/).filter(Boolean);
  return !!t.length&&t.every(isChordToken);
}
function normalizeText(text){return String(text||'').replace(/\r/g,'').replace(/&(?:#0*39|apos);/gi,"'").replace(/&#x27;/gi,"'").replace(/&quot;/gi,'"').replace(/&amp;/gi,'&').replace(/&nbsp;/gi,' ');}
function cleanName(n){return String(n||'').replace(/[\u200B-\u200D\uFEFF]/g,'');}
function parseSongText(text){const sections={};let section='Verse 1',pending=null;const ensure=n=>(sections[n]||(sections[n]=[]));const flush=()=>{if(pending!==null){ensure(section).push([pending,'']);pending=null;}};for(const raw of normalizeText(text).split('\n')){const line=raw.trim();if(!line){flush();continue;}const h=line.match(/^\[([^\]]+)\]$/);if(h){flush();let n=cleanName(h[1].trim()),l=n.toLowerCase();if(l==='verse')n='Verse '+(Object.keys(sections).filter(k=>/^Verse \d+$/i.test(k)).length+1);else if(/^verse\s+\d+$/i.test(n))n='Verse '+n.match(/\d+/)[0];else if(l==='chorus')n='Chorus';else if(l==='bridge')n='Bridge';else if(l==='intro')n='Intro';else if(l==='outro'||l==='ending')n='Outro';else if(l==='pre-chorus'||l==='pre chorus')n='Pre-Chorus';else if(l==='instrumental')n='Instrumental';section=n;ensure(section);continue;}if(parseChordLine(line)){flush();pending=line;continue;}ensure(section).push([pending||'',line]);pending=null;}flush();if(!Object.keys(sections).length)sections['Verse 1']=[];return sections;}
function appGetBase(){try{return JSON.parse(window.eval('JSON.stringify(base)'));}catch(e){return {};}}
function appSetBase(parsed,order){window.eval('base='+JSON.stringify(parsed)+'; transposeSource=JSON.parse(JSON.stringify(base)); arrangement='+JSON.stringify(order||Object.keys(base))+'; activeSection=arrangement[0]||\'Verse 1\';');}
function appRender(){try{if(typeof window.renderSong==='function')window.renderSong();if(typeof window.showTab==='function')window.showTab('song');}catch(e){console.error(e);}}
function detectKey(sections){try{if(window.WorshipChordFamilies&&typeof window.WorshipChordFamilies.detectKey==='function')return window.WorshipChordFamilies.detectKey(sections).key||'';}catch(e){}return '';}
function setMeta(title,artist,key){const t=document.getElementById('songTitle'),a=document.getElementById('songArtist'),k=document.getElementById('key'),lt=document.getElementById('libraryTitle'),la=document.getElementById('libraryArtist');if(t)t.textContent=title;if(a)a.textContent=artist;if(k&&key)k.textContent=key;if(lt)lt.textContent=title;if(la)la.textContent=artist+(key?' • Key '+key:'');}
function loadIntoEditor(text,meta){const sections=parseSongText(text),detected=detectKey(sections),key=detected||meta.key||'';appSetBase(sections,Object.keys(sections));setMeta(meta.title,meta.artist,key);appRender();const song={title:meta.title,artist:meta.artist,key,sourceUrl:meta.sourceUrl||'',sections,arrangement:Object.keys(sections),updatedAt:new Date().toISOString()};localStorage.setItem(CURRENT_KEY,JSON.stringify(song));return song;}
function currentSong(){return{title:document.getElementById('songTitle')?.textContent?.trim()||'Imported Song',artist:document.getElementById('songArtist')?.textContent?.trim()||'Unknown Artist',key:document.getElementById('key')?.textContent?.trim()||'',sections:appGetBase(),arrangement:JSON.parse(window.eval('JSON.stringify(arrangement)'))};}
function libraryList(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');}catch(e){return [];}}
function librarySave(song){const list=libraryList(),i=list.findIndex(x=>x.title===song.title&&x.artist===song.artist);if(i>=0)list[i]=song;else list.unshift(song);localStorage.setItem(STORAGE_KEY,JSON.stringify(list));renderLibrary();}
function saveLocalSong(){const s=currentSong();s.updatedAt=new Date().toISOString();librarySave(s);localStorage.setItem(CURRENT_KEY,JSON.stringify(s));toast('Song saved to library');}
function openSaved(i){const list=libraryList(),s=list[i];if(!s)return;appSetBase(s.sections||{},s.arrangement||Object.keys(s.sections||{}));setMeta(s.title||'Untitled',s.artist||'Unknown Artist',s.key||'');appRender();localStorage.setItem(CURRENT_KEY,JSON.stringify(s));toast('Song opened');}
function deleteSaved(i){const list=libraryList();if(!list[i])return;if(!confirm('Delete '+list[i].title+' from your Song Library?'))return;list.splice(i,1);localStorage.setItem(STORAGE_KEY,JSON.stringify(list));renderLibrary();toast('Song deleted');}
function renderLibrary(){const card=document.querySelector('#songs .card');if(!card)return;let box=document.getElementById('savedSongsList');if(!box){box=document.createElement('div');box.id='savedSongsList';box.style.marginTop='12px';card.appendChild(box);}const list=libraryList();box.innerHTML=list.length?'<div class="muted" style="margin-bottom:7px">Saved songs</div>'+list.map((s,i)=>`<div class="item" style="margin:7px 0"><div class="itemmain"><b>${esc(s.title||'Untitled')}</b><span>${esc(s.artist||'Unknown Artist')} • Key ${esc(s.key||'')}</span></div><button type="button" class="btn" onclick="window.__worshipOpenSaved(${i})">Open</button><button type="button" class="btn" onclick="window.__worshipDeleteSaved(${i})">Delete</button></div>`).join(''):'<div class="muted">No saved songs yet.</div>';}
function exportSong(song){const s=song||currentSong();let out='WORSHIP_CHORDS_SONG\nVERSION: 1\nTITLE: '+(s.title||'Untitled')+'\nARTIST: '+(s.artist||'Unknown Artist')+'\nKEY: '+(s.key||'')+'\n';if(s.sourceUrl)out+='SOURCE: '+s.sourceUrl+'\n';out+='\n';const order=s.arrangement||Object.keys(s.sections||{});for(const name of order){const lines=s.sections?.[name]||[];out+='['+cleanName(name).toUpperCase()+']\n\n';for(const row of lines)out+=(row[0]||'')+'\n'+(row[1]||'')+'\n\n';}const blob=new Blob([out],{type:'text/plain;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=(s.title||'worship-song').replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'')+'.txt';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
function importTxt(file){const r=new FileReader();r.onload=()=>{const text=String(r.result||'');if(!text.startsWith('WORSHIP_CHORDS_SONG'))return alert('This is not a Worship Chords song file.');const title=(text.match(/^TITLE:\s*(.*)$/mi)||[])[1]||'Imported Song',artist=(text.match(/^ARTIST:\s*(.*)$/mi)||[])[1]||'Unknown Artist',key=(text.match(/^KEY:\s*(.*)$/mi)||[])[1]||'',sourceUrl=(text.match(/^SOURCE:\s*(.*)$/mi)||[])[1]||'';const body=text.replace(/^WORSHIP_CHORDS_SONG[\s\S]*?\n\n/,'');librarySave(loadIntoEditor(body,{title,artist,key,sourceUrl}));};r.readAsText(file);}
function addControls(){const c=document.querySelector('#song .controls[style*="margin"]');if(!c||document.getElementById('songManagerExport'))return;const b=(id,label,fn)=>{const x=document.createElement('button');x.id=id;x.className='btn';x.type='button';x.textContent=label;x.onclick=fn;return x;};const input=document.createElement('input');input.id='songManagerFile';input.type='file';input.accept='.txt,text/plain';input.style.display='none';input.onchange=e=>{if(e.target.files[0])importTxt(e.target.files[0]);e.target.value='';};c.append(b('songManagerExport','⬇ Export TXT',()=>exportSong()),b('songManagerImport','⬆ Import TXT',()=>input.click()),input);}
function install(){addControls();renderLibrary();window.__worshipOpenSaved=openSaved;window.__worshipDeleteSaved=deleteSaved;window.__worshipSaveSong=saveLocalSong;window.__worshipRenderLibrary=renderLibrary;window.saveLocal=function(){saveLocalSong();};window.addEventListener('worshipchords:song-imported',e=>{const d=e.detail||{},u=d.sourceUrl||'',s=loadIntoEditor(d.text||'',{title:slugTitle(u),artist:artistFromUrl(u),sourceUrl:u});librarySave(s);addControls();});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
