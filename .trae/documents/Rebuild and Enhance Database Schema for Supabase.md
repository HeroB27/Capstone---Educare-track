## System Review & Schema Enhancements

I have reviewed the system's core modules (Admin, Teacher, Guard, Clinic, and Parent) and identified several areas where the schema can be strengthened to better support existing features and future growth:

1.  **Notification Categorization**: Added a `category` column to the `notifications` table. This allows the UI to group or filter notifications by type (e.g., 'attendance', 'clinic', 'system', 'announcement').
2.  **Attendance Rule Granularity**: Added a `late_arrival_threshold` column to `attendance_rules` to allow for fine-tuned definitions of "late" versus "very late" directly in the database logic.
3.  **Real-time Enablement**: Included explicit SQL commands to enable Supabase Realtime for the `notifications`, `clinic_visits`, and `attendance` tables. This is critical for the "live" updates expected in the dashboard and scanner.
4.  **Data Integrity & Performance**:
    -   Standardized `ON DELETE CASCADE` across all relational tables to prevent orphaned records.
    -   Added comprehensive indexes on foreign keys and frequently queried columns (`lrn`, `full_name`, `email`, `timestamp`) to ensure the system remains fast as data grows.
    -   Ensured all tables include `created_at` and `updated_at` with appropriate defaults.

## Proposed Plan

### 1. Generate Consolidated SQL Script
I will generate a single, execution-ready SQL script that creates all tables, functions, triggers, and RLS policies in the correct order. This script will be designed to run without errors in the Supabase SQL Editor.

### 2. Update System Documentation
-   I will update [Supabase tables.txt](file:///c%3A/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/Supabase%20tables.txt) with this complete, improved script.
-   I will sync [FINAL_DATABASE_SCHEMA.sql](file:///c%3A/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/FINAL_DATABASE_SCHEMA.sql) to reflect these enhancements, ensuring it remains the source of truth.

### 3. Final Verification
I will perform a final review of the generated SQL to ensure it matches the project's canonical rules (e.g., `subjects.grade` and `students.grade_level` naming conventions).

Do you approve of these enhancements and the plan to rebuild the database? Once confirmed, I will proceed with generating and writing the SQL.