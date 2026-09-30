const CACHE_NAME = 'xdock-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/checklist.html',
  '/dashboard.html',
  '/archive.html',
  '/css/common.css',
  '/js/config.js',
  '/js/utils.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  // API 요청은 네트워크 우선(Network First)
  if (event.request.url.includes('workers.dev')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }
  
  // 정적 파일은 캐시 우선(Cache First)
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
