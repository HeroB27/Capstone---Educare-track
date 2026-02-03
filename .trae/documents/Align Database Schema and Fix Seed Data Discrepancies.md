## Investigation Results

I have compared [Supabase tables.txt](file:///c%3A/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/Supabase%20tables.txt) with [FINAL_DATABASE_SCHEMA.sql](file:///c%3A/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/FINAL_DATABASE_SCHEMA.sql) and identified several key discrepancies that are likely causing the seed data failures:

1.  **Subjects Table Column Mismatch**: The live context ([Supabase tables.txt](file:///c%3A/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/Supabase%20tables.txt)) uses `grade_level`, while the canonical schema ([FINAL_DATABASE_SCHEMA.sql](file:///c%3A/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/FINAL_DATABASE_SCHEMA.sql)) and the seed scripts use `grade`.
2.  **Profiles Table**: The live context has an extra `custom_id` column not present in the final schema. The Edge Function seed currently tries to use this field.
3.  **Attendance Rules**: The Edge Function seed is missing the `dismissal_time` column when upserting rules, which exists in both the schema and the SQL seed.
4.  **Unique Constraints**: [FINAL_DATABASE_SCHEMA.sql](file:///c%3A/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/FINAL_DATABASE_SCHEMA.sql) includes a critical unique constraint on `attendance_validations` that is missing in the live context description.

## Proposed Plan

### 1. Align Core Schema Documentation
- Update [Supabase tables.txt](file:///c%3A/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/Supabase%20tables.txt) to perfectly match [FINAL_DATABASE_SCHEMA.sql](file:///c%3A/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/FINAL_DATABASE_SCHEMA.sql). This ensures future development is based on the correct schema.

### 2. Fix SQL Seed Script
- Update [SEED_DATA.sql](file:///c%3A/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/SEED_DATA.sql) to ensure it uses the correct column names (e.g., ensuring `subjects` uses `grade`).
- Verify that all `INSERT` and `UPSERT` operations match the constraints in the canonical schema.

### 3. Fix Edge Function Seed
- Update [index.ts](file:///c%3A/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/supabase/functions/seed/index.ts):
    - Remove references to `custom_id` in `profiles`.
    - Add `dismissal_time` to the `attendance_rules` seed data.
    - Ensure `subjects` upsert uses the `grade` column.
    - Sync the `grades` array and logic to match the "Kinder-Grade 10" scope defined in the project rules.

### 4. Verification
- I will review the updated files to ensure complete alignment across the documentation, the SQL schema, and both seeding methods.

Does this plan look correct to you? Once approved, I will proceed with these updates.