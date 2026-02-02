## Goal

* Switch Guard scanning to write only immutable `attendance_events`.

* Add a Postgres trigger on `attendance_events` to derive/upsert `attendance` (and let existing subject-derivation trigger run), then validate using dummy data before touching Auth/RLS.

## What The Supabase AI Findings Mean (Applied Here)

* **Schema**: `attendance` includes a `date` column and `students` has `current_status` ([Supabase tables.txt](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/Supabase%20tables.txt#L86-L201)). The engine must populate `attendance.date` and should update `students.current_status`.

* **Indexes**: Recommended hot-path indexes already exist in the migration SQL ([Supabase migration.sql](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/Supabase%20migration.sql#L219-L236)), but we should still verify they exist in the actual DB via `pg_indexes`.

* **RLS**: Notifications INSERT policy is permissive (auth later), so for now we avoid relying on RLS for correctness and focus on functional derivation with privileged SQL tests.

## Implementation Plan (No External Execution Until You Confirm)

### 1) Align the attendance engine with the real table shape

* Create/adjust a trigger function `process_attendance_event()` to:

  * Compute `today_date := NEW.timestamp::date` and set `attendance.date = today_date`.

  * For **IN** events: UPDATE existing same-day `attendance` entry row; if none, INSERT.

  * For **OUT** events: update same-day row remarks or insert an `exit` row if none exists.

  * Populate fields the UI expects: `method='qr'`, `entry_type='entry'|'exit'`, `session` derived from time, `class_id` from `students.class_id`, `recorded_by` from `NEW.recorded_by`.

  * Update `students.current_status` to `in`/`out`.

  * Optionally insert `notifications` (kept behind a single block so it can be toggled off if RLS blocks later).

* Ensure we do **not** require a unique constraint for correctness (use `UPDATE ... WHERE student_id=... AND date=... AND entry_type='entry'` then `IF NOT FOUND INSERT`).

### 2) Refactor Guard pages to insert raw events only

* Update Guard scan flows to:

  * Insert into `attendance_events(student_id,event_type,timestamp,device_id,recorded_by)`.

  * Stop writing to `attendance`, stop updating `students.current_status`, stop inserting `notifications` from the Guard client.

  * Keep “immediate feedback” purely UI-level (status estimate), while “real status” is derived server-side.

### 3) Dummy-data QA (before Auth)

* Add a DB-only test script that:

  * Inserts a minimal dummy student (`students`) and dummy attendance rules (`attendance_rules`).

  * Inserts `attendance_events` rows for:

    * IN on-time

    * IN late

    * OUT after IN

    * OUT without prior IN

    * Duplicate IN same day

  * Verifies outputs in:

    * `attendance` row contents (date/status/session/method/entry\_type)

    * `students.current_status`

    * `subject_attendance` rows (because the existing `derive_subject_attendance` trigger runs after `attendance` inserts)

### 4) Verification checklist (you run in Supabase)

* Run engine SQL, then test SQL, then confirm:

  * `attendance_events` contains the raw immutable records.

  * `attendance` is created/updated by trigger.

  * No Guard client writes hit derived tables.

## Deliverables After Confirmation

* One engine SQL file (trigger + function) aligned to the schema.

* Guard JS changes to write only into `attendance_events`.

* One dummy-data test SQL script with expected result queries.

## Notes / Known Follow-ups (Not in this change)

* Notifications INSERT policy is still too permissive (fix later when Auth/RLS work is scheduled).

* `clinic_passes.status` enum cleanup is separate from attendance

