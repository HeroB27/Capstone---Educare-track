## What Already Exists (So We Don’t Rebuild)
- Guard module already records **tap-in/out** (currently via “type/scan into input”): [guard-dashboard.js](file:///c:/Users/Lenovo/Desktop/OFFICIAL%20EDUCARE%20TRACK/guard/guard-dashboard.js)
- Clinic module already manages **clinic passes** (approve + close visit), and sends **teacher notifications**: [clinic-dashboard.js](file:///c:/Users/Lenovo/Desktop/OFFICIAL%20EDUCARE%20TRACK/clinic/clinic-dashboard.js)
- Parent already has **real-time notifications + tap logs** subscriptions: [parent-dashboard.js](file:///c:/Users/Lenovo/Desktop/OFFICIAL%20EDUCARE%20TRACK/parent/parent-dashboard.js#L313-L334)
- Teacher already can issue clinic passes and subscribes to clinic/tap/notifications.

## Phase 4 Goal (0.0.1)
Implement **camera-based QR scanning** (jsQR) for Guard + Clinic + optional Teacher Gatekeeper, keep **real-time notifications**, and make relationships/workflows behave like the “pyramid” you described—without adding unnecessary layers.

## 1) Shared QR Scanning (jsQR) — One System For All
- Add a single shared module under `core/`:
  - `core/qr-camera.js` (name can be `core/scanner.js` if you prefer)
  - Responsibilities:
    - `initCameraScanner({ videoEl, onCode, onState })`
    - request camera, draw frames to an offscreen canvas, decode using **jsQR via CDN**
    - simple debounce (avoid repeated scans of same code within N seconds)
    - return a `stop()` function to release camera tracks
- Add a shared “QR parsing + student lookup + action recording” module:
  - `core/scan-actions.js`
  - Responsibilities (reused by Guard/Clinic/Teacher Gatekeeper):
    - Validate QR format (we’ll accept whatever is stored in `student_ids.qr_code` today; optionally add strict `EDU-YYYY-...` validation as a soft warning)
    - Lookup student via `student_ids` (existing behavior)
    - Record tap-in/out (existing behavior) and clinic entry
    - Write notifications (existing `notifications` table)

## 2) New Scanner Pages (Full-Screen, Mobile Friendly)
All three scanner pages will use the **same shared scanner modules**.

### Guard
- Add:
  - `guard/guard-scanner.html`
  - `guard/guard-scanner.js`
- Features:
  - Full-screen camera view + overlay instructions
  - Toggle: Tap In / Tap Out
  - On success: write `tap_logs`, update today’s `homeroom_attendance`, and notify parent
  - Keep the existing manual-input form in Guard Dashboard as a fallback

### Clinic
- Add:
  - `clinic/clinic-scanner.html`
  - `clinic/clinic-scanner.js`
- Features:
  - Full-screen camera view + overlay instructions
  - On scan: create/continue `clinic_visits` and notify **teacher + parent**
  - Optional: if there is a pending/approved `clinic_passes` row for that student, link it

### Teacher Gatekeeper (Optional)
- Add:
  - `teacher/teacher-gatekeeper-scanner.html`
  - `teacher/teacher-gatekeeper-scanner.js`
- Authorization:
  - Must be `role=teacher` and present in `system_settings.key='teacher_gatekeepers'` (already exists in Admin Settings)
- Uses the same tap-in/out logic as guard.

## 3) Clinic Dashboard Reshape (Match Requirements)
- Keep `clinic-dashboard.html/js`, but adjust UI and queries:
  - Section A: **Active clinic visits** (status `in_clinic`)
  - Section B: **Pending clinic passes** (status `pending`)
  - Simple filters: status + optional text search (student name)
  - Real-time refresh on `clinic_passes` and `clinic_visits`
- Add a dedicated approvals page (optional but matches your spec):
  - `clinic/clinic-pass-approval.html`
  - `clinic/clinic-pass-approval.js`
  - Focused list of pending passes with approve/reject

## 4) Notifications (Make The Pyramid Real)
- Continue using `notifications` table (already wired to parent/teacher realtime).
- Add missing clinic→parent notifications:
  - When pass approved
  - When student arrives at clinic (scanner)
  - When visit closed with notes summary
- Keep payloads simple:
  - `verb`: `tap_in`, `tap_out`, `clinic_pass_approved`, `clinic_arrived`, `clinic_visit_done`
  - `object`: `{ student_id, pass_id?, clinic_visit_id?, timestamp, notes? }`

## 5) Tap Rules (Simple + Realistic)
- Reuse existing attendance rule lookup (`attendance_rules`)
- Implement minimal “realistic” statuses:
  - `present` vs `late` on tap-in (already)
  - Duplicate scan guard: if same student + same action within a short window, log `tap_logs.status='duplicate'` and do not re-update attendance
  - Keep partial/early-exit as future enhancement unless we already have dismissal times in DB

## 6) Supabase RLS / Grants (Minimum To Make Guard/Clinic Work)
- Add a Phase 4 migration SQL file (incremental):
  - Policies so **guard can**:
    - read `student_ids` and `attendance_rules`
    - insert `tap_logs`
    - upsert/update `homeroom_attendance`
    - update `students.current_status` (or, if you prefer stricter security, we can stop writing `current_status` and derive it from tap logs)
  - Policies so **clinic can**:
    - create/update `clinic_visits`
    - update `clinic_passes`
    - insert notifications to teacher/parent
  - Add missing `public.is_admin()` function in migration if it truly doesn’t exist in your DB (repo currently references it)

## 7) UI / Tailwind + “Creative Fonts”
- Update [theme.css](file:///c:/Users/Lenovo/Desktop/OFFICIAL%20EDUCARE%20TRACK/core/theme.css) to use a **two-font system**:
  - Display font for headings (creative)
  - Clean readable font for body
- Keep it simple:
  - add Google Fonts import
  - use CSS vars like `--font-body` and `--font-display`
  - apply display font to `.page-title` and sidebar brand; keep body font everywhere else

## Verification
- Load scanner pages and confirm:
  - camera starts/stops
  - codes decode reliably
  - writes appear in `tap_logs` / `clinic_visits` / `clinic_passes`
  - parent/teacher dashboards receive realtime notifications
- Validate RLS by testing as guard/clinic users (no service key in browser).

## Note
If anything starts feeling like “10 extra layers”, we stop and simplify back to the most direct Supabase calls + minimal shared helpers.