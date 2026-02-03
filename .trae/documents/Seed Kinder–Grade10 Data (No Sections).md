## Goals
- Seed domain data while assuming Auth users + profiles already exist.
- Create classes for Kinder–Grade 10 only (no strands/sections).
- Seed 5 students per class, assign class advisers, create subjects + schedules per class.
- Seed attendance IN/OUT events from Nov to today, plus absences.
- Seed announcements, clinic passes/visits, excuse letters, and remaining core tables used by the app.

## Key Constraints (from Class Management + Schema)
- Use `subjects.grade` (not `grade_level`) and store schedule references via `class_schedules.subject_code`.
- Use `classes.id` (text PK) consistently; for “no sections”, set `classes.id = classes.grade` and keep `strand` NULL.
- Attendance IN/OUT should be inserted into `attendance_events` with `event_type` = 'IN'/'OUT' so the trigger can update `attendance`, `students.current_status`, and `notifications`.

## Approach
### 1) Rewrite `SEED_DATA.sql` as a data-only seeder
- Remove any inserts into `auth.users` and `profiles` (the current file is incompatible with the final schema and FK constraints).
- At the start of the script, SELECT existing IDs:
  - `admin_id` from `profiles` where role='admin'
  - `guard_id` from `guards` (fallback: profiles role='guard')
  - `clinic_id` from `clinic_staff`
  - `teacher_ids[]` from `teachers`
  - `parent_ids[]` from `parents`
- Add a `do_wipe` boolean at the top.
  - If true, DELETE from non-auth tables in dependency order: `attendance_validations`, `subject_attendance`, `attendance_events`, `attendance`, `clinic_passes`, `clinic_visits`, `excuse_letters`, `parent_students`, `qr_codes`, `class_schedules`, `announcements`, `notifications`, `audit_logs`, `system_settings`, `school_calendar`, `students`, `classes`, `subjects`.

### 2) Seed Classes (Kinder–10, no sections)
- Create 11 classes with:
  - `id = grade` (e.g., 'Kinder', '1', … '10')
  - `grade = grade`, `strand = NULL`, `room = NULL`
  - `level` derived (Kinder/Elementary/High School)
  - `adviser_id` assigned round-robin from `teacher_ids` (ensure at least 11 teachers available).

### 3) Seed Subjects (per grade)
- Insert a complete K–10 subject set per grade using codes like `${SUBJECT}-${GRADE}`.
- Set `subjects.grade = grade`, `strand = NULL`, `semester = NULL`, `type='core'`.

### 4) Seed Class Schedules
- For each class:
  - Generate Monday–Friday schedules with fixed time blocks (ensuring `end_time > start_time`).
  - Assign `subject_code` from that class’s grade subjects.
  - Assign `teacher_id` round-robin from `teacher_ids` (optionally bias adviser for “homeroom”).

### 5) Seed Students + Parent Links + QR Codes
- Insert 5 students per class (55 total):
  - Unique `lrn`, `id` as deterministic text pattern (EDU-<year>-<last4>-<rand>). 
  - `grade_level = class.grade`, `class_id = class.id`, `current_status='out'`.
- Link each student to an existing parent using `parent_students` (reuse parents if fewer than 55).
- Create `qr_codes` row per student (`qr_hash = student.id`, `is_active = true`, `created_by = admin_id`).

### 6) Seed Attendance (Nov → today)
- Ensure `attendance_rules` rows exist for Kinder–10 (upsert).
- For each weekday from 2025-11-01 to current_date and each student:
  - Randomly choose: present/late/absent.
  - If present/late:
    - Insert `attendance_events` IN at a realistic time.
    - Insert `attendance_events` OUT near that grade’s dismissal time.
  - If absent:
    - Insert `attendance` row with status='absent' and supporting fields (`class_id`, `session`, `method`, `entry_type`, `remarks`, `recorded_by`).

### 7) Seed Announcements, Clinic, Excuses, “and the like”
- Announcements: several rows, mixed audiences, some pinned.
- Clinic:
  - Create a handful of `clinic_passes` (pending/approved/used), and matching `clinic_visits` for “used”.
  - Use `issued_by` = a teacher profile ID, `treated_by` = a clinic_staff ID.
- Excuse letters:
  - Create some rows tied to existing `parent_students`, referencing realistic absent dates.
- System tables:
  - Insert `system_settings.school_info`.
  - Insert minimal `school_calendar` (a holiday or suspension).
  - Insert a few `audit_logs` entries for realism.

## Validation
- After running the SQL in Supabase SQL editor, run quick checks:
  - Count: 11 classes, 55 students, schedules per class, subjects per grade.
  - Attendance: rows exist in `attendance_events` and derived rows in `attendance`.
  - Parent dashboards show linked students; guard scans use `qr_codes`.
  - Admin Class Management shows subjects filtered by `subjects.grade` and schedules render.

## Deliverables
- Updated `SEED_DATA.sql` compatible with `FINAL_DATABASE_SCHEMA.sql` and your new constraints (Kinder–Grade10 only, no sections).
- (Optional) Minor alignment patch to `data-initializer.html` only if you still use it; otherwise you can run the SQL script directly.

If you confirm, I’ll implement the rewritten `SEED_DATA.sql` and then provide the exact Supabase SQL steps + verification queries.