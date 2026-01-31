## Alignment Status
- Profiles, Teachers, Parents, Guards, Clinic Staff: Fully aligned to current features and schema.
- Classes: Uses grade, strand, adviser_id, room, level, is_active; matches app logic.
- Students: Uses text id, class_id FK, full_name, grade_level (text), strand; matches app flows.
- Attendance: Single history table with status, entry_type, session, method, timestamp, recorded_by, remarks; app uses INSERT-only for overrides.
- Audit Logs: Uses action, target_table, target_id, details; app writes audits at key actions.

## Required Minimal Upgrades
- Attendance Validations (REQUIRED):
  - Add CHECK (session IN ('AM','PM')).
  - Add UNIQUE (class_id, subject, session, attendance_date).
- Subjects (OPTIONAL but supported):
  - Add grade text NOT NULL; keep existing description/created_at for backward compatibility.

## Enforcement & Behavior
- Subject Attendance: Implement purely via attendance + attendance_validations; do not rely on subject_attendance table.
- Admin Override: Always INSERT new attendance rows and log to audit_logs.
- Gatekeeper Mode: Writes to attendance (entry/exit) and updates students.current_status; never touches validations.
- Immutability: Enforce at application level (no UPDATE/DELETE of attendance). Optional DB triggers can be proposed later if needed.

## Migration Snippet (Existing DB)
- Add session check and unique lock:
  - ALTER TABLE public.attendance_validations ADD CONSTRAINT chk_session CHECK (session IN ('AM','PM'));
  - ALTER TABLE public.attendance_validations ADD CONSTRAINT attendance_validations_unique UNIQUE (class_id, subject, session, attendance_date);
- Add subjects.grade:
  - ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS grade text;
  - UPDATE public.subjects SET grade = '1' WHERE grade IS NULL; -- placeholder to satisfy NOT NULL if required
  - ALTER TABLE public.subjects ALTER COLUMN grade SET NOT NULL;

## Verification Plan
- Seed data: Run seeding to create classes with adviser_id and students with class_id; validations and attendance rows should respect the unique/session constraints.
- Admin Classes: Create/edit classes; assign adviser; transfer students (students.class_id updates correctly).
- Admin Users: Parent/student registration; QR reissue; audit logs written.
- Teacher Attendance: Mark attendance, then validate; confirm post-validation UI locks and subsequent scans are excluded from roll call.
- Gatekeeper: Perform entry/exit; confirm students.current_status updates and no conflict with validations.

## Deliverables
- Update Supabase tables.txt with:
  - attendance_validations CHECK/UNIQUE constraints.
  - subjects.grade column (NOT NULL).
- Provide a migration SQL block to apply on existing deployments.

Confirm to proceed; I will apply the minimal upgrades and deliver the schema update plus migration SQL in the repo.