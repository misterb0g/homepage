// Start Desk PWA — versioned offline shell, network-first application assets.
// HTML and JS/CSS are updated from the network, avoiding stale design after a release.
const CACHE_PREFIX = 'start-desk-shell-';
const CACHE_NAME = CACHE_PREFIX + 'v25';
const APP_SHELL = [
  '/index.html',
  '/styles.css',
  '/css/settings-polish.css',
  '/css/neumorphism-preview.css',
  '/bookmarks.js',
  '/favicon.ico',
  '/apple-touch-icon.png',
  '/manifest.webmanifest',
  '/icons/start-desk.svg',
  '/js/startpage-config.js',
  '/js/startpage-plus.js',
  '/js/neumorphism-profile-picker.js',
  '/js/neumorphism-weather-focus.js',
  '/js/pwa.js',
  '/js/core.js'
];

self.addEventListener('install', (event) => {
  // A missing optional asset must not prevent this worker from installing.
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async (cache) => {
        await Promise.allSettled(APP_SHELL.map((path) => cache.add(path)));
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
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

  // Only cache navigations and application assets. No third-party API or dynamic data.
  const isNavigation = request.mode === 'navigate';
  const isAsset = /\.(?:css|js|svg|png|ico|webmanifest)$/.test(url.pathname);
  if (!isNavigation && !isAsset) return;

  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') {
        const cache = await caches.open(CACHE_NAME);
        const key = isNavigation ? '/index.html' : request;
        // Do not delay showing the network response to store it.
        event.waitUntil(cache.put(key, response.clone()).catch(() => {}));
      }
      return response;
    } catch (error) {
      const cached = await caches.match(isNavigation ? '/index.html' : request);
      if (cached) return cached;
      throw error;
    }
  })());
});
