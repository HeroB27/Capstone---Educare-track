✅ VERIFIED
- Admin Classes UI supports SHS strand + semester scheduling and uses canonical `subjects` (see [admin-classes.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/admin/admin-classes.js) and [admin-classes.html](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/admin/admin-classes.html)).
- School calendar CRUD exists and persists to `school_calendar` (see [admin-calendar.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/admin/admin-calendar.js)).
- System settings upsert pattern exists via `system_settings` (see [admin-settings.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/admin/admin-settings.js)).
- Subject-attendance derivation trigger exists for QR entry (see [Supabase migration.sql](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/Supabase%20migration.sql#L96-L155)).

⚠️ MISALIGNMENTS
- Auth model vs RLS model conflict:
  - App uses plaintext profile lookup + localStorage role gating (see [auth.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/auth.js), [utils.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/utils.js#L38-L98)).
  - SQL policies assume Supabase Auth (`auth.uid()`) (see [Supabase migration.sql](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/Supabase%20migration.sql#L42-L46)).
- Immutable events spec vs implementation:
  - `attendance_events` is defined but unused; scanners + roll call write to `attendance` directly (see [Supabase tables.txt](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/Supabase%20tables.txt#L147-L170) vs [guard-scanner.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/guard/guard-scanner.js#L48-L89), [teacher-gatekeeper.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/teacher/teacher-gatekeeper.js#L72-L106), [teacher-attendance.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/teacher/teacher-attendance.js#L208-L285)).
- `attendance.entry_type` semantics are inconsistent:
  - Schema describes entry_type as `manual/QR/auto` (see [Supabase tables.txt](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/Supabase%20tables.txt#L171-L187)).
  - Code uses `entry/exit` and also `clinic` (see [guard-scanner.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/guard/guard-scanner.js#L59-L71), [teacher-gatekeeper.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/teacher/teacher-gatekeeper.js#L89-L105), [teacher-clinic.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/teacher/teacher-clinic.js#L38-L46)).
- `attendance.status` is overloaded:
  - Schema implies attendance outcomes only (present/absent/late/excused/clinic) (see [Supabase tables.txt](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/Supabase%20tables.txt#L171-L176)).
  - Clinic workflow uses status as a state machine (pending/approved/rejected/in_clinic/returned/sent_home) (see [clinic-approval.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/clinic/clinic-approval.js#L104-L113), [clinic-checkout.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/clinic/clinic-checkout.js#L15-L25)).
- Schema ↔ code mismatches (columns):
  - `notifications` code expects array-based targeting (`target_users`, `read_by`), but schema is recipient-based (see [admin-dashboard.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/admin/admin-dashboard.js#L179-L220) vs [Supabase tables.txt](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/Supabase%20tables.txt#L266-L277)).
  - `announcements` code uses `message/created_by/priority`, schema uses `content/posted_by/is_pinned` (see [admin-announcements.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/admin/admin-announcements.js#L35-L118) vs [Supabase tables.txt](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/Supabase%20tables.txt#L254-L264)).
  - `excuse_letters` code references `created_at`, `teacher_comment`, `reviewed_by`, `reviewed_at` but schema uses `issued_at` and `remarks` only (see [teacher-excuse.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/teacher/teacher-excuse.js#L20-L105) vs [Supabase tables.txt](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/Supabase%20tables.txt#L200-L212)).
- RLS policy coverage is incomplete:
  - Many tables have RLS enabled but no policies in repo (see list in [Supabase migration.sql](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/Supabase%20migration.sql#L18-L41)).
  - Notifications INSERT policy is over-permissive (`WITH CHECK (true)` without a `TO authenticated`) (see [Supabase migration.sql](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/Supabase%20migration.sql#L68-L71)).
- Analytics currently does full-table reads then aggregates client-side (scales poorly) (see [admin-analytics.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/admin/admin-analytics.js#L45-L129)).

❌ CRITICAL FAILURES
- Security: role checks are client-side and forgeable; DB-side role checks depend on Supabase Auth which is not used by the app (see [utils.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/utils.js#L38-L98), [Supabase migration.sql](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/Supabase%20migration.sql#L42-L46)).
- Clinic checkout crash: `pass` is referenced before definition, blocking checkout and clinic_pass inserts (see [clinic-checkout.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/clinic/clinic-checkout.js#L110-L121)).
- Clinic pipeline state mismatch: check-in updates attendance to `clinic` but findings/checkout expect `in_clinic`, so discharge pipeline can silently break (see [clinic-checkin.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/clinic/clinic-checkin.js#L95-L113) vs [clinic-checkout.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/clinic/clinic-checkout.js#L15-L25)).
- Notifications + announcements will fail at runtime against the current schema due to column name mismatches (see references in MISALIGNMENTS).
- Guard scanning inconsistency: one scanner writes `attendance` rows without `recorded_by/class_id/session` and uses different status semantics, causing data corruption risk (see [guard-scanner.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/guard/guard-scanner.js#L48-L99) vs [teacher-gatekeeper.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/teacher/teacher-gatekeeper.js#L72-L106)).

🔧 RECOMMENDED FIXES (Concrete, minimal)
- Security/RLS alignment (must choose one):
  - Option A (recommended, matches spec): migrate login to Supabase Auth so `auth.uid()` works; keep role in `profiles` and enforce RLS. Update pages to rely on `supabase.auth.getUser()` (replace localStorage role trust).
  - Option B (stopgap only): disable RLS and treat as trusted kiosk app (not recommended for production).
- Normalize `attendance` semantics without redesign:
  - Pick one meaning for `entry_type` (e.g., `entry|exit|clinic_pass`) and one meaning for `method` (`qr|manual|auto`), then update clinic code to not overload `attendance.status` with workflow states.
  - If keeping `attendance_events`, update scanners to insert into it and derive attendance via a view/RPC; otherwise remove `attendance_events` from schema docs to avoid drift.
- Fix clinic pipeline:
  - Make check-in write the exact state that findings/checkout query (either change check-in to `in_clinic` or change all queries to `clinic`).
  - Fix the `pass` reference error in checkout.
- Fix schema ↔ code mismatches:
  - Align `announcements` columns: use `content` + `posted_by` (or update schema to match code, but choose one and standardize everywhere).
  - Align `notifications` to either recipient-based schema or array-based code expectations.
  - Align `excuse_letters` review fields: use `remarks` + `issued_at` (or add reviewed fields and update schema consistently).
- Add DB-side guardrails:
  - Add indexes: `attendance(student_id,timestamp)`, `attendance(timestamp)`, `clinic_visits(student_id)`, `parent_students(student_id)`, `subject_attendance(student_id,date)`.
  - Add constraints once semantics are fixed (e.g., restrict `event_type`, `session`, enforce required fields per writer).

🧪 TEST CASES TO ADD
- Auth/RLS
  - Non-admin user opens admin pages via localStorage role spoof → DB must still deny mutations.
  - Guard inserts attendance_event/attendance only for allowed rows; cannot update `profiles/subjects/classes`.
- Attendance scanning
  - Duplicate IN scans (same minute, same day) → only one “entry” event stored; second logged as duplicate.
  - OUT without prior IN → handled deterministically (ignored or creates a flagged record).
  - IN after cutoff (late_until) → status derived as absent/late per rule.
  - Scan on holiday/suspension → attendance derivation skipped.
- Clinic
  - Approved pass → check-in creates `clinic_visits`, updates derived status, and appears in checkout list.
  - Returned vs sent-home path updates correct derived outputs and notifications.
- Excuse letters
  - Parent can only submit for linked child.
  - Teacher approval updates derived attendance and is idempotent.
- Analytics
  - Counts include `excused` and `clinic` correctly; no runtime errors due to schema mismatch.

Next step after approval: I will implement the minimal code + SQL patches in the repo (and provide SQL you can paste into Supabase) to eliminate the CRITICAL FAILURES first, then tighten RLS and standardize table/column semantics.