(function(){
'use strict';

/*
  Song Manager
  - Turns imported/analyzed Ultimate Guitar text into the app's existing song data.
  - Keeps transpose/edit/font-size rendering in app.html untouched.
  - Adds local browser save plus TXT import/export.
*/

const STORAGE_KEY='worshipChordsSongs';
const CURRENT_KEY='worshipChordsCurrentSong';

function slugTitle(url){
  try{
    const parts=new URL(url).pathname.split('/').filter(Boolean);
    const slug=parts[parts.length-1]||'Imported Song';
    return slug
      .replace(/-\d+$/,'')
      .replace(/-chords?$/i,'')
      .replace(/-tabs?$/i,'')
      .split('-')
      .map(x=>x.charAt(0).toUpperCase()+x.slice(1))
      .join(' ');
  }catch(e){ return 'Imported Song'; }
}

function artistFromUrl(url){
  try{
    const parts=new URL(url).pathname.split('/').filter(Boolean);
    const i=parts.indexOf('tab');
    if(i>=0 && parts[i+1]) return parts[i+1].split('-').map(x=>x.charAt(0).toUpperCase()+x.slice(1)).join(' ');
  }catch(e){}
  return 'Unknown Artist';
}

function isChordToken(s){
  return /^(?:[A-G](?:#|b)?)(?:m|min|maj|dim|aug|sus|add)?\d*(?:\/[A-G](?:#|b)?)?$/.test(s);
}

function parseChordLine(line){
  const tokens=line.trim().split(/\s+/).filter(Boolean);
  if(!tokens.length) return false;
  const chordish=tokens.filter(isChordToken).length;
  return chordish===tokens.length && chordish>0;
}

function parseSongText(text){
  const sections={};
  let section='Verse 1';
  let pendingChords=null;
  let verseNo=1;

  const lines=text.replace(/\r/g,'').split('\n');

  function ensure(name){
    if(!sections[name]) sections[name]=[];
    return name;
  }

  for(let i=0;i<lines.length;i++){
    const raw=lines[i];
    const line=raw.trim();
    if(!line) continue;

    const heading=line.match(/^\[([^\]]+)\]$/);
    if(heading){
      let name=heading[1].trim();
      const lower=name.toLowerCase();
      if(lower==='verse'){
        const existing=Object.keys(sections).filter(k=>/^Verse \d+$/i.test(k)).length;
        name='Verse '+(existing+1);
      }else if(lower==='chorus') name='Chorus';
      else if(lower==='bridge') name='Bridge';
      else if(lower==='intro') name='Intro';
      else if(lower==='outro' || lower==='ending') name='Outro';
      else if(lower==='pre-chorus' || lower==='pre chorus') name='Pre-Chorus';
      else if(lower==='instrumental') name='Instrumental';
      section=ensure(name);
      pendingChords=null;
      continue;
    }

    if(parseChordLine(line)){
      pendingChords=line;
      continue;
    }

    // If chords and lyrics share one line, preserve them as a chord/lyric pair
    // rather than losing the lyric text.
    const inline=extractInlineChords(line);
    if(inline){
      ensure(section).push([inline.chords.join(' '),inline.lyric]);
      pendingChords=null;
      continue;
    }

    ensure(section).push([pendingChords||'',line]);
    pendingChords=null;
  }

  if(!Object.keys(sections).length) sections['Verse 1']=[];
  return sections;
}

function extractInlineChords(line){
  const matches=line.match(/(?:^|\s)([A-G](?:#|b)?(?:m|min|maj|dim|aug|sus|add)?\d*(?:\/[A-G](?:#|b)?)?)(?=\s|$)/g);
  if(!matches || matches.length<1) return null;
  const chords=matches.map(x=>x.trim()).filter(isChordToken);
  if(!chords.length) return null;
  const lyric=line.replace(/\b[A-G](?:#|b)?(?:m|min|maj|dim|aug|sus|add)?\d*(?:\/[A-G](?:#|b)?)?\b/g,'').replace(/\s{2,}/g,' ').trim();
  return lyric ? {chords,lyric} : null;
}

function getCurrentSong(){
  const title=document.getElementById('songTitle')?.textContent?.trim()||'Imported Song';
  const artist=document.getElementById('songArtist')?.textContent?.trim()||'Unknown Artist';
  const key=document.getElementById('key')?.textContent?.trim()||'';
  return {title,artist,key,sections:JSON.parse(JSON.stringify(window.base||{}))};
}

function setSongMeta(title,artist,key){
  const titleEl=document.getElementById('songTitle');
  const artistEl=document.getElementById('songArtist');
  const keyEl=document.getElementById('key');
  const libraryTitle=document.getElementById('libraryTitle');
  const libraryArtist=document.getElementById('libraryArtist');
  if(titleEl) titleEl.textContent=title;
  if(artistEl) artistEl.textContent=artist;
  if(keyEl && key) keyEl.textContent=key;
  if(libraryTitle) libraryTitle.textContent=title;
  if(libraryArtist) libraryArtist.textContent=artist+(key?' • Key '+key:'');
}

function loadIntoExistingEditor(text,meta){
  const parsed=parseSongText(text);
  window.base=parsed;
  window.transposeSource=JSON.parse(JSON.stringify(parsed));
  window.arrangement=Object.keys(parsed);
  window.activeSection=Object.keys(parsed)[0]||'Verse 1';

  setSongMeta(meta.title,meta.artist,meta.key||'');

  if(typeof window.renderSong==='function') window.renderSong();
  if(typeof window.showTab==='function') window.showTab('song');

  const song={title:meta.title,artist:meta.artist,key:meta.key||'',sourceUrl:meta.sourceUrl||'',sections:parsed,updatedAt:new Date().toISOString()};
  localStorage.setItem(CURRENT_KEY,JSON.stringify(song));
  return song;
}

function exportSong(song){
  const s=song||getCurrentSong();
  let out='WORSHIP_CHORDS_SONG\nVERSION: 1\n';
  out+='TITLE: '+(s.title||'Untitled')+'\n';
  out+='ARTIST: '+(s.artist||'Unknown Artist')+'\n';
  out+='KEY: '+(s.key||'')+'\n';
  if(s.sourceUrl) out+='SOURCE: '+s.sourceUrl+'\n';
  out+='\n';

  for(const [section,lines] of Object.entries(s.sections||{})){
    out+='['+section.toUpperCase()+']\n\n';
    for(const pair of lines||[]){
      out+=(pair[0]||'')+'\n';
      out+=(pair[1]||'')+'\n\n';
    }
  }

  const blob=new Blob([out],{type:'text/plain;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=(s.title||'worship-song').replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'')+'.txt';
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

function saveSongLocally(){
  const song=getCurrentSong();
  song.updatedAt=new Date().toISOString();
  const list=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');
  const idx=list.findIndex(x=>x.title===song.title && x.artist===song.artist);
  if(idx>=0) list[idx]=song; else list.unshift(song);
  localStorage.setItem(STORAGE_KEY,JSON.stringify(list));
  localStorage.setItem(CURRENT_KEY,JSON.stringify(song));
  if(typeof window.showToast==='function') window.showToast('Song saved locally');
  else alert('Song saved locally');
}

function importTxtFile(file){
  const reader=new FileReader();
  reader.onload=function(){
    const text=String(reader.result||'');
    if(!text.startsWith('WORSHIP_CHORDS_SONG')){
      alert('This is not a Worship Chords song file.');
      return;
    }
    const title=(text.match(/^TITLE:\s*(.*)$/mi)||[])[1]||'Imported Song';
    const artist=(text.match(/^ARTIST:\s*(.*)$/mi)||[])[1]||'Unknown Artist';
    const key=(text.match(/^KEY:\s*(.*)$/mi)||[])[1]||'';
    const sourceUrl=(text.match(/^SOURCE:\s*(.*)$/mi)||[])[1]||'';
    const body=text.replace(/^WORSHIP_CHORDS_SONG[\s\S]*?\n\n/,'');
    const song=loadIntoExistingEditor(body,{title,artist,key,sourceUrl});
    saveSongToLibrary(song);
  };
  reader.readAsText(file);
}

function saveSongToLibrary(song){
  const list=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');
  const idx=list.findIndex(x=>x.title===song.title && x.artist===song.artist);
  if(idx>=0) list[idx]=song; else list.unshift(song);
  localStorage.setItem(STORAGE_KEY,JSON.stringify(list));
}

function addManagerControls(){
  const controls=document.querySelector('#song .controls[style*="margin"]');
  if(!controls || document.getElementById('songManagerExport')) return;

  const save=document.createElement('button');
  save.id='songManagerSave'; save.className='btn'; save.type='button'; save.textContent='💾 Save Song';
  save.onclick=saveSongLocally;

  const exp=document.createElement('button');
  exp.id='songManagerExport'; exp.className='btn'; exp.type='button'; exp.textContent='⬇ Export TXT';
  exp.onclick=()=>exportSong();

  const imp=document.createElement('button');
  imp.id='songManagerImport'; imp.className='btn'; imp.type='button'; imp.textContent='⬆ Import TXT';
  imp.onclick=()=>document.getElementById('songManagerFile').click();

  const input=document.createElement('input');
  input.id='songManagerFile'; input.type='file'; input.accept='.txt,text/plain'; input.style.display='none';
  input.onchange=e=>{if(e.target.files[0]) importTxtFile(e.target.files[0]);e.target.value='';};

  controls.append(save,exp,imp,input);
}

function install(){
  addManagerControls();
  const observer=new MutationObserver(addManagerControls);
  observer.observe(document.body,{childList:true,subtree:true});

  window.addEventListener('worshipchords:song-imported',function(e){
    const d=e.detail||{};
    const sourceUrl=d.sourceUrl||'';
    const meta={
      title:slugTitle(sourceUrl),
      artist:artistFromUrl(sourceUrl),
      sourceUrl
    };
    loadIntoExistingEditor(d.text||'',meta);
    addManagerControls();
  });
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install); else install();
})();
