## Goals
- Enhance (not rewrite) the existing attendance system so it is reliable, realistic, and demo-ready.
- Keep logic simple, explainable, and enforced both in UI and in Supabase (RLS/constraints) where needed.

## Current Baseline (What Already Exists)
- Tap-in/out already writes `tap_logs`, updates `students.current_status`, and upserts `homeroom_attendance`: [scan-actions.js](file:///c:/Users/Lenovo/Desktop/OFFICIAL%20EDUCARE%20TRACK/core/scan-actions.js)
- Subject attendance RLS already restricts writes to assigned teachers via `teacher_can_access_subject(student_id, subject_code)`: [phase3 sql](file:///c:/Users/Lenovo/Desktop/OFFICIAL%20EDUCARE%20TRACK/supabase_migrations/2026-02-04_phase3_teachers_parents_v0.0.1.sql#L130-L219)
- Unique indexes already exist for one homeroom record/day and one subject record/subject/day: [phase3 sql](file:///c:/Users/Lenovo/Desktop/OFFICIAL%20EDUCARE%20TRACK/supabase_migrations/2026-02-04_phase3_teachers_parents_v0.0.1.sql#L157-L161)
- Calendar events exist (`school_calendar`) and are seeded with holiday/break/emergency: [enterprise seed](file:///c:/Users/Lenovo/Desktop/OFFICIAL%20EDUCARE%20TRACK/supabase_migrations/2026-02-04_enterprise_seed_v1.0.0.sql#L421-L451)

## 1) Gatekeeping (Light but Correct)
- Update tap logic in [recordTap](file:///c:/Users/Lenovo/Desktop/OFFICIAL%20EDUCARE%20TRACK/core/scan-actions.js) to prevent obvious invalid sequences:
  - Block OUT if there is no prior IN for that student on that date.
  - Block IN if the latest tap for that student on that date is already IN (no double IN).
- Keep this simple by querying “latest tap today” from `tap_logs` for the student and comparing `tap_type`.
- Still write an entry to `tap_logs` for invalid attempts with `status = 'rejected'` and `remarks` explaining why (so demos look realistic and auditable).
- Ensure the “first IN” sets homeroom status for the day; “last OUT” updates `tap_out_time` on the same homeroom row.
- Optional (still simple): read `system_settings.gate_rules.duplicate_window_ms` for dedupe instead of a hard-coded 15 seconds.

## 2) Late & Absence (Simple Rules via system_settings)
- Add/read these settings in `system_settings`:
  - `school_start_time` (e.g., "07:30")
  - `late_threshold_minutes` (e.g., 15)
- Replace the current grade-based timing used in tap-in status with a simple rule:
  - If IN time > start + threshold → Late
  - Else Present
- Absent rule:
  - If no IN for the day → Absent
  - Implement as a “finalize/backfill” step that inserts missing `homeroom_attendance` rows as `absent` for all class students when a teacher/admin opens that day (no background job needed).
- Ensure RLS allows guards/teachers to read only the needed `system_settings` keys (currently only `teacher_gatekeepers` is readable to non-admin).

## 3) Subject Attendance (Teacher-Driven)
- Add a dedicated “Subject Attendance” teacher page (new HTML/JS) that:
  - Lets teacher choose date and a subject from their assigned schedules.
  - Loads students for the schedule’s class.
  - Defaults each student to Present.
  - Allows changing to Late/Absent/Excused.
- Validation (UI + DB):
  - Teacher must be assigned (already enforced by RLS).
  - Student must belong to that class (already implied by `teacher_can_access_subject`).
  - Add clear UI errors when Supabase rejects due to RLS.

## 4) Clinic Integration (Basic)
- For a given date/session, if student has an active clinic state:
  - Display status “In Clinic” (purple).
  - Disable teacher’s ability to mark subject attendance for that student.
- Enforce at DB level by tightening `subject_attendance_teacher_all` policy with a `WITH CHECK` that rejects writes when there exists an `in_clinic` visit for the student.

## 5) Excuse Letters (Override)
- Behavior:
  - If an excuse letter exists for the date (approved), effective status shows as “Excused”.
  - Still display the underlying attendance record’s original status (“Original: Present/Late/Absent”).
  - Teacher cannot override the status.
- Implementation:
  - UI layer: when loading attendance, join/lookup approved excuses for that student/date and render an “override pill + tooltip”.
  - DB layer: tighten `homeroom_attendance_teacher_all` and `subject_attendance_teacher_all` policies so that when an approved excuse exists for that student/date, teachers can only write status `excused_absent` (or no write at all).

## 6) Suspensions / Holidays / Sem Break
- Use `school_calendar` types `holiday`, `break`, `emergency`.
- Add a shared helper to check whether a date is a “no classes” day.
- Update attendance UIs to:
  - Disable marking and saving.
  - Show a clear banner “No classes today” with the event title.
- Apply to:
  - Teacher subject attendance page
  - Admin homeroom attendance page
  - Guard/teacher tap screens (optionally block taps and log `tap_logs.status='blocked'` with reason)

## 7) UX Improvements
- Add consistent status styling + tooltips:
  - Present (green), Late (orange), Absent (red), Excused (blue), In Clinic (purple)
- Add:
  - Loading states while fetching
  - Empty states (“No students found”, “No schedules today”, “No records yet”)
  - Inline error boxes (avoid alert popups)
- Implement via shared CSS utilities in [theme.css](file:///c:/Users/Lenovo/Desktop/OFFICIAL%20EDUCARE%20TRACK/core/theme.css) and shared UI helpers in [ui.js](file:///c:/Users/Lenovo/Desktop/OFFICIAL%20EDUCARE%20TRACK/core/ui.js).

## 8) Data Consistency (Fix Inconsistencies)
- Add a Phase 7 SQL migration to:
  - Ensure needed indexes for fast lookups (tap_logs latest per student/day; excuse_letters by student/date; clinic_visits active by student).
  - Add a safe “backfill” RPC/function for homeroom attendance on a given date/class.
  - Optional cleanup statements (non-destructive): set `homeroom_attendance.class_id` from `students.class_id` where missing.
- Add a lightweight admin-only “Fix attendance consistency” button (optional) that calls the backfill function for a selected class/date.

## 9) Acceptance Criteria Verification
- Scripted QA scenarios (manual steps, plus light automated checks where feasible):
  - Guard: IN then OUT works; OUT before IN is rejected; double IN rejected.
  - Teacher: can mark subject attendance only for assigned schedules; cannot mark random students.
  - Clinic: while student is in clinic, teacher cannot mark subject attendance.
  - Excuse: approved excuse overrides status; teacher cannot override.
  - Calendar: holiday/break/emergency disables marking and shows banner.
  - Parent: monthly view shows consistent statuses and realistic data.

## 10) Deliverables
- Code changes (target files):
  - Tap logic: [scan-actions.js](file:///c:/Users/Lenovo/Desktop/OFFICIAL%20EDUCARE%20TRACK/core/scan-actions.js)
  - Teacher attendance UI: new `teacher/teacher-subject-attendance.html` + `teacher/teacher-subject-attendance.js` (and a nav entry)
  - Admin homeroom UI enhancements: [admin-attendance.js](file:///c:/Users/Lenovo/Desktop/OFFICIAL%20EDUCARE%20TRACK/admin/admin-attendance.js)
  - Shared UI: [theme.css](file:///c:/Users/Lenovo/Desktop/OFFICIAL%20EDUCARE%20TRACK/core/theme.css), [ui.js](file:///c:/Users/Lenovo/Desktop/OFFICIAL%20EDUCARE%20TRACK/core/ui.js)
- Supabase migration: new `supabase_migrations/2026-02-04_phase7_attendance_enhancement.sql`
- Documentation: a short “How attendance works in this system” markdown doc.

If you confirm, I’ll implement Phase 7 by reusing the existing tap + attendance tables and layering these validations + UI improvements on top (no rewrite).