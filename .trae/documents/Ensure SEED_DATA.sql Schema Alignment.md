## Alignment Summary (based on FINAL_DATABASE_SCHEMA.md)
- Canonical fields:
  - `classes.grade` ✅ used
  - `subjects.grade` ✅ used
  - `students.grade_level` ✅ used
- Seed targets match the “Core Tables” list in the schema doc:
  - Academic: `classes`, `students`, `parent_students`, `subjects`, `class_schedules`
  - Attendance: `attendance_events` (IN/OUT), `attendance`, `subject_attendance`, `attendance_rules`
  - Clinic/Excuse: `clinic_visits`, `clinic_passes`, `excuse_letters`
  - Comms/Admin: `announcements`, `notifications` (via attendance trigger), `school_calendar`, `system_settings`, `audit_logs`
- “No sections” requirement is satisfied by setting `classes.id = grade` and keeping `strand` NULL.

## One Required Fix to Keep It 100% Schema-Safe
- Remove unsafe casts on Kinder grades:
  - Current seeder has conditions like `grade = 'Kinder' OR grade::int < 7`.
  - This can throw a Postgres error because `grade::int` cannot cast 'Kinder'.

## Plan
1) Patch `SEED_DATA.sql` to compute a safe `grade_num` per loop (NULL for Kinder) and replace all `grade::int` comparisons with `grade_num` comparisons.
2) Re-check the file for any non-canonical column names from older drafts (e.g., `subjects.grade_level`, `profiles.custom_id`, `notifications.read_by`) and remove if found.
3) Add a short “end-of-script” summary (RAISE NOTICE counts) so that running the SQL in Supabase confirms:
   - 11 classes (Kinder–10)
   - 55 students (5 per class)
   - schedules inserted
   - attendance_events inserted and attendance derived
   - announcements/clinic/excuse rows inserted

Once you approve, I’ll apply this patch so the seeder is fully aligned with the FINAL_DATABASE_SCHEMA.md rules and runs without Kinder casting errors.