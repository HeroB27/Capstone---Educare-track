const CACHE_NAME = "educare-track-v0.0.1";
const PRECACHE_URLS = [
  "/",
  "/manifest.json",
  "/pwa/icon.svg",
  "/auth/login.html",
  "/auth/login.js",
  "/core/config.js",
  "/core/core.js",
  "/core/pwa.js",
  "/core/ui.js",
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
  "/teacher/teacher-dashboard.html",
  "/teacher/teacher-dashboard.js",
  "/teacher/teacher-common.js",
  "/teacher/teacher-excuse.html",
  "/teacher/teacher-excuse.js",
  "/teacher/teacher-announcements.html",
  "/teacher/teacher-announcements.js",
  "/parent/parent-dashboard.html",
  "/parent/parent-dashboard.js",
  "/parent/parent-common.js",
  "/parent/parent-excuse-upload.html",
  "/parent/parent-excuse-upload.js",
  "/guard/guard-dashboard.html",
  "/guard/guard-dashboard.js",
  "/clinic/clinic-dashboard.html",
  "/clinic/clinic-dashboard.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(PRECACHE_URLS);
      self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (res && res.status === 200) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, res.clone());
        }
        return res;
      } catch {
        const fallback = await caches.match("/auth/login.html");
        if (fallback) return fallback;
        throw new Error("Offline");
      }
    })()
  );
});
