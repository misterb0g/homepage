// Cache applicatif minimal et prudent pour Start Desk.
const CACHE_PREFIX = 'start-desk-shell-';
const CACHE_NAME = CACHE_PREFIX + 'v4';
const APP_SHELL = [
  '/',
  '/index.html',
  '/styles.css',
  '/bookmarks.js',
  '/favicon.ico',
  '/apple-touch-icon.png',
  '/manifest.webmanifest',
  '/icons/start-desk.svg',
  '/css/assistant-enhancements.css',
  '/css/startpage-plus.css',
  '/css/start-desk.css',
  '/js/startpage-config.js',
  '/js/startpage-plus.js',
  '/js/pwa.js',
  '/js/utils.js',
  '/js/weather.js',
  '/js/bookmarks-ui.js',
  '/js/news.js',
  '/js/search.js',
  '/js/chat.js',
  '/js/settings.js',
  '/js/dashboard.js',
  '/js/calendar.js',
  '/js/app.js',
  '/js/start-desk.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy));
          }
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkUpdate = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);

      return cached || networkUpdate;
    })
  );
});
