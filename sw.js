/* ============================================================
   GEMBIRA Service Worker — GitHub Pages Optimized
   ⚠️ Naikkan CACHE_VERSION setiap kali update index.html
   ============================================================ */

const CACHE_VERSION = 'gembira-v2';
const RUNTIME_CACHE = 'gembira-runtime-v2';

// App shell — di-cache saat install
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

// CDN yang boleh di-cache
const CDN_HOSTS = [
  'cdn.jsdelivr.net',
  'unpkg.com',
  'cdnjs.cloudflare.com'
];

// Google Fonts
const FONT_HOSTS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com'
];

// Backend — JANGAN di-cache (selalu network)
const API_HOSTS = [
  'script.google.com',
  'googleusercontent.com',
  'script.googleusercontent.com'
];

/* ===== INSTALL ===== */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(APP_SHELL))
      .catch(err => console.warn('[SW] Install cache fail:', err))
  );
  self.skipWaiting();
});

/* ===== ACTIVATE ===== */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== CACHE_VERSION && k !== RUNTIME_CACHE)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* ===== FETCH ===== */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1. Hanya GET yang di-handle
  if (req.method !== 'GET') return;

  // 2. Backend Apps Script → BYPASS total
  if (API_HOSTS.some(h => url.hostname.includes(h))) {
    return; // browser handle default
  }

  // 3. Google Fonts → stale-while-revalidate
  if (FONT_HOSTS.some(h => url.hostname.includes(h))) {
    event.respondWith(staleWhileRevalidate(req, RUNTIME_CACHE));
    return;
  }

  // 4. CDN (Chart.js dll) → cache-first
  if (CDN_HOSTS.some(h => url.hostname.includes(h))) {
    event.respondWith(cacheFirst(req, RUNTIME_CACHE));
    return;
  }

  // 5. Cross-origin lain → network, fallback cache
  if (url.origin !== self.location.origin) {
    event.respondWith(networkFirst(req, RUNTIME_CACHE));
    return;
  }

  // 6. Navigation (index.html) → network-first, fallback shell
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_VERSION).then(c => c.put(req, clone)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // 7. Asset lokal (icon, css) → cache-first
  event.respondWith(cacheFirst(req, CACHE_VERSION));
});

/* ===== STRATEGIES ===== */
async function cacheFirst(req, cacheName) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res && res.status === 200 && res.type !== 'opaque') {
      const cache = await caches.open(cacheName);
      cache.put(req, res.clone());
    }
    return res;
  } catch (err) {
    return cached || new Response('', { status: 503, statusText: 'Offline' });
  }
}

async function networkFirst(req, cacheName) {
  try {
    const res = await fetch(req);
    if (res && res.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(req, res.clone());
    }
    return res;
  } catch (err) {
    const cached = await caches.match(req);
    if (cached) return cached;
    throw err;
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const fetchPromise = fetch(req)
    .then(res => {
      if (res && res.status === 200) cache.put(req, res.clone());
      return res;
    })
    .catch(() => cached);
  return cached || fetchPromise;
}

/* ===== MESSAGE (skip waiting) ===== */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
