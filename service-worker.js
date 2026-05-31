/**
 * W.H. Academy — Service Worker
 * ==============================
 * Strategy overview:
 *   • CRITICAL_SHELL  → Cache-First  (app shell: HTML, CSS, JS, fonts, icons)
 *   • IMAGES          → Cache-First  (lazy-populated; no pre-cache of all images)
 *   • HTML PAGES      → Network-First with cache fallback (always fresh notes/chapters)
 *   • API / external  → Network-Only  (Google Fonts CSS fetched live; data APIs pass through)
 *   • Offline fallback → offline.html when network and cache both fail
 *
 * Future-proof design:
 *   • No hardcoded page list — new HTML pages are cached automatically on first visit.
 *   • CACHE_VERSION bump triggers old cache cleanup automatically.
 *   • Image and HTML pages are cached lazily (on first request), so adding new content
 *     requires zero service-worker changes.
 */

'use strict';

/* ─── Cache Names ─────────────────────────────────────────────────── */
const CACHE_VERSION   = 'v4';          // Bump this when you change SW logic
const SHELL_CACHE     = `wha-shell-${CACHE_VERSION}`;
const PAGES_CACHE     = `wha-pages-${CACHE_VERSION}`;
const IMAGES_CACHE    = `wha-images-${CACHE_VERSION}`;

/* ─── Shell Assets (pre-cached on install) ────────────────────────── */
/* Keep this list small — only the truly critical files that must work
   offline on first load. Everything else is cached lazily.           */
const SHELL_ASSETS = [
  './',
  './offline.html',
  './manifest.json',
  './favicon.png',
  './apple-touch-icon.png',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
];

/* ─── Install: Pre-cache Shell ────────────────────────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())   // Activate immediately
  );
});

/* ─── Activate: Clean Up Old Caches ──────────────────────────────── */
self.addEventListener('activate', event => {
  const KEEP = [SHELL_CACHE, PAGES_CACHE, IMAGES_CACHE];
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => !KEEP.includes(k))
          .map(k => {
            console.log(`[SW] Deleting old cache: ${k}`);
            return caches.delete(k);
          })
      ))
      .then(() => self.clients.claim())   // Take control of open pages
  );
});

/* ─── Fetch: Route Requests ───────────────────────────────────────── */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Skip non-GET and cross-origin requests we don't handle
  if (request.method !== 'GET') return;

  // 2. Skip Google Analytics, Tag Manager, external APIs entirely
  if (url.hostname.includes('google-analytics.com') ||
      url.hostname.includes('googletagmanager.com') ||
      url.hostname.includes('doubleclick.net') ||
      url.hostname.includes('script.google.com') ||
      url.hostname.includes('script.googleusercontent.com')) {
    return; // Pass through to network
  }

  // 3. Google Fonts CSS — Network-First (small, always need latest)
  if (url.hostname === 'fonts.googleapis.com' ||
      url.hostname === 'fonts.gstatic.com') {
    event.respondWith(networkFirstWithFallback(request, SHELL_CACHE, null));
    return;
  }

  // 4. CDN assets (Font Awesome, etc.) — Cache-First
  if (url.hostname === 'cdnjs.cloudflare.com') {
    event.respondWith(cacheFirstWithNetwork(request, SHELL_CACHE));
    return;
  }

  // Only handle same-origin from here on
  if (url.origin !== self.location.origin) return;

  const pathname = url.pathname;

  // 5. Image assets — Cache-First (lazy populate)
  if (/\.(webp|png|jpg|jpeg|gif|svg|ico|avif)(\?.*)?$/.test(pathname)) {
    event.respondWith(cacheFirstWithNetwork(request, IMAGES_CACHE));
    return;
  }

  // 6. Static assets (JS, CSS, fonts, woff, etc.) — Cache-First
  if (/\.(js|css|woff2?|ttf|eot)(\?.*)?$/.test(pathname)) {
    event.respondWith(cacheFirstWithNetwork(request, SHELL_CACHE));
    return;
  }

  // 7. HTML pages (including new ones added in future) — Network-First
  //    Falls back to cache, then offline.html
  if (request.headers.get('Accept') && request.headers.get('Accept').includes('text/html')) {
    event.respondWith(networkFirstWithFallback(request, PAGES_CACHE, './offline.html'));
    return;
  }

  // 8. Manifest, JSON, XML — Cache-First
  if (/\.(json|xml|txt)(\?.*)?$/.test(pathname)) {
    event.respondWith(cacheFirstWithNetwork(request, SHELL_CACHE));
    return;
  }

  // 9. Default — Network with cache fallback
  event.respondWith(networkFirstWithFallback(request, PAGES_CACHE, null));
});

/* ─── Strategy: Cache-First, fallback to Network ─────────────────── */
async function cacheFirstWithNetwork(request, cacheName) {
  const cache    = await caches.open(cacheName);
  const cached   = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok && response.status < 400) {
      cache.put(request, response.clone());  // Lazy populate cache
    }
    return response;
  } catch (err) {
    console.warn('[SW] Cache-first fetch failed:', request.url);
    throw err;
  }
}

/* ─── Strategy: Network-First, fallback to Cache, then offline ───── */
async function networkFirstWithFallback(request, cacheName, offlineFallback) {
  const cache = await caches.open(cacheName);

  try {
    const response = await fetch(request, { cache: 'no-cache' });
    if (response.ok && response.status < 400) {
      cache.put(request, response.clone());  // Update cache with fresh copy
    }
    return response;
  } catch (err) {
    // Network failed → try cache
    const cached = await cache.match(request);
    if (cached) return cached;

    // Nothing in cache → try shell cache
    const shellCache = await caches.open(SHELL_CACHE);
    const shellCached = await shellCache.match(request);
    if (shellCached) return shellCached;

    // Last resort → offline page
    if (offlineFallback) {
      const offlineResponse = await shellCache.match(offlineFallback);
      if (offlineResponse) return offlineResponse;
    }

    // Nothing at all
    throw err;
  }
}

/* ─── Message: Force update from UI ──────────────────────────────── */
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
