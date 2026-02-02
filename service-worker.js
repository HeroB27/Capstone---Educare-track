self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Graceful cleanup: clear caches and unregister without interrupting the UI
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (e) {}

    try {
      // Passive unregistration - let the worker finish its lifecycle
      await self.registration.unregister();
    } catch (e) {}
  })());
});
