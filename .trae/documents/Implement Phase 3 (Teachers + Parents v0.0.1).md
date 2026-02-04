## What “Implement Phase 3” Means Here
Phase 3 = build real Teacher + Parent workflows (web + PWA baseline) on top of the existing Supabase schema and the already-working role-based login/redirect.

## Current Repo State (Quick Findings)
- Teacher/Parent/Guard/Clinic dashboards exist but are stubs (auth + role gate only).
- The reset SQL already defines required core tables: classes, class_schedules, students, homeroom_attendance, subject_attendance, tap_logs, excuse_letters, clinic_visits, clinic_passes, notifications, announcements.
- RLS is currently admin-only for most tables; teacher/parent RLS policies are not implemented yet.
- `excuse_letters` currently has no file attachment fields; Phase 3 requires Storage + file references.

## Implementation Plan (v0.0.1)

## 1) Database + RLS + Storage (Supabase SQL)
1. Create a new migration SQL file under `supabase_migrations/` for Phase 3.
2. Extend schema for excuse uploads:
   - Add columns to `excuse_letters` for attachments (e.g., `attachment_path`, `attachment_mime`, `attachment_name`, optional `attachment_bucket`).
3. Add role helper functions (parallel to `public.is_admin()`):
   - `public.is_teacher()`, `public.is_parent()`, `public.is_guard()`, `public.is_clinic()`.
4. Add RLS policies to enforce data boundaries:
   - `classes`: teacher can `SELECT` classes where they are homeroom teacher OR scheduled as a subject teacher.
   - `students`: teacher can `SELECT` students in those classes; parent can `SELECT` students where `parent_id = auth.uid()`.
   - `homeroom_attendance` + `subject_attendance`: teacher can `SELECT/UPDATE` for students they’re allowed to see; parent can `SELECT` for own children.
   - `tap_logs`: guard can `INSERT`; teacher can `SELECT` for their students; parent can `SELECT` for own children.
   - `excuse_letters`: parent can `INSERT` for own children; teacher can `SELECT` for their students; teacher can `UPDATE` status/remarks.
   - `clinic_visits` + `clinic_passes`: clinic role can manage; teacher can view/approve for their students; parent can view for own children.
   - `notifications`: insert by actor roles; `SELECT` only where `recipient_id = auth.uid()`.
   - `announcements`: teacher can create announcements for classes they teach; parent can only `SELECT` announcements relevant to their child’s class (v0.0.1 can start by showing teacher/admin announcements filtered by audience + class metadata).
5. Supabase Storage:
   - Create bucket for excuse attachments.
   - Add storage policies allowing:
     - Parent upload only for their own student’s excuse letters.
     - Teacher read access for students they teach.
     - Admin full access.

## 2) Shared UI/Logic Utilities (Repo Code)
1. Add small shared utilities for:
   - DOM helpers (existing pattern: `el`, `button`, `openModal`, etc.).
   - Date utilities (month calendar rendering for parent).
   - Notification helpers: insert notification rows and subscribe to notifications.
2. Add role-specific page init helpers:
   - `teacher/teacher-common.js` and `parent/parent-common.js` (mirrors `admin/admin-common.js`) for sign-out + role checking + badge.

## 3) Teacher Module Pages
1. Upgrade Teacher layout to a blue sidebar + scrollable content.
2. Implement:
   - `teacher/teacher-dashboard.html + .js`
     - Show homeroom class students (if assigned).
     - Show subject classes from `class_schedules`.
     - Load today’s attendance status and last tap.
     - Real-time: subscribe to `tap_logs`, `homeroom_attendance`, `subject_attendance`, and teacher notifications.
     - Manual override modal:
       - Update attendance status + remarks; optionally insert a tap log record for audit.
       - Send a notification to parent.
   - `teacher/teacher-excuse.html + .js`
     - List pending excuse letters for teacher’s students.
     - View attachment (PDF/image via Storage signed URL or public URL depending on bucket policy).
     - Approve/Reject + remarks -> update row + notify parent.
   - `teacher/teacher-announcements.html + .js`
     - Create announcement with class target.
     - Insert notifications for parents of students in that class.
     - List previous announcements (edit/delete optional for v0.0.1).

## 4) Parent Module Pages
1. Upgrade Parent layout to a green sidebar + scrollable content.
2. Implement:
   - `parent/parent-dashboard.html + .js`
     - List linked children (`students.parent_id = auth.uid()`).
     - Live in/out status per child (from `students.current_status` + latest `tap_logs`).
     - Monthly attendance calendar per child (color coded).
     - Notifications list + unread badge.
     - Real-time: subscribe to `tap_logs` and `notifications`.
   - `parent/parent-excuse-upload.html + .js`
     - Pick child + date + reason.
     - Upload file to Storage (validate type/size).
     - Insert excuse_letters row with attachment path; notify teacher/homeroom teacher.

## 5) Clinic & Gatekeeper (Minimal v0.0.1 Integration)
- Gatekeeper mode (guard): simple “Tap in/out” UI using student QR value lookup -> update `students.current_status` + insert `tap_logs`.
- Clinic workflow minimal:
  - Teacher can issue clinic pass.
  - Clinic dashboard can list pending passes and mark “approved/in_clinic/done”.
  - Notifications: teacher gets clinic updates; after teacher approval, parent gets notified.

## 6) PWA Baseline
1. Add `manifest.json` and icons.
2. Add a service worker caching:
   - Cache app shell (login + teacher + parent pages + core JS).
   - Show offline-friendly placeholders for data.

## 7) Verification
- Use the existing Phase 3 acceptance checklist and validate:
  - Role routing and access boundaries.
  - Teacher attendance + manual override.
  - Parent dashboard + excuse upload.
  - Notifications real-time updates.
  - Basic PWA installability.

## Output (What will be added/updated)
- New SQL migration in `supabase_migrations/` for Phase 3 RLS + excuse upload fields + storage notes.
- New teacher pages: `teacher-excuse.*`, `teacher-announcements.*`.
- New parent page: `parent-excuse-upload.*`.
- Updated teacher/parent dashboards with real data and subscriptions.
- Minimal improvements to guard/clinic dashboards for Phase 3 integration.
- PWA files: `manifest.json`, `service-worker.js` (and wiring from pages).

If you confirm this plan, I will start by implementing the Phase 3 SQL migration + RLS policies first (so the UI work is secure by default), then build the teacher and parent pages end-to-end.