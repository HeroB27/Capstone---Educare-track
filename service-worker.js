// Educare Track Service Worker - Phase 7 Enhanced Version
const CACHE_NAME = "educare-track-v7.0.2";
const STATIC_CACHE = "educare-static-v7.2";
const DYNAMIC_CACHE = "educare-dynamic-v7.2";
const OFFLINE_QUEUE = "educare-offline-queue-v7.2";

// Assets to precache for offline functionality
const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/pwa/icon.svg",
  // Auth
  "/auth/login.html",
  "/auth/login.js",
  // Core
  "/core/config.js",
  "/core/core.js",
  "/core/pwa.js",
  "/core/ui.js",
  "/core/shell.js",
  "/core/theme.css",
  // Admin
  "/admin/admin-dashboard.html",
  "/admin/admin-dashboard.js",
  "/admin/admin-common.js",
  "/admin/admin-users.html",
  "/admin/admin-users.js",
  "/admin/admin-classes.html",
  "/admin/admin-classes.js",
  "/admin/admin-attendance.html",
  "/admin/admin-attendance.js",
  "/admin/admin-idcards.html",
  "/admin/admin-idcards.js",
  "/admin/admin-idcards-print.html",
  "/admin/admin-idcards-print.js",
  "/admin/admin-parent-students.html",
  "/admin/admin-parent-students.js",
  "/admin/admin-announcements.html",
  "/admin/admin-announcements.js",
  "/admin/admin-calendar.html",
  "/admin/admin-calendar.js",
  "/admin/admin-settings.html",
  "/admin/admin-settings.js",
  "/admin/admin-people.html",
  "/admin/admin-people.js",
  "/admin/admin-communications.html",
  "/admin/admin-communications.js",
  // Teacher
  "/teacher/teacher-dashboard.html",
  "/teacher/teacher-dashboard.js",
  "/teacher/teacher-common.js",
  "/teacher/teacher-excuse.html",
  "/teacher/teacher-excuse.js",
  "/teacher/teacher-announcements.html",
  "/teacher/teacher-announcements.js",
  "/teacher/teacher-subject-attendance.html",
  "/teacher/teacher-subject-attendance.js",
  "/teacher/teacher-gatekeeper-scanner.html",
  "/teacher/teacher-gatekeeper-scanner.js",
  // Parent
  "/parent/parent-dashboard.html",
  "/parent/parent-dashboard.js",
  "/parent/parent-common.js",
  "/parent/parent-excuse-upload.html",
  "/parent/parent-excuse-upload.js",
  // Guard
  "/guard/guard-dashboard.html",
  "/guard/guard-dashboard.js",
  "/guard/guard-scanner.html",
  "/guard/guard-scanner.js",
  // Clinic
  "/clinic/clinic-dashboard.html",
  "/clinic/clinic-dashboard.js",
  "/clinic/clinic-scanner.html",
  "/clinic/clinic-scanner.js",
  "/clinic/clinic-pass-approval.html",
  "/clinic/clinic-pass-approval.js",
];

// API routes that should use network-first strategy
const API_ROUTES = [
  "/rest/v1/",
  "/storage/v1/",
];

// Install event - precache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      // Open static cache and add precache URLs
      const staticCache = await caches.open(STATIC_CACHE);
      await staticCache.addAll(PRECACHE_URLS.map(url => {
        return new Request(url, { cache: "reload" });
      }));
      
      // Initialize offline queue storage
      await initOfflineQueue();
      
      // Skip waiting to activate immediately
      await self.skipWaiting();
      console.log("[SW] Service Worker installed successfully");
    })()
  );
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Remove old caches
      const cacheNames = await caches.keys();
      const oldCaches = cacheNames.filter(name => {
        return name !== STATIC_CACHE && 
               name !== DYNAMIC_CACHE && 
               name !== OFFLINE_QUEUE &&
               name.startsWith("educare-");
      });
      
      await Promise.all(oldCaches.map(name => caches.delete(name)));
      
      // Claim all clients immediately
      await self.clients.claim();
      console.log("[SW] Service Worker activated");
    })()
  );
});

// Fetch event - implement caching strategies
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  
  // Skip non-GET requests for caching (except for offline queue handling)
  if (req.method !== "GET") {
    // Handle POST requests for offline queue
    if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
      event.respondWith(handleWriteRequest(req));
    }
    return;
  }
  
  // Skip cross-origin requests (except Supabase)
  if (url.origin !== self.location.origin && !url.hostname.includes("supabase")) {
    return;
  }

  // DEVELOPMENT OVERRIDE: Always network-first on localhost
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
    event.respondWith(networkFirst(req));
    return;
  }
  
  // API requests - network first, fallback to cache
  if (isApiRequest(url)) {
    event.respondWith(networkFirst(req));
    return;
  }
  
  // Static assets - cache first, then network
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(req));
    return;
  }
  
  // HTML pages - network first with cache fallback
  if (req.headers.get("accept")?.includes("text/html")) {
    event.respondWith(networkFirstWithOfflineFallback(req));
    return;
  }
  
  // Default - stale-while-revalidate
  event.respondWith(staleWhileRevalidate(req));
});

// Helper function to check if request is for API
function isApiRequest(url) {
  return API_ROUTES.some(route => url.pathname.includes(route));
}

// Helper function to check if request is for static asset
function isStaticAsset(url) {
  const staticExtensions = [".js", ".css", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".woff", ".woff2", ".ttf"];
  return staticExtensions.some(ext => url.pathname.endsWith(ext));
}

// Cache-first strategy
async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) {
    return cached;
  }
  
  try {
    const response = await fetch(req);
    // Only cache successful responses
    if (response.status === 200) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(req, response.clone());
    }
    return response;
  } catch (error) {
    // For favicon and other non-critical resources, return a placeholder
    if (req.url.includes('favicon')) {
      return new Response('', { status: 200, statusText: 'OK' });
    }
    // Return a placeholder for any other failed resources
    console.warn("[SW] Cache first failed for:", req.url, error);
    return new Response('', { status: 200 });
  }
}

// Network-first strategy
async function networkFirst(req) {
  try {
    const response = await fetch(req);
    if (response.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(req, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(req);
    if (cached) {
      return cached;
    }
    throw error;
  }
}

// Network first with offline fallback for HTML pages
async function networkFirstWithOfflineFallback(req) {
  try {
    const response = await fetch(req);
    if (response.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(req, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(req);
    if (cached) {
      return cached;
    }
    
    // Return offline page if available
    const offlinePage = await caches.match("/auth/login.html");
    if (offlinePage) {
      return offlinePage;
    }
    
    // Create a basic offline response
    return new Response(
      `<!DOCTYPE html>
      <html>
      <head><title>Offline</title></head>
      <body>
        <h1>You are offline</h1>
        <p>Please check your connection and try again.</p>
      </body>
      </html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }
}

// Stale-while-revalidate strategy
async function staleWhileRevalidate(req) {
  const cached = await caches.match(req);
  
  const fetchPromise = fetch(req).then(response => {
    if (response.status === 200) {
      const cache = caches.open(DYNAMIC_CACHE);
      cache.then(c => c.put(req, response.clone()));
    }
    return response;
  }).catch(() => {
    // Network failed, return cached version if available
    return cached;
  });
  
  return cached || fetchPromise;
}

// Handle write requests for offline queue
async function handleWriteRequest(req) {
  try {
    // Try to make the request
    const response = await fetch(req);
    return response;
  } catch (error) {
    // Network failed, queue for later
    const queue = await getOfflineQueue();
    const requestData = {
      url: req.url,
      method: req.method,
      headers: Object.fromEntries(req.headers.entries()),
      body: await req.clone().text(),
      timestamp: Date.now(),
    };
    
    queue.push(requestData);
    await saveOfflineQueue(queue);
    
    // Return a queued response
    return new Response(JSON.stringify({
      queued: true,
      message: "Request queued for sync when online",
      timestamp: requestData.timestamp
    }), {
      headers: { "Content-Type": "application/json" }
    });
  }
}

// IndexedDB operations for offline queue
async function initOfflineQueue() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("EducareOfflineDB", 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("queue")) {
        db.createObjectStore("queue", { keyPath: "timestamp" });
      }
      if (!db.objectStoreNames.contains("cache")) {
        db.createObjectStore("cache", { keyPath: "url" });
      }
    };
  });
}

async function getOfflineQueue() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("EducareOfflineDB", 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = async () => {
      const db = request.result;
      const tx = db.transaction("queue", "readonly");
      const store = tx.objectStore("queue");
      const getAll = store.getAll();
      
      getAll.onsuccess = () => resolve(getAll.result || []);
      getAll.onerror = () => reject(getAll.error);
    };
  });
}

async function saveOfflineQueue(queue) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("EducareOfflineDB", 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = async () => {
      const db = request.result;
      const tx = db.transaction("queue", "readwrite");
      const store = tx.objectStore("queue");
      
      // Clear existing and add all items
      store.clear();
      queue.forEach(item => store.add(item));
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
  });
}

async function clearOfflineQueue() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("EducareOfflineDB", 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = async () => {
      const db = request.result;
      const tx = db.transaction("queue", "readwrite");
      const store = tx.objectStore("queue");
      store.clear();
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
  });
}

// Background sync for offline queue
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-offline-queue") {
    event.waitUntil(syncOfflineQueue());
  }
});

async function syncOfflineQueue() {
  const queue = await getOfflineQueue();
  const failedItems = [];
  
  for (const item of queue) {
    try {
      const options = {
        method: item.method,
        headers: item.headers,
      };
      
      if (item.body && item.method !== "GET") {
        options.body = item.body;
      }
      
      const response = await fetch(item.url, options);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error("[SW] Failed to sync item:", item, error);
      failedItems.push(item);
    }
  }
  
  // Update queue with only failed items
  await saveOfflineQueue(failedItems);
  
  if (failedItems.length === 0) {
    console.log("[SW] Offline queue synced successfully");
  }
}

// Push notification handling
self.addEventListener("push", (event) => {
  if (!event.data) return;
  
  const data = event.data.json();
  
  const options = {
    body: data.body || "New notification from Educare Track",
    icon: "/pwa/icon.svg",
    badge: "/pwa/icon.svg",
    vibrate: [100, 50, 100],
    data: data.data || {},
    actions: data.actions || [],
    tag: data.tag || "educare-notification",
    renotify: true,
    requireInteraction: data.requireInteraction || false,
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || "Educare Track", options)
  );
});

// Notification click handling
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  
  const data = event.notification.data;
  let url = "/";
  
  // Determine URL based on notification type
  if (data?.type === "announcement") {
    url = "/parent/parent-dashboard.html";
  } else if (data?.type === "excuse") {
    url = "/parent/parent-excuse-upload.html";
  } else if (data?.type === "clinic") {
    url = "/parent/parent-dashboard.html";
  } else if (data?.url) {
    url = data.url;
  }
  
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing window if available
        for (const client of clientList) {
          if (client.url === url && "focus" in client) {
            return client.focus();
          }
        }
        // Open new window if none exists
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});

// Message handling from main app
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  
  if (event.data?.type === "CACHE_URLS") {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(DYNAMIC_CACHE);
        await cache.addAll(event.data.urls);
      })()
    );
  }
  
  if (event.data?.type === "CLEAR_CACHE") {
    event.waitUntil(
      (async () => {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      })()
    );
  }
  
  if (event.data?.type === "TRIGGER_SYNC") {
    event.waitUntil(syncOfflineQueue());
  }
});

// Periodic background sync for fresh data (if supported)
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "update-content") {
    event.waitUntil(updateBackgroundContent());
  }
});

async function updateBackgroundContent() {
  // Precache commonly accessed pages in background
  const pagesToPrecache = [
    "/teacher/teacher-dashboard.html",
    "/parent/parent-dashboard.html",
  ];
  
  try {
    const cache = await caches.open(DYNAMIC_CACHE);
    await cache.addAll(pagesToPrecache.map(url => {
      return new Request(url, { cache: "reload" });
    }));
    console.log("[SW] Background content updated");
  } catch (error) {
    console.error("[SW] Background update failed:", error);
  }
}

console.log("[SW] Educare Track Service Worker loaded");
