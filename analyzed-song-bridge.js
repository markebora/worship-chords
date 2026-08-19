(function(){'use strict';
function openAnalyzedSong(){
  try{
    /* Prefer the app's existing openSong() flow; it is the same path used by
       the working main lyrics screen. Fall back to renderSong/showTab only
       when that function is unavailable. */
    if(typeof window.openSong==='function'){
      window.openSong();
    }else{
      if(typeof window.renderSong==='function') window.renderSong();
      if(typeof window.showTab==='function') window.showTab('song');
    }
    if(typeof window.__worshipRenderLibrary==='function') window.__worshipRenderLibrary();
  }catch(e){console.error('Open analyzed song failed',e);}
}
window.finishImport=openAnalyzedSong;
window.__worshipOpenAnalyzedSong=openAnalyzedSong;
})();
