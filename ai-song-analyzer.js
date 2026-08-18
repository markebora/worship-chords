(function(){
  'use strict';

  const AI_API = './api/analyze';

  function esc(value){
    return String(value ?? '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }

  function ensurePanel(){
    if(document.getElementById('ai-analysis-panel')) return document.getElementById('ai-analysis-panel');
    const panel=document.createElement('section');
    panel.id='ai-analysis-panel';
    panel.style.cssText='margin:18px 0;padding:16px;border:1px solid #293039;border-radius:12px;background:#151a20';
    panel.innerHTML=`
      <div style="font-size:18px;font-weight:800">🤖 AI Song Analyzer</div>
      <div class="muted" style="margin:5px 0 12px">AI identifies song sections and chord notation. The protected chord engine still performs transposition.</div>
      <button id="ai-analyze-btn" type="button" class="btn primary">Analyze Imported Song with AI</button>
      <div id="ai-analysis-status" class="muted" style="margin-top:10px"></div>
      <pre id="ai-analysis-preview" style="display:none;margin-top:12px;padding:12px;border-radius:9px;background:#0e1115;color:#dbe7f5;white-space:pre-wrap;overflow:auto;max-height:420px"></pre>`;

    const target=document.querySelector('#song-import-panel') || document.querySelector('main') || document.body;
    target.parentNode.insertBefore(panel,target.nextSibling);
    panel.querySelector('#ai-analyze-btn').onclick=()=>analyzeCurrentSong();
    return panel;
  }

  function getSongText(){
    const textarea=document.getElementById('ug-content');
    if(textarea?.value.trim()) return textarea.value.trim();
    return localStorage.getItem('worshipChordsImportedText') || '';
  }

  function setStatus(message){
    const el=document.getElementById('ai-analysis-status');
    if(el) el.textContent=message;
  }

  async function analyzeCurrentSong(){
    ensurePanel();
    const text=getSongText();
    if(!text){ setStatus('Load a song first.'); return; }

    const button=document.getElementById('ai-analyze-btn');
    const preview=document.getElementById('ai-analysis-preview');
    button.disabled=true;
    button.textContent='Analyzing…';
    setStatus('AI is analyzing sections, lyrics and chord notation…');
    preview.style.display='none';

    try{
      const response=await fetch(AI_API,{
        method:'POST',
        headers:{'Content-Type':'application/json','Accept':'application/json'},
        body:JSON.stringify({
          text,
          sourceUrl:localStorage.getItem('worshipChordsSourceUrl') || ''
        })
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(data.error || `AI analyzer returned HTTP ${response.status}`);

      const analysis=data.analysis;
      localStorage.setItem('worshipChordsAIAnalysis',JSON.stringify(analysis));
      window.__worshipChordsAIAnalysis=analysis;

      const sectionCount=Array.isArray(analysis.sections) ? analysis.sections.length : 0;
      const chordCount=Array.isArray(analysis.sections)
        ? analysis.sections.reduce((total,section)=>total+(section.lines||[]).reduce((n,line)=>n+(line.chords||[]).length,0),0)
        : 0;

      setStatus(`✅ AI analysis complete: ${sectionCount} sections and ${chordCount} chord entries identified.`);
      preview.textContent=JSON.stringify(analysis,null,2);
      preview.style.display='block';
      window.dispatchEvent(new CustomEvent('worshipchords:ai-analyzed',{detail:{analysis}}));
    }catch(error){
      setStatus('⚠️ '+(error.message || 'AI analysis failed.'));
    }finally{
      button.disabled=false;
      button.textContent='Analyze Imported Song with AI';
    }
  }

  window.analyzeCurrentSong=analyzeCurrentSong;
  window.dispatchEvent(new CustomEvent('worshipchords:ai-analyzer-ready'));

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',ensurePanel);
  }else{
    ensurePanel();
  }
})();
