# Class Management – Subject Selection Logic Implementation

I will implement the Philippine K–12 curriculum structure into the Class Management module. This will ensure that the subject dropdown is dynamic and only shows valid subjects based on the selected Grade, Semester, and Strand.

## 1. Database Schema Alignment
- **Hardened `subjects` Table**: I will ensure the `subjects` table in [MASTER_RESET.sql](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/MASTER_RESET.sql) has the exact columns required for dynamic filtering: `grade_level`, `semester`, `strand`, and `type`.

## 2. Comprehensive Subject Seeding
- **Full Curriculum Seeding**: I will update [seed_auth_and_data.py](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/scripts/seed_auth_and_data.py) to seed the entire K-12 subject list as per your detailed spec:
    - **Kindergarten**: Language, Literacy, Math, etc.
    - **Elementary (1-6)**: English, Filipino, Science, MAPEH, EPP, etc.
    - **Junior High (7-10)**: TLE specializations (ICT, Home Ec, etc.).
    - **Senior High (11-12)**: Semester-based Core, Applied, and Strand-specific subjects (STEM, ABM, HUMSS, ICT).

## 3. Dynamic UI Logic (Class Management)
- **Smart Selectors**: I will update the Class Management UI to:
    - Automatically hide/show the **Semester** and **Strand** selectors only when Grade 11 or 12 is selected.
    - Implement a real-time filter on the **Subject dropdown**. When Grade/Sem/Strand changes, the dropdown will immediately update to show only valid subjects.
    - **Query logic**: 
      ```sql
      SELECT * FROM subjects WHERE grade_level = ? AND (semester = ? OR semester IS NULL) AND (strand = ? OR strand IS NULL)
      ```

## 4. Verification
- I will provide a quick test case: "Select Grade 11 -> Sem 1 -> STEM" and verify that subjects like "Pre-Calculus" and "General Biology 1" appear alongside Core subjects.

**I am starting the implementation of this Registrar-level subject system now.**
