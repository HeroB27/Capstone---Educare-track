// Educare Track PWA Module - Phase 7 Enhanced Version

// Service worker registration and management
export async function registerPwa() {
  if (!("serviceWorker" in navigator)) {
    console.warn("[PWA] Service Worker not supported");
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register("/service-worker.js", { scope: "/" });
    
    console.log("[PWA] Service Worker registered:", registration.scope);
    
    // Handle updates
    registration.addEventListener("updatefound", () => {
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            // New content available, notify user
            dispatchEvent(new CustomEvent("sw-update-available"));
          }
        });
      }
    });
    
    return registration;
  } catch (error) {
    console.error("[PWA] Service Worker registration failed:", error);
    return null;
  }
}

// Get service worker registration
export async function getServiceWorkerRegistration() {
  if (!("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.ready;
}

// Request notification permission
export async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    console.warn("[PWA] Notifications not supported");
    return "unsupported";
  }

  if (Notification.permission === "granted") {
    return "granted";
  }

  if (Notification.permission === "denied") {
    return "denied";
  }

  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (error) {
    console.error("[PWA] Notification permission request failed:", error);
    return "denied";
  }
}

// Subscribe to push notifications
export async function subscribeToPush() {
  const permission = await requestNotificationPermission();
  if (permission !== "granted") {
    return { error: "Notification permission denied" };
  }

  try {
    const registration = await getServiceWorkerRegistration();
    if (!registration) {
      return { error: "Service Worker not available" };
    }

    // Check if already subscribed
    let subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      return { subscription };
    }

    // VAPID public key (would be configured per deployment)
    const vapidPublicKey = await getVapidPublicKey();
    
    if (!vapidPublicKey) {
      return { error: "VAPID key not configured" };
    }

    // Subscribe to push
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
    });

    return { subscription };
  } catch (error) {
    console.error("[PWA] Push subscription failed:", error);
    return { error: error.message };
  }
}

// Unsubscribe from push notifications
export async function unsubscribeFromPush() {
  try {
    const registration = await getServiceWorkerRegistration();
    if (!registration) return { error: "Service Worker not available" };

    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
    }

    return { success: true };
  } catch (error) {
    console.error("[PWA] Push unsubscribe failed:", error);
    return { error: error.message };
  }
}

// Get VAPID public key from server
async function getVapidPublicKey() {
  // This would typically be fetched from your server
  // For now, return null and handle gracefully
  try {
    const response = await fetch("/api/vapid-public-key");
    if (response.ok) {
      const data = await response.json();
      return data.publicKey;
    }
  } catch {
    // Server not configured for push
  }
  return null;
}

// Utility function to convert VAPID key
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Check if app is installed
export function isAppInstalled() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true ||
    document.referrer.includes("android-app://") ||
    document.referrer.includes("ios-app://")
  );
}

// Request app installation
export async function requestInstallPrompt() {
  const isStandalone = isAppInstalled();
  
  if (isStandalone) {
    return null;
  }

  if (!("beforeinstallprompt" in window)) {
    return null;
  }

  const event = window.beforeinstallprompt;
  
  // Prevent automatic showing
  event.preventDefault();
  
  return event;
}

// Show install prompt
export async function showInstallPrompt(installEvent) {
  if (!installEvent) {
    installEvent = await requestInstallPrompt();
  }
  
  if (!installEvent) {
    return { error: "Install prompt not available" };
  }

  try {
    const result = await installEvent.prompt();
    return { result };
  } catch (error) {
    console.error("[PWA] Install prompt failed:", error);
    return { error: error.message };
  }
}

// Check online status
export function isOnline() {
  return navigator.onLine;
}

// Add online/offline listeners
export function addConnectivityListeners(onOnline, onOffline) {
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
  
  // Return cleanup function
  return () => {
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
  };
}

// Sync offline queue
export async function triggerOfflineSync() {
  try {
    const registration = await getServiceWorkerRegistration();
    if (registration && "sync" in registration) {
      await registration.sync.register("sync-offline-queue");
      return { success: true };
    }
    return { error: "Background sync not supported" };
  } catch (error) {
    console.error("[PWA] Offline sync failed:", error);
    return { error: error.message };
  }
}

// Get cached pages
export async function getCachedPages() {
  try {
    const cache = await caches.open("educare-dynamic-v7");
    const requests = await cache.keys();
    return requests.map(r => r.url);
  } catch (error) {
    console.error("[PWA] Failed to get cached pages:", error);
    return [];
  }
}

// Clear all caches
export async function clearAllCaches() {
  try {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
    return { success: true };
  } catch (error) {
    console.error("[PWA] Failed to clear caches:", error);
    return { error: error.message };
  }
}

// Update service worker
export async function updateServiceWorker() {
  const registration = await navigator.serviceWorker.getRegistration();
  if (registration && registration.waiting) {
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
    window.location.reload();
    return { success: true };
  }
  return { error: "No update available" };
}

// Initialize PWA features
export async function initPwa() {
  const registration = await registerPwa();
  
  // Check connectivity
  const onlineStatus = isOnline();
  
  // Add connectivity listeners
  const cleanupListeners = addConnectivityListeners(
    () => {
      console.log("[PWA] Online - syncing offline data");
      dispatchEvent(new CustomEvent("pwa-online"));
      triggerOfflineSync();
    },
    () => {
      console.log("[PWA] Offline - data will be queued");
      dispatchEvent(new CustomEvent("pwa-offline"));
    }
  );

  return {
    registration,
    isOnline: onlineStatus,
    cleanupListeners,
    isInstalled: isAppInstalled()
  };
}

export default {
  registerPwa,
  getServiceWorkerRegistration,
  requestNotificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
  isOnline,
  addConnectivityListeners,
  triggerOfflineSync,
  clearAllCaches,
  updateServiceWorker,
  initPwa,
  isAppInstalled,
  requestInstallPrompt,
  showInstallPrompt
};
