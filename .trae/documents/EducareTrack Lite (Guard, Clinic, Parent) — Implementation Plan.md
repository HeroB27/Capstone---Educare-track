## Scope & Alignment
- Focus roles: Guard (Gatekeeper), Clinic (Nurse/Staff), Parent.
- Map strictly to existing schema: students, attendance, qr_codes, clinic_visits, notifications, parent_students, profiles.
- Use centralized attendance with append-only rows; update students.current_status on gate actions.

## Data Model Mapping
- students: id (text QR ID), full_name, class_id, current_status, photo_url.
- attendance: student_id (text), timestamp, status, entry_type, session, method, recorded_by, remarks, class_id.
- qr_codes: student_id (text), qr_hash, is_active.
- clinic_visits: student_id, reason, notes, treated_by, visit_time, status.
- notifications: recipient_id, actor_id, verb, object, read, created_at.
- excuse_letters (Parent uploads): id, student_id, parent_id, reason, issued_at, status.

## Frontend Architecture
- Pure HTML + JS + Tailwind; PWA-capable.
- Shared modules: supabase-config.js, utils.js (auth, toast, time, queues), qr.js (WebRTC/USB), notify.js (in-app notifications), pwa (service-worker.js, manifest.json).
- Role pages:
  - guard-dashboard.html/js (scanner, live logs, search, overrides, notifications)
  - clinic-dashboard.html/js (check-in scanner, active patients, history, notifications)
  - parent-dashboard.html/js (live status, calendar, timeline, excuse upload, notifications)
- Optional feature pages/components per role:
  - guard-scanner.html/js (standalone scanner module; embeddable in dashboard)

## Auth & Routing
- Read profiles role and gatekeeper flag to route:
  - Guard: profiles.role in ['guard','teacher' with is_gatekeeper=true]
  - Clinic: profiles.role='clinic'
  - Parent: profiles.role='parent'
- Simple role-based client routing using querystring or localStorage session; serverless with Supabase.

## QR Scan Engine
- WebRTC camera scanning (mobile): process video stream; decode QR; debounce; haptic feedback.
- USB scanner (desktop): listen to key events; capture scanned text; normalize.
- Normalize QR to EDU-YYYY-LLLL-XXXX; fallback to exact student_id lookup.

## Attendance Engine (Gate)
- Derive session: timestamp hour < 12 → 'AM' else 'PM'.
- Tap-in logic outputs status flag and writes:
  - INSERT attendance row: {student_id, class_id, status: present|late|morning_absent|afternoon_absent, entry_type:'entry', session, method:'qr', recorded_by, remarks}
  - Update students.current_status: 'in'
  - Create notification to parent.
- Tap-out logic outputs status flag and writes:
  - INSERT attendance row: {student_id, status: early_exit|late_exit|afternoon_absent, entry_type:'exit', ...}
  - Update students.current_status: 'out'
  - Create notification to parent.
- Duplicate scan handling: soft-ignore with warning; still log if different entry_type.

## Clinic Workflow
- Check-in: scan student; create clinic_visits row {reason, notes, treated_by, status:'in_clinic'}; notify parent.
- Update status:
  - Returned to class → clinic_visits.status:'returned'; optional attendance insert with remarks.
  - Sent home → clinic_visits.status:'sent_home'; INSERT attendance row with status:'excused' or 'absent' per policy; notify parent.

## Parent Dashboard
- Live status via real-time listeners on students.current_status and latest attendance.
- History timeline from attendance (order by timestamp desc).
- Calendar view: aggregate per day from attendance; color-code present/late/absent/excused.
- Excuse letter upload: create excuse_letters row; upload file to storage (bucket: 'excuses'); notify homeroom/admin (verb:'excuse_submitted').
- Clinic records: list clinic_visits filtered by student_id; provide download (PDF generation client-side).

## Notification System
- notify.js: unified in-app panel + toasts.
- Persist notifications via notifications table: {recipient_id, actor_id, verb, object json, read=false}.
- PWA push: service-worker displays push; enqueue offline messages.

## PWA Setup
- manifest.json: name, icons, start_url per role pages, display:'standalone'.
- service-worker.js: offline scan queue (IndexedDB), background sync to flush queued scans/clinic updates when online, cache static assets.

## File Structure
- /pages
  - guard-dashboard.html
  - parent-dashboard.html
  - clinic-dashboard.html
  - guard-scanner.html (modular scanner)
- /js
  - supabase-config.js
  - utils.js
  - qr.js
  - notify.js
  - guard-dashboard.js
  - parent-dashboard.js
  - clinic-dashboard.js
  - guard-scanner.js
- /css
  - styles.css
- /pwa
  - service-worker.js
  - manifest.json

## Implementation Highlights
- Guard Dashboard
  - Sidebar: Scanner, Today’s Logs, Search, Manual Override, Notifications.
  - Main: Live scan panel, student card, status badge, scan history table.
  - Functions: handleScan, applyTapLogic, writeAttendance, updateCurrentStatus, notifyParent.
- Clinic Dashboard
  - Sidebar: Check-in, Active Patients, History, Notifications.
  - Main: Profile card, reason selector, notes, status buttons, discharge.
  - Functions: checkInClinic, updateClinicStatus, writeAttendanceImpact, notifyParent.
- Parent Dashboard
  - Sidebar: Child Status, Attendance History, Clinic Records, Upload Excuse, Notifications.
  - Main: Status cards, calendar view, timeline, upload modal.
  - Functions: subscribeLiveStatus, renderCalendar, renderTimeline, uploadExcuse.

## Real-Time & Offline
- Subscribe to Supabase channel/table changes for attendance, clinic_visits, notifications.
- Offline queue for scans/clinic updates; flush with background sync.

## Validation & QA
- Gate flow tests: morning tap-in, late, duplicate, tap-out early/late.
- Clinic flow tests: in clinic → returned → sent home paths.
- Parent: calendar aggregation vs timeline consistency; file upload roundtrip.
- PWA installability and offline queue replay.

## Deliverables (to be created)
- Pages, JS modules, styles, PWA files listed above.
- Role-aware utils and QR engine.
- Supabase queries aligned to existing schema; no new tables/columns.

Confirm and I will generate all files with working HTML/JS, Tailwind UI, PWA scaffolding, and role logic, plus real-time listeners and offline queues.