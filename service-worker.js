const CACHE_NAME = 'educare-track-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/css/offline-fallback.css',
  '/js/supabase-config.js',
  '/js/utils.js',
  '/js/auth.js',
  '/pages/admin-dashboard.html',
  '/pages/teacher-dashboard.html',
  '/pages/parent-dashboard.html',
  '/pages/guard-dashboard.html',
  '/pages/clinic-dashboard.html',
  '/js/admin-dashboard.js',
  '/js/teacher-dashboard.js',
  '/js/parent-dashboard.js',
  '/js/guard-dashboard.js',
  '/js/clinic-dashboard.js',
  'https://unpkg.com/lucide@latest',
  'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
  clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Strategy: Stale-While-Revalidate
  if (event.request.method === 'GET') {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((response) => {
          const fetchPromise = fetch(event.request).then((networkResponse) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
          return response || fetchPromise;
        });
      })
    );
  }
});

// Background Sync for offline scans
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-scans') {
    event.waitUntil(syncScans());
  }
});

async function syncScans() {
  const allClients = await clients.matchAll();
  allClients.forEach(client => {
    client.postMessage({ type: 'SYNC_REQUIRED' });
  });
}
