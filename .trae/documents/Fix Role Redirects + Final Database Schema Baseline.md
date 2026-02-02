## Why Guard/Clinic/Parent Redirect Back to Login
- Your login page only routes **admin** and **teacher** correctly.
- In [index.html](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/index.html#L104-L107), this line:
  - `const dest = { admin: ..., teacher: ... }[profile.role] || 'admin/admin-dashboard.html';`
  - means **guard/clinic/parent** all default to **admin dashboard**.
- Admin dashboard then runs `utils.checkAccess(['admin'])` (role-gated), so non-admin users get redirected back to [utils.checkAccess](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/utils.js#L123-L152) → `/index.html`.

## Admin Features vs Schema (Alignment Check)
- Most admin features match [MASTER_RESET.sql](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/MASTER_RESET.sql) tables/columns (profiles, students, attendance, announcements, calendar, etc.).
- **Key mismatches that will break Admin “Classes” + Seeder:**
  - `classes.grade_level` is used in [admin-classes.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/admin/admin-classes.js#L603-L615), but SQL defines `classes.grade` (no `grade_level`).
  - Class creation inserts into `classes` without an `id` ([admin-classes.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/admin/admin-classes.js#L603-L615)), but SQL defines `classes.id` as required PK.
  - Seed edge function uses `subjects.grade` and `classes.grade` ([seed/index.ts](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/supabase/functions/seed/index.ts#L166-L195)), but MASTER_RESET defines `subjects.grade_level`.

## Create “FINAL DATABASE SCHEMA” (Single Source of Truth)
I’ll consolidate and produce a single canonical schema file based on:
- Your actual app queries (admin/teacher/guard/clinic/parent JS)
- Your existing schema artifacts ([Supabase tables.txt](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/Supabase%20tables.txt), [MASTER_RESET.sql](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/MASTER_RESET.sql))
- Your attendance trigger migration ([create_attendance_engine.sql](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/create_attendance_engine.sql))

Canonical decisions (to remove current inconsistencies):
- Standardize **classes.grade** (not `grade_level`) and **subjects.grade** (not `grade_level`) to match seeder + existing schema doc.
- Keep **students.grade_level** (already used broadly).
- Remove `profiles.password` from schema (Supabase Auth owns passwords).
- Add safe defaults/constraints + indexes used by dashboards.

## Implementation Steps
1. **Fix login routing** in [index.html](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/index.html):
   - Route roles to their correct dashboards:
     - admin → `admin/admin-dashboard.html`
     - teacher → `teacher/teacher-dashboard.html`
     - guard → `guard/guard-dashboard.html`
     - clinic → `clinic/clinic-dashboard.html`
     - parent → `parent/parent-dashboard.html`
   - (Optional but recommended) add “already logged in” auto-redirect using `supabaseClient.auth.getSession()` + profile lookup.

2. **Align Admin “Classes” code to schema**:
   - Replace `classes.grade_level` usage with `classes.grade`.
   - Fix create-class insert to also provide a deterministic `classes.id` (e.g., `G{grade}-{strand || 'GEN'}-{section}`), or adopt a DB default.

3. **Align Seed Edge Function to schema**:
   - Ensure it writes `subjects.grade` consistently and avoids referencing non-existent columns.

4. **Create final schema files**:
   - Add `FINAL_DATABASE_SCHEMA.sql` (tables, constraints, indexes, triggers).
   - Add `FINAL_DATABASE_SCHEMA.md` (human-readable summary, table purposes, key relations).

5. **Verification**
   - Smoke test login redirection for guard/clinic/parent.
   - Load admin classes page: create class, list classes, assign adviser/schedules.
   - Run TypeScript diagnostics for `supabase/functions/seed/index.ts` and basic page console checks.

If you confirm, I’ll implement all the above changes and generate the final schema files.