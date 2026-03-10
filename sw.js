// Zenithra Service Worker — v2.1
// Always fetches index.html fresh from network, never from cache

const CACHE_NAME = 'zenithra-v2.1';
const STATIC_ASSETS = [
  '/manifest.json',
  '/icon-96.png',
  '/icon-144.png',
  '/icon-192.png',
  '/icon-512.png',
  '/sounds/thunder.mp3',
  '/sounds/forest.mp3',
  '/sounds/ocean.mp3',
  '/sounds/fire.mp3',
  '/sounds/white_noise.mp3',
  '/sounds/cafe.mp3'
];

// Install — cache only static assets, NOT index.html
self.addEventListener('install', event => {
  self.skipWaiting(); // Activate immediately
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
});

// Activate — delete all old caches immediately
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim()) // Take control of all open tabs immediately
  );
});

// Fetch — index.html always comes from network (never cache)
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Always fetch index.html fresh — never serve from cache
  if (url.pathname === '/' || url.pathname === '/index.html' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch(() =>
        caches.match('/index.html')
      )
    );
    return;
  }

  // For static assets — cache first, then network
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request);
    })
  );
});

// Listen for SKIP_WAITING message from main app
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
