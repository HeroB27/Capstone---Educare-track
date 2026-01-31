## Alignment Summary
- Profiles: Uses full_name, username, password, photo_url, is_active. All UI and logic aligned. [admin-users.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/admin-users.js#L397-L416)
- Teachers: employee_no, is_homeroom, is_gatekeeper, assigned_subjects aligned. [data-initializer.html](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/data-initializer.html#L212-L216)
- Parents: address stored and edited. Aligned. [admin-users.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/admin-users.js#L730-L733)
- Guards: shift, assigned_gate aligned. [admin-users.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/admin-users.js#L669-L673)
- Clinic Staff: license_no, position aligned. [admin-users.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/admin-users.js#L674-L678)
- Students: id is text (custom), full_name, grade_level (text), strand, address, photo_url, current_status aligned. Student creation and editing use these fields. [admin-users.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/admin-users.js#L478-L487)
- Parent-Students: relationship captured; student_id text aligned. [admin-users.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/admin-users.js#L495-L500)
- Attendance: timestamp, class_id, session, method, remarks aligned. [admin-users.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/admin-users.js#L812-L821)
- Attendance Validations: validated_by, teacher_id, session/date aligned. [data-initializer.html](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/data-initializer.html#L276-L280)
- QR Codes: student_id, qr_hash, is_active aligned including reissue flow. [admin-ids.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/admin-ids.js#L50-L59)
- Audit Logs: action, target_table, target_id, details aligned. [admin-users.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/admin-users.js#L720-L725)

## Detected Mismatches
- Classes table in schema does not match feature usage:
  - Code expects grade (text), strand (text), room (text), adviser_id (uuid FK → teachers.id), level (text), optional is_active.
  - Current schema still has grade_level (integer), section (text), homeroom_teacher_id.
  - References: create/update/select use grade/strand/room/adviser_id. [admin-classes.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/admin-classes.js#L300-L312) [data-initializer.html](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/data-initializer.html#L229-L232)
- Students table missing class_id (text) used widely:
  - Transfers and seeding set students.class_id. [admin-classes.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/admin-classes.js#L261-L266) [data-initializer.html](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/data-initializer.html#L256)

## Proposed Schema Updates
- Update classes:
  1. Replace grade_level integer → grade text
  2. Drop section
  3. Rename homeroom_teacher_id → adviser_id uuid REFERENCES public.teachers(id)
  4. Add strand text, room text, level text, is_active boolean DEFAULT true
- Update students:
  1. Add class_id text REFERENCES public.classes(id)

## Migration Plan (Existing DB)
- Classes:
  - ALTER TABLE public.classes RENAME COLUMN grade_level TO grade; ALTER COLUMN grade TYPE text USING grade::text;
  - ALTER TABLE public.classes DROP COLUMN section;
  - ALTER TABLE public.classes RENAME COLUMN homeroom_teacher_id TO adviser_id;
  - ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS strand text, ADD COLUMN IF NOT EXISTS room text, ADD COLUMN IF NOT EXISTS level text, ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
- Students:
  - ALTER TABLE public.students ADD COLUMN IF NOT EXISTS class_id text;
  - ALTER TABLE public.students ADD CONSTRAINT fk_students_class FOREIGN KEY (class_id) REFERENCES public.classes(id);

## Verification Steps
- Re-run data-initializer to confirm class and student seeding succeeds (grade/strand/adviser_id/room set correctly).
- In Admin Classes:
  - Create class, edit class, assign adviser, transfer student — ensure updates and joins work.
- In Admin Users:
  - Parent/student registration → students.class_id and QR generation verified.
- Attendance:
  - Validation and override flows operate with class_id and timestamp.

## Deliverables
- Update Supabase tables.txt with corrected classes and students definitions
- Optional SQL migration snippet for existing environments
- Quick smoke test: load Admin Classes, Admin Users, Teacher Attendance to confirm end-to-end alignment

Please confirm, and I will apply the schema updates and provide the migration SQL ready to run in Supabase.