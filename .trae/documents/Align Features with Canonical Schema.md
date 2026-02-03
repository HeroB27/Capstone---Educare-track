# Alignment of Features with Canonical Schema

I will standardize the codebase to strictly follow the Single Source of Truth defined in [from SUPABASE.txt](file:///c%3A/Users/Lenovo%20/Desktop/Educare%20Track%20-%20FINAL/from%20SUPABASE.txt).

## 1. Data Integrity & Ownership
- **Add Ownership Fields**: Update [admin-settings.js](file:///c%3A/Users/Lenovo%20/Desktop/Educare%20Track%20-%20FINAL/admin/admin-settings.js) and [admin-classes.js](file:///c%3A/Users/Lenovo%20/Desktop/Educare%20Track%20-%20FINAL/admin/admin-classes.js) to populate `created_by` and `updated_by` when managing system settings, attendance rules, and subjects.
- **Sync Seeding Logic**: Update [data-initializer.html](file:///c%3A/Users/Lenovo%20/Desktop/Educare%20Track%20-%20FINAL/data-initializer.html) and [index.ts](file:///c%3A/Users/Lenovo%20/Desktop/Educare%20Track%20-%20FINAL/supabase/functions/seed/index.ts) to include these ownership columns during database population.

## 2. Field Naming Standardization
- **Grade vs Grade Level**: Enforce the pattern where `grade` refers to the **Academic Entity** (Classes/Subjects) and `grade_level` refers to the **Person/Rule** (Students/Attendance Rules).
- **Audit UI Logic**: Check [guard-dashboard.js](file:///c%3A/Users/Lenovo%20/Desktop/Educare%20Track%20-%20FINAL/guard/guard-dashboard.js) and [admin-analytics.js](file:///c%3A/Users/Lenovo%20/Desktop/Educare%20Track%20-%20FINAL/admin/admin-analytics.js) for correct table joins based on these field names.

## 3. Role Consistency
- **Role Verification**: Ensure all UI access checks and role-based filtering strictly use `clinic` (the canonical role) instead of `nurse` (which remains as a display label only).

## 4. Verification
- **Run Seeder**: Execute the updated seeder to ensure zero-null integrity.
- **Audit RLS**: Confirm that the newly added ownership columns correctly trigger the RLS policies provided earlier.
