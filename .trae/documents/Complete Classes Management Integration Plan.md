# Complete Classes Management Integration

I will update the Admin Class Management system to fully support the new DepEd-style structure, including semestral schedules for Senior High School and canonical subject integration.

## 1. UI Enhancements ([admin-classes.html](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/admin/admin-classes.html))
- **Semester Selector**: Add a semester dropdown to the "Class Schedule & Teachers" modal, visible only for Grade 11 and 12.
- **Strand Options**: Update the strand dropdown in both "Create" and "Edit" modals to match the canonical list: STEM, ABM, HUMSS, and ICT.
- **Unassigned Students**: Add a section to view and enroll students who are not yet assigned to any class.

## 2. Logic Updates ([admin-classes.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/admin/admin-classes.js))
- **Dynamic Subject Fetching**: Replace hardcoded `predefinedSubjects` with a real-time fetch from the `subjects` table, filtered by Grade, Strand, and Semester.
- **Schema Alignment**: 
    - Update the schedule saving logic to use `subject_code` (linking to the canonical `subjects` table) instead of plain text names.
    - Include the `semester` field in `class_schedules` for SHS entries.
- **SHS Semester Support**: Implement logic to load and save different schedules for Semester 1 and Semester 2 for Grades 11 and 12.
- **Adviser Integrity**: Ensure adviser assignments correctly update the `classes.adviser_id` and reflect in the UI.

## 3. Student Enrollment Flow
- **Auto-Grade Matching**: When enrolling students into a class, ensure their `grade_level` and `strand` in the `students` table are automatically synchronized with the class they are joined to.
- **Enrollment Modal**: Add a feature to search for unassigned students and quickly add them to the currently viewed class.

## 4. Testing & Verification
- Verify that creating a Grade 11 class allows selecting a strand (e.g., STEM).
- Verify that managing schedules for that class allows selecting between Semester 1 and 2.
- Confirm that the subject list for Semester 1 (e.g., Oral Communication) differs from Semester 2 (e.g., Reading and Writing).

Shall I proceed with these updates to make class management fully functional?