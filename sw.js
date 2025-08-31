// QuickDiff Service Worker - Minimal offline support
const CACHE_NAME = 'quickdiff-v1';
const STATIC_ASSETS = [
  './index.html',
  './manifest.json'
];

// Install event - cache essential assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;
  
  // Handle Monaco Editor CDN requests
  if (event.request.url.includes('cdn.jsdelivr.net')) {
    event.respondWith(
      caches.open(CACHE_NAME)
        .then((cache) => {
          return cache.match(event.request)
            .then((response) => {
              if (response) {
                return response;
              }
              // Try to fetch and cache
              return fetch(event.request)
                .then((fetchResponse) => {
                  cache.put(event.request, fetchResponse.clone());
                  return fetchResponse;
                })
                .catch(() => {
                  // Fallback for offline - return a basic response
                  console.log('Monaco Editor offline, using cached version if available');
                });
            });
        })
    );
    return;
  }
  
  // Handle app files
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      })
      .catch(() => {
        // If offline and no cache, return the main app
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      })
  );
});
