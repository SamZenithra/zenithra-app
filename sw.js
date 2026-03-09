// Zenithra Service Worker — by Auralith
// Cache-first strategy for offline support

const CACHE_NAME = 'zenithra-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
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

// ── Install: cache all core assets ───────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[Zenithra SW] Caching core assets');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// ── Activate: clean up old caches ────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[Zenithra SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: cache-first, fall back to network ─────────────────────────────
self.addEventListener('fetch', event => {
  // Skip non-GET and Supabase / Stripe / Netlify function requests
  // (these must always go to the network — never cache auth or payments)
  const url = new URL(event.request.url);
  const isExternal =
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('stripe.com') ||
    url.pathname.includes('/.netlify/functions/');

  if (event.request.method !== 'GET' || isExternal) {
    return; // Let the browser handle it normally
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        return cached; // Serve from cache instantly
      }
      // Not in cache — fetch from network and cache for next time
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });
        return response;
      });
    }).catch(() => {
      // Offline fallback — return cached index.html for navigation
      if (event.request.mode === 'navigate') {
        return caches.match('/index.html');
      }
    })
  );
});
