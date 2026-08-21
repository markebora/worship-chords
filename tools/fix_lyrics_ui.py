from pathlib import Path

p = Path('index.html')
s = p.read_text(encoding='utf-8')

s = s.replace('''.lyricsView{\n  background:#0e0e10;\n\n  border:1px solid #29292e;\n\n  border-radius:14px;\n\n  padding:18px 6px 18px 8px;''', '''.lyricsView{\n  background:#0e0e10;\n\n  border:1px solid #29292e;\n\n  border-radius:14px;\n\n  padding:12px 6px 12px 8px;''')
s = s.replace('''.songStructure{\n  display:flex;\n\n  flex-direction:column;\n\n  gap:10px;\n}''', '''.songStructure{\n  display:flex;\n\n  flex-direction:column;\n\n  gap:4px;\n}''')
s = s.replace('''.songSection{\n  border-bottom:1px solid #25252a;\n\n  padding-bottom:8px;\n}''', '''.songSection{\n  border-bottom:1px solid #25252a;\n\n  padding-bottom:4px;\n}''')
s = s.replace('''.songSectionName{\n  margin-bottom:6px;''', '''.songSectionName{\n  margin-bottom:3px;''')
s = s.replace('''  font:\n    15px/1.2\n    ui-monospace,''', '''  font:\n    15px/1.05\n    ui-monospace,''')
s = s.replace('''  line-height:1.2;\n\n  white-space:pre-wrap;\n}\n\n.lyricLine{''', '''  line-height:1.05;\n\n  white-space:pre-wrap;\n}\n\n.lyricLine{''')
s = s.replace('''.lyricLine{\n  color:#f1f1f1;\n\n  min-height:0;\n\n  margin:0;\n\n  padding:0;\n\n  line-height:1.2;\n}''', '''.lyricLine{\n  color:#f1f1f1;\n\n  min-height:0;\n\n  margin:0;\n\n  padding:0;\n\n  line-height:1.05;\n}''')

marker = '''/* =========================================================\n   STRUCTURED SONG DISPLAY\n========================================================= */'''
css = '''/* =========================================================\n   STRUCTURED SONG DISPLAY\n========================================================= */\n\n.songFixedHeader{position:sticky;top:0;z-index:40;background:rgba(17,17,19,.96);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);margin:0 -1px 10px;padding:8px 0;border-bottom:1px solid #29292e;}\n.songFixedTitle{display:flex;align-items:center;gap:10px;min-width:0;padding:0 2px 8px;}\n.songFixedTitle h1{margin:0;flex:1;min-width:0;font-size:22px;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}\n.songSectionNav{display:flex;gap:7px;overflow-x:auto;padding:0 1px 3px;scrollbar-width:none;touch-action:pan-x;}\n.songSectionNav::-webkit-scrollbar{display:none;}\n.songSectionNav button{flex:0 0 auto;border:1px solid #303036;background:#18181b;color:#a7a7ad;border-radius:10px;padding:8px 11px;font-size:11px;font-weight:800;cursor:pointer;user-select:none;-webkit-user-select:none;touch-action:none;}\n.songSectionNav button.active{background:#29292e;color:#fff;border-color:#4a4a52;}\n.songSectionNav button.longPressing{transform:scale(.96);background:#303036;}\n.songSectionNav button.dragging{opacity:.45;}\n'''
if marker in s and '.songFixedHeader{' not in s:
    s = s.replace(marker, css, 1)

old_tools = '''          <button\n            class="sectionTool"\n            type="button"\n            onclick="moveEditorSection(this,1)"\n          >\n            ↓\n          </button>'''
new_tools = old_tools + '''\n\n          <button\n            class="sectionTool"\n            type="button"\n            title="Duplicate section"\n            onclick="duplicateEditorSection(this)"\n          >\n            ⧉\n          </button>'''
s = s.replace(old_tools, new_tools, 1)

start = s.index('function renderSongViewer(){')
end = s.index('\n\nfunction formatViewerLine(', start)
new_viewer = r'''function getViewerSections(song, displayedText){
  const parsed = parseSections(displayedText);
  const normalized = parsed.map((section,index) => ({...section,_id:String(index)+'|'+String(section.name||'Section').trim().toLowerCase()}));
  const savedOrder = Array.isArray(song.sectionOrder) ? song.sectionOrder : [];
  if(!savedOrder.length){ song.sectionOrder=normalized.map(section=>section._id); return normalized; }
  const byId=new Map(normalized.map(section=>[section._id,section]));
  const ordered=[];
  savedOrder.forEach(id=>{const section=byId.get(id);if(section){ordered.push(section);byId.delete(id);}});
  normalized.forEach(section=>{if(byId.has(section._id)) ordered.push(section);});
  song.sectionOrder=ordered.map(section=>section._id);
  return ordered;
}

function persistSectionOrder(){
  if(!currentSong)return;
  const songs=getSongs();
  const index=songs.findIndex(item=>item.id===currentSong.id);
  if(index!==-1){songs[index]=currentSong;writeSongs(songs.slice(0,200));}
}

function reorderViewerSections(fromIndex,toIndex){
  if(!currentSong||fromIndex===toIndex)return;
  const amount=currentSong.transposeSteps||0;
  const displayedText=transposeText(currentSong.originalText||currentSong.text||'',amount);
  const sections=getViewerSections(currentSong,displayedText);
  if(fromIndex<0||toIndex<0||fromIndex>=sections.length||toIndex>=sections.length)return;
  const moved=sections.splice(fromIndex,1)[0];
  sections.splice(toIndex,0,moved);
  currentSong.sectionOrder=sections.map(section=>section._id);
  persistSectionOrder();
  renderSongViewer();
}

function attachSectionNavBehavior(){
  const nav=document.getElementById('songSectionNav');
  if(!nav)return;
  let pressTimer=null;
  let draggingButton=null;
  let dragStartIndex=-1;
  const clearPress=()=>{clearTimeout(pressTimer);pressTimer=null;nav.querySelectorAll('button').forEach(button=>button.classList.remove('longPressing'));};
  nav.querySelectorAll('button').forEach(button=>{
    button.addEventListener('pointerdown',event=>{
      event.preventDefault();clearPress();button.classList.add('longPressing');
      pressTimer=setTimeout(()=>{draggingButton=button;dragStartIndex=[...nav.children].indexOf(button);button.classList.remove('longPressing');button.classList.add('dragging');},500);
    });
    button.addEventListener('pointermove',event=>{
      if(!draggingButton)return;
      const buttons=[...nav.querySelectorAll('button')];
      const target=buttons.find(targetButton=>{if(targetButton===draggingButton)return false;const rect=targetButton.getBoundingClientRect();return event.clientX>=rect.left&&event.clientX<=rect.right;});
      if(!target)return;
      const currentIndex=[...nav.children].indexOf(draggingButton);
      const targetIndex=[...nav.children].indexOf(target);
      if(targetIndex>currentIndex)nav.insertBefore(draggingButton,target.nextSibling);else nav.insertBefore(draggingButton,target);
    });
    button.addEventListener('pointerup',()=>{
      const wasDragging=!!draggingButton;clearPress();
      if(wasDragging){const finalIndex=[...nav.children].indexOf(button);button.classList.remove('dragging');draggingButton=null;if(finalIndex!==dragStartIndex)reorderViewerSections(dragStartIndex,finalIndex);dragStartIndex=-1;return;}
      const index=Number(button.dataset.sectionIndex);const target=document.getElementById('section-'+index);if(target)target.scrollIntoView({behavior:'smooth',block:'start'});
    });
    button.addEventListener('pointercancel',()=>{clearPress();if(draggingButton)draggingButton.classList.remove('dragging');draggingButton=null;dragStartIndex=-1;});
  });
}

function renderSongViewer(){
  const song=currentSong;
  const amount=song.transposeSteps||0;
  const displayedText=transposeText(song.originalText||song.text||'',amount);
  song.text=displayedText;
  const sections=getViewerSections(song,displayedText);
  screen.innerHTML=`
    <div class="songPage">
      <div class="songFixedHeader">
        <div class="songFixedTitle"><button class="backBtn" id="backToLyrics">← Lyrics</button><h1>${esc(song.title||'Untitled Song')}</h1></div>
        <div class="songSectionNav" id="songSectionNav" aria-label="Song sections">
          ${sections.map((section,index)=>`<button type="button" data-section-index="${index}">${esc(section.name)}</button>`).join('')}
        </div>
      </div>
      <div class="songToolbar">
        <button class="toolbarBtn" id="transposeDown">−</button>
        <button class="toolbarBtn" id="transposeReset">Transpose:${amount>0?'+':''}${amount}</button>
        <button class="toolbarBtn" id="transposeUp">+</button>
        <button class="toolbarBtn" id="fontMinus">A−</button>
        <button class="toolbarBtn" id="fontPlus">A+</button>
        <button class="toolbarBtn" id="editBtn">Edit Song</button>
        <button class="toolbarBtn primary" id="saveBtn">Save</button>
      </div>
      <div class="lyricsView" id="lyricsText" style="font-size:${song.fontSize}px;"><div class="songStructure">
        ${sections.map((section,index)=>`<div class="songSection" id="section-${index}" data-section-index="${index}"><div class="songSectionName">${esc(section.name)}</div>${section.lines.filter(line=>line.trim()!=='').map(line=>isChordOnlyLine(line)?`<div class="songLine chordLine">${esc(line)}</div>`:`<div class="songLine lyricLine">${formatViewerLine(line)}</div>`).join('')}</div>`).join('')}
      </div></div>
    </div>`;
  document.getElementById('backToLyrics').onclick=renderLyrics;
  document.getElementById('transposeDown').onclick=()=>{song.transposeSteps--;renderSongViewer();};
  document.getElementById('transposeUp').onclick=()=>{song.transposeSteps++;renderSongViewer();};
  document.getElementById('transposeReset').onclick=()=>{song.transposeSteps=0;renderSongViewer();};
  document.getElementById('fontMinus').onclick=()=>{song.fontSize=Math.max(11,song.fontSize-1);renderSongViewer();};
  document.getElementById('fontPlus').onclick=()=>{song.fontSize=Math.min(30,song.fontSize+1);renderSongViewer();};
  document.getElementById('editBtn').onclick=editCurrentSong;
  document.getElementById('saveBtn').onclick=saveCurrentSong;
  attachSectionNavBehavior();
}
'''
s=s[:start]+new_viewer+s[end:]

marker = '''function moveEditorSection(\n  button,\n  direction\n){'''
duplicate = r'''function duplicateEditorSection(button){
  const section=button.closest('[data-editor-section]');
  if(!section)return;
  const clone=section.cloneNode(true);
  section.parentElement.insertBefore(clone,section.nextSibling);
}


'''
if 'function duplicateEditorSection(button)' not in s:
    s=s.replace(marker,duplicate+marker,1)

s=s.replace('''  currentSong.analysis =\n    analyzeFocusedSong(\n      text\n    );''','''  currentSong.analysis =\n    analyzeFocusedSong(\n      text\n    );\n\n  currentSong.sectionOrder =\n    parseSections(text).map((section,index) =>\n      String(index) + '|' + String(section.name || 'Section').trim().toLowerCase()\n    );''',1)

p.write_text(s,encoding='utf-8')
print('lyrics UI patch applied')
