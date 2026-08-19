(function(){
'use strict';

function getSections(){
  try{return JSON.parse(window.eval('JSON.stringify(base)'));}catch(e){return {};}
}
function setSections(sections){
  window.eval('base='+JSON.stringify(sections)+'; transposeSource=JSON.parse(JSON.stringify(base)); arrangement=Object.keys(base);');
  try{window.renderSong();}catch(e){console.error(e);}
}
function uniqueName(name,sections){
  let n=2, candidate=name+' Copy';
  while(Object.prototype.hasOwnProperty.call(sections,candidate)) candidate=name+' Copy '+(n++);
  return candidate;
}
function duplicateSection(name){
  const sections=getSections(), keys=Object.keys(sections), idx=keys.indexOf(name);
  if(idx<0)return;
  const copy=uniqueName(name,sections), next={};
  keys.forEach((k,i)=>{next[k]=sections[k];if(i===idx)next[copy]=JSON.parse(JSON.stringify(sections[k]));});
  setSections(next);
}
function deleteSection(name){
  const sections=getSections(), keys=Object.keys(sections);
  if(!Object.prototype.hasOwnProperty.call(sections,name))return;
  if(keys.length<=1){alert('A song must keep at least one section.');return;}
  if(!confirm('Delete the entire '+name+' section, including its chords and lyrics?'))return;
  const next={};keys.forEach(k=>{if(k!==name)next[k]=sections[k];});setSections(next);
}
function enhanceTabs(){
  const tabs=document.getElementById('tabs');
  if(!tabs)return;
  const editing=document.body.classList.contains('editMode');
  tabs.querySelectorAll('button').forEach(btn=>{
    if(btn.dataset.sectionManager==='1')return;
    const name=(btn.dataset.section||btn.textContent||'').trim();
    if(!name||/^(Duplicate|Delete)$/i.test(name))return;
    btn.dataset.sectionManager='1';
    btn.dataset.sectionName=name;
    const wrap=document.createElement('span');
    wrap.className='sectionTabWrap';
    wrap.style.display='inline-flex';wrap.style.alignItems='center';wrap.style.gap='3px';
    btn.parentNode.insertBefore(wrap,btn);wrap.appendChild(btn);
    const dup=document.createElement('button');dup.type='button';dup.className='btn sectionAction';dup.textContent='⧉';dup.title='Duplicate '+name;dup.style.display=editing?'inline-block':'none';dup.onclick=e=>{e.stopPropagation();duplicateSection(name);};
    const del=document.createElement('button');del.type='button';del.className='btn sectionAction';del.textContent='×';del.title='Delete '+name;del.style.display=editing?'inline-block':'none';del.onclick=e=>{e.stopPropagation();deleteSection(name);};
    wrap.append(dup,del);
  });
  tabs.querySelectorAll('.sectionTabWrap').forEach(w=>w.querySelectorAll('.sectionAction').forEach(b=>b.style.display=editing?'inline-block':'none'));
}
function install(){
  const style=document.createElement('style');style.textContent='.sectionTabWrap{background:#20262d;border-radius:10px;padding:2px}.sectionTabWrap>.btn{padding:7px 9px}.sectionTabWrap .sectionAction{font-size:12px;padding:6px 8px;min-width:28px}.editMode .sectionTabWrap .sectionAction{display:inline-block!important}';document.head.appendChild(style);
  const observer=new MutationObserver(enhanceTabs);observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  enhanceTabs();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
