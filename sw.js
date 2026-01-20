const CACHE_NAME = 'anadi-erp-v2'; 
const urlsToCache = [
  './index.html',
  './anadiaashram.html', // Make sure aapke file names sahi ho
  './anadibilling.html',
  './anadicowshelter.html',
  './expensemanagment.html',
  './inventorystock.html'
];


self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});
