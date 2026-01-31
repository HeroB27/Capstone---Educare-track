## Issues Identified
- Scanner shows two images because both video and canvas are appended visibly in reader; canvas should be offscreen/hidden.
- Parent dashboard does not surface notifications, so Guard → Parent alerts are inserted but not displayed to parents.
- Need end-to-end checks for:
  - Admin → Teacher creation & gatekeeper toggle
  - Admin → Guard creation
  - Guard → Teacher → Admin attendance chain
  - Guard → Parent notifications visibility

## Proposed Fixes
- Scanner UI
  - Use an offscreen canvas (do not append to DOM) or set canvas.style.display='none'.
  - Ensure only the video element is visible; keep decoding via jsQR on the hidden canvas.
  - Optional: pause decoding for 800ms after a successful decode to reduce rapid duplicate reads.
- Parent Notifications
  - Add notifications list to parent-dashboard.js: fetch unread and recent, subscribe to real-time inserts.
  - Minimal UI in parent-dashboard.html: notifications panel under the existing section.

## Validation Steps
- Guard: Scan a QR; confirm single preview image; single attendance insert; student current_status toggles.
- Parent: Receive and see notification in dashboard; mark as read.
- Teacher: Open attendance page; confirm today’s rows reflect guard scans; perform validation.
- Admin: Create teacher/guard; toggle gatekeeper; see attendance logs and audit inserts.

## Deliverables
- Update js/guard-scanner.js and js/guard-dashboard.js to hide canvas / use offscreen canvas and throttle post-decode.
- Update parent-dashboard.js/html to render notifications and subscribe to real-time.

I will implement these changes and provide the updated files and quick verification results. Confirm to proceed.