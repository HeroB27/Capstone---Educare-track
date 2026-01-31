# Offline-Ready System & CSS Fallback Plan

This plan ensures the system remains functional and visually coherent even when offline or when external CDNs (like Tailwind) are unreachable.

## 1. Local CSS Fallback (Tailwind Backup)
- **Create [offline-fallback.css](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/css/offline-fallback.css)**:
  - Implement a "Mini-Tailwind" containing essential layout utilities (flex, grid, padding, margin, width).
  - Add core dashboard components (sidebar, main container, cards, buttons) with role-specific color variables.
- **Update HTML Files**:
  - Add a fallback mechanism in the `<head>`:
    ```html
    <script>
      // Detect if Tailwind CDN failed
      window.addEventListener('error', function(e) {
        if (e.target.tagName === 'LINK' && e.target.href.includes('tailwindcss')) {
          const fallback = document.createElement('link');
          fallback.rel = 'stylesheet';
          fallback.href = '../css/offline-fallback.css';
          document.head.appendChild(fallback);
        }
      }, true);
    </script>
    ```

## 2. Robust Service Worker (PWA Core)
- **Update [service-worker.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/service-worker.js)**:
  - Expand the `ASSETS` list to include all role-specific dashboards, icons, and the new fallback CSS.
  - Implement a "Stale-While-Revalidate" strategy for better offline performance.
  - Ensure the manifest and all critical JS files are cached.

## 3. Global Offline Awareness
- **Update [utils.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/utils.js)**:
  - Add `utils.initOfflineMonitoring()`:
    - Injects a real-time "Offline Mode" banner at the top of the screen when connection is lost.
    - Provides a "Retry Sync" button for queued data.

## 4. Guard Dashboard - Offline Scanning
- **Enhance [guard-dashboard.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/guard-dashboard.js)**:
  - Implement `offline_scans` queue in LocalStorage.
  - If Supabase is unreachable, save the scan locally with a timestamp and "pending" status.
  - Automatically sync queued scans to the `attendance` table when the connection returns.

## 5. Verification
- **Test Tailwind Failure**: Block `cdn.tailwindcss.com` in the browser dev tools and verify the layout remains usable.
- **Test Offline Scanning**: Toggle "Offline" in dev tools, perform a scan, and verify it syncs once "Online" is toggled back.

Shall I proceed with creating the CSS fallback and updating the service worker?