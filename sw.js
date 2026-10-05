/* Copyright (c) 2026 Shirangi. All rights reserved. */
/* Shirangi service worker — stale-runtime resistant, offline-capable shell. */
const CACHE_NAME = 'shirangi-kiosk-v14-local-ui';
// Legacy cache contract retained for migration/audit compatibility: shirangi-kiosk-v13-production-safe
const SHELL = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png', '/app/tailwind.css', '/app/shell.css', '/vendor/fonts/NotoSansArabic-Regular.ttf', '/vendor/fonts/NotoSansArabic-Bold.ttf'];
const STATIC_ASSET = /\.(?:png|jpg|jpeg|webp|svg|ico|woff2?|ttf)$/i;

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const cacheResponse = async (request, response) => {
  if (request.method === 'GET' && response?.ok && response.type === 'basic') {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
};

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  const isStatic = STATIC_ASSET.test(new URL(request.url).pathname);
  if (isStatic) {
    event.respondWith(
      caches.match(request).then(cached => cached || fetch(request).then(response => cacheResponse(request, response)))
    );
    return;
  }

  // Network-first: HTML/JS/CSS must not be masked by an old cached runtime.
  event.respondWith(
    fetch(request)
      .then(response => cacheResponse(request, response))
      .catch(() => caches.match(request).then(cached => cached || caches.match('/index.html')))
  );
});
