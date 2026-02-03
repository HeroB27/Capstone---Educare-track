# Database Consolidation & Final Alignment Plan

I will establish a single, definitive source of truth for the database schema and remove all redundant files to prevent confusion. This "MOST FINAL" file will incorporate the professional integrity constraints you provided while ensuring zero breakages in the frontend system.

## **Consolidation Steps**

### **1. Establish the Single Source of Truth**
- **File**: [from SUPABASE.txt](file:///c%3A/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/from%20SUPABASE.txt)
- **Content**: I will populate this file with the "Verified Rebuild Script" you provided, including:
    - Enforced Enums (CHECK constraints for roles, attendance status, sessions).
    - Hardened Security (RLS God Mode with `WITH CHECK`).
    - Robust Real-time Publications (Loop-based setup).
    - **Alignment Fix**: I will add the `notes` column to the `school_calendar` table and ensure the `school_info` key is documented, as these are critical for the current Admin Calendar and Branding features.

### **2. Clutter Removal**
I will delete all redundant and potentially conflicting database files:
- [Supabase tables.txt](file:///c%3A/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/Supabase%20tables.txt)
- [FINAL_DATABASE_SCHEMA.sql](file:///c%3A/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/FINAL_DATABASE_SCHEMA.sql)
- [FINAL_DATABASE_SCHEMA.md](file:///c%3A/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/FINAL_DATABASE_SCHEMA.md)
- [MASTER_RESET.sql](file:///c%3A/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/MASTER_RESET.sql)
- [SEED_DATA.sql](file:///c%3A/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/SEED_DATA.sql)
- [create_attendance_engine.sql](file:///c%3A/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/create_attendance_engine.sql)

### **3. System Documentation Alignment**
- Update [.trae/rules/database.md](file:///c%3A/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/.trae/rules/database.md) to point to [from SUPABASE.txt](file:///c%3A/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/from%20SUPABASE.txt).
- Update references in [QA_WORKFLOW_SIMULATION.md](file:///c%3A/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/QA_WORKFLOW_SIMULATION.md) and [HANDOVER.md](file:///c%3A/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/HANDOVER.md).

## **Final Verification**
I will perform a final scan of the JS modules to confirm that every query matches the finalized table structures in the new single-file basis.

Does this consolidation plan meet your requirements? Once confirmed, I will execute the cleanup.