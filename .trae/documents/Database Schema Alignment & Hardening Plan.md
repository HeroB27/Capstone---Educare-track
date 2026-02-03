# Database Schema Alignment & Hardening Plan

I have reviewed the corrected rebuild script you provided. It contains several professional improvements, including enforced enums (CHECK constraints), data integrity rules (UNIQUE constraints), and hardened security policies. I will incorporate these into the system's canonical files and ensure the frontend logic remains synchronized.

## **Proposed Changes**

### **1. Core Database Rebuild (MASTER_RESET.sql / Supabase tables.txt)**
- **Enforced Constraints**: Add `CHECK` constraints to `event_type`, `status`, and `session` columns across all tables.
- **Data Integrity**: Implement `UNIQUE (student_id, date)` on the `attendance` table to prevent duplicate daily records.
- **Schema Refinement**: 
    - Rename `subject` to `subject_code` in `attendance_validations` to correctly reference the canonical subject list.
    - Ensure `school_calendar` contains the `notes` column used by the Admin Calendar module.
- **Security Hardening**: Upgrade RLS policies to include `WITH CHECK` clauses for the Admin "God Mode," ensuring total data control.
- **Robust Real-Time**: Implement an improved loop-based script for enabling Supabase Realtime with proper exception handling for existing publications.

### **2. Frontend Logic Sync**
- **Teacher Attendance**: Update [teacher-attendance.js](file:///c%3A/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/teacher/teacher-attendance.js) to:
    - Join the `subjects` table in the session info query to display the subject name.
    - Use `subject_code` instead of `subject` when querying or locking attendance sessions.
- **Admin IDs**: Update [admin-ids.js](file:///c%3A/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/admin/admin-ids.js) to correctly reference the `school_info` key for branding consistency.

### **3. Seeding Logic Sync**
- **Edge Function Seeder**: Synchronize [supabase/functions/seed/index.ts](file:///c%3A/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/supabase/functions/seed/index.ts) with the new `late_arrival_threshold` and refined table structures.
- **Data Initializer**: Fix the announcement author bug in [data-initializer.html](file:///c%3A/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/data-initializer.html) discovered during analysis.

## **Verification**
- I will perform a final cross-reference between the SQL script and all 13 JavaScript files that interact with `grade_level` or `attendance` to ensure zero runtime errors.

Does this plan look correct? If confirmed, I will proceed with the implementation.