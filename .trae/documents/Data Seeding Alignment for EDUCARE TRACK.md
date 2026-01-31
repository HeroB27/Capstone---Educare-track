# Data Seeding Alignment Plan: EDUCARE TRACK

I will rewrite the `data-initializer.html` to be strictly schema-bound, ensuring it respects the "No Sections" rule, append-only attendance history, and teacher-validated roll calls.

## 🛠️ Implementation Steps:

### 1. Schema-Locked User Creation
- **Admins & Guards**: Ensure exact mapping to `profiles`, `admin_staff`, and `guards` tables.
- **Teachers**: Correctly assign `is_homeroom` and `assigned_subjects` (as arrays) to match the `teachers` table.

### 2. Academic Structure Alignment (No Sections)
- **Classes**: Generate IDs like `CLS-10` or `CLS-11-ABM`.
- **Constraint Enforcement**: Strictly set `strand = NULL` for Kinder to Grade 10.
- **Adviser Linking**: Map `classes.adviser_id` to homeroom teachers.

### 3. Student & Parent Relationship
- **Students**: Ensure `grade_level` and `strand` match their assigned `class_id`.
- **Parent Linking**: Use `parent_students` bridge table for all student-parent relationships.
- **QR Codes**: Proactively generate entries in the `qr_codes` table for every student.

### 4. Realistic Attendance & Validation Seeding
- **Append-Only History**: Seed raw scan data (entry/exit) into the `attendance` table from Nov 2025 to present.
- **Teacher Validations**: Seed `attendance_validations` rows to represent finalized roll calls, respecting the `UNIQUE` constraint on (class, subject, session, date).
- **Audit Trail**: Seed `audit_logs` for sample corrective actions (overrides) to test the audit system.

### 5. Final Schema Alignment Check
- I will perform a final review of the `init()` function to ensure:
    - No strands for Kinder-G10.
    - All roles align with their specific role tables.
    - `students.current_status` correctly reflects the final scan in the seeding sequence.

## 📋 Verification
I will provide a summary of the seeded counts per table, confirming that all DB-level triggers and RLS policies (from the previous step) would accept this data.
