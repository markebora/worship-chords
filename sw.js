const CACHE_NAME = 'disciples-shell-v1';
const SHELL_URL = '/';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(SHELL_URL))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

/*
  Only cache the app shell (the HTML document itself), and only
  for navigation requests. Everything else (Drive sync, UG
  import, API calls, external assets) always goes to the
  network untouched.
*/
self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(SHELL_URL, copy));
        return response;
      })
      .catch(() => caches.match(SHELL_URL))
  );
});
