(function(){'use strict';
function openAnalyzedSong(){
  try{
    if(typeof window.renderSong==='function') window.renderSong();
    if(typeof window.showTab==='function') window.showTab('song');
    if(typeof window.__worshipRenderLibrary==='function') window.__worshipRenderLibrary();
  }catch(e){console.error('Open analyzed song failed',e);}
}
window.finishImport=openAnalyzedSong;
window.__worshipOpenAnalyzedSong=openAnalyzedSong;
})();
