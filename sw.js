/* PaintStock — Service Worker
   Zapewnia działanie offline po pierwszym załadowaniu.
   - Pliki aplikacji: stale-while-revalidate (natychmiast z pamięci, w tle odświeżenie).
   - Biblioteki z CDN (ZXing, Tesseract.js + dane językowe): cache-first.
   Dane użytkownika NIE przechodzą przez Service Worker — są w IndexedDB. */
const VERSION = 'paintstock-v1.1.0';
const CORE_CACHE = VERSION + '-core';
const RUNTIME_CACHE = 'paintstock-runtime-v1';

const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];
const CDN_HOSTS = ['cdn.jsdelivr.net', 'unpkg.com', 'tessdata.projectnaptha.com'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CORE_CACHE);
    // Pojedynczo — brak jednego pliku nie blokuje instalacji.
    await Promise.all(CORE.map(url => cache.add(new Request(url, { cache: 'reload' })).catch(err => console.warn('[SW] pominięto', url, err))));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('paintstock-') && k !== CORE_CACHE && k !== RUNTIME_CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

async function staleWhileRevalidate(request, cacheKey) {
  const cache = await caches.open(CORE_CACHE);
  const cached = await cache.match(cacheKey || request, { ignoreSearch: true });
  const network = fetch(request).then(res => {
    if (res && res.ok) cache.put(cacheKey || request, res.clone());
    return res;
  }).catch(() => null);
  return cached || (await network) || new Response('Offline — brak zapisanej kopii.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

async function cacheFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res && (res.ok || res.type === 'opaque')) cache.put(request, res.clone()).catch(() => {});
  return res;
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    if (req.mode === 'navigate') {
      event.respondWith(staleWhileRevalidate(req, './index.html'));
    } else {
      event.respondWith(staleWhileRevalidate(req));
    }
    return;
  }
  if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(req));
  }
  // Wszystko inne idzie normalnie do sieci (aplikacja nie wysyła danych na zewnątrz).
});
