# Finalize Database Schema

I will update the `Supabase tables.txt` file to reflect the finalized schema including the new Attendance, Clinic, and Excuse structures.

## 1. Attendance Tables Refinement
- **attendance**: Ensure `status` values ('present', 'absent', 'late', 'excused', 'clinic') are documented.
- **subject_attendance**: Add `remarks` column to store references to excuse letters or clinic visits.

## 2. Excuse Letters Table Refinement
- **excuse_letters**: 
    - Add `absent_date` (date) to track which day the student was/will be absent.
    - Add `remarks` (text) for teacher feedback or additional notes.
    - Ensure `status` covers ('pending', 'approved', 'rejected').

## 3. Clinic Module Refinement
- **clinic_visits**: 
    - Add `status` column ('checked_in', 'treated', 'released').
- **clinic_passes (NEW)**:
    - Create this table to track authorization for students leaving class.
    - Columns: `id` (uuid), `student_id` (text), `clinic_visit_id` (uuid), `issued_by` (uuid), `issued_at` (timestamptz), `reason` (text), `status` (text).

## 4. Integrity and Consistency
- Ensure all foreign keys correctly point to the new folder structure logic (e.g., `clinic_staff` references, etc.).
- Update constraints to match the "AM/PM" session requirements in `attendance_validations`.

## 5. Final SQL Preparation
I will generate the complete SQL script in `Supabase tables.txt` so it's ready for direct execution in the Supabase SQL Editor.

Shall I proceed with finalizing the schema file?