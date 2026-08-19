const VERSION='20260819-1003';
const CACHE='worship-chords-'+VERSION;
const ASSETS=[
  './',
  './index.html',
  './app.html?v='+VERSION,
  './transpose-chord-bank.js?v='+VERSION,
  './search-module.js?v='+VERSION,
  './song-import.js?v='+VERSION,
  './chord-families.js?v='+VERSION,
  './song-manager.js?v='+VERSION,
  './section-controls.js?v='+VERSION,
  './key-consistency.js?v='+VERSION,
  './analyzer-chord-fix.js?v='+VERSION,
  './focused-chord-mode.js?v='+VERSION,
  './analyzer-focused.js?v='+VERSION
];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('worship-chords-')&&k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin) return;
  event.respondWith(
    fetch(event.request,{cache:'no-cache'}).then(response=>{
      if(response.ok){
        const copy=response.clone();
        caches.open(CACHE).then(cache=>cache.put(event.request,copy));
      }
      return response;
    }).catch(()=>caches.match(event.request))
  );
});
