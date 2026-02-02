# Finalize Subject Management & canonical Seeding

I will update the database schema to support the standard DepEd subject structure and provide a comprehensive seeding script for all levels (Kindergarten to Grade 12).

## 1. Schema Refinement
I will update the `subjects` and `class_schedules` tables in `Supabase tables.txt` to handle semestral and strand-specific logic:
- **`subjects`**: Add `semester` (text), `strand` (text), and `type` (text: core/applied/specialized).
- **`class_schedules`**: Add `semester` (text) to ensure schedules are linked to the correct term.

## 2. Canonical Subject Seeding
I will generate a massive SQL `INSERT` script covering:
- **Kindergarten**: 6 fundamental development areas.
- **Elementary (1-6)**: Core subjects including Mother Tongue (1-3) and EPP (4-6).
- **Junior High (7-10)**: Core subjects and general "TLE".
- **Senior High (11-12)**: 
    - **Core & Applied Subjects**: Divided by Semester 1 and 2.
    - **Strand Specializations**: STEM, ABM, HUMSS, and ICT (TVL) tracks, mapped to specific semesters.

## 3. Visual Summary Logic
The system will be configured to:
- Filter subjects by **Grade Level** for K-10.
- Filter subjects by **Grade Level + Semester + Strand** for SHS.

Shall I proceed with updating the schema file and providing the seed script?