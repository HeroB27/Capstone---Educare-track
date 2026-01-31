# QA/Adversarial Validation Plan: EDUCARE TRACK

I will execute a comprehensive QA suite to stress-test the system against the schema-locked architecture and established rules. Each test will result in a PASS/FAIL status with detailed findings.

## 🛡️ Role & Permission Validation
1.  **Test 1.1 – Role Isolation**: Verify that `utils.checkAccess` is strictly enforced across all admin pages and that unauthorized users (teachers/guards) are redirected. I will inspect `admin-users.js`, `admin-classes.js`, and `admin-analytics.js`.
2.  **Test 1.2 – Teacher Scope Enforcement**: Verify that teachers can only access students assigned to them. I will inspect `teacher-homeroom.js` and `teacher-dashboard.js` for proper `class_id` and `adviser_id` filtering in Supabase queries.

## 👤 User Management Validation
1.  **Test 2.1 – Parent/Student Linking**: Verify that `admin-users.js` correctly handles multiple students per parent using the `parent_students` bridge table without duplicating parent profiles.
2.  **Test 2.2 – ID Collision Resilience**: Analyze the uniqueness of `generateStudentID` and `generateStaffID` in `utils.js`. I will check if the random component and LRN/Phone suffix are sufficient to prevent collisions.

## 📊 Attendance & Locking Validation
1.  **Test 3.1 – Append-Only Integrity**: Search the entire codebase for any `DELETE` or `UPDATE` operations on the `attendance` table. Any such operation (except for correcting `students.current_status`) will be flagged as a FAIL.
2.  **Test 3.2 – Teacher Validation Lock**: Test the roll-call interface in `teacher-attendance.js` to ensure that once a record exists in `attendance_validations`, the UI becomes read-only and further edits are blocked.
3.  **Test 3.3 – Post-Validation Scans**: Verify that gatekeeper scans occurring after a teacher has validated attendance are recorded in history but do NOT alter the validated status for that subject/session.

## 📚 Subject-Specific Validation
1.  **Test 4.1 – Subject Isolation**: Ensure teachers can only access attendance for subjects assigned to them in the `class_schedules` or `teachers.assigned_subjects` field.
2.  **Test 4.2 – Validation Uniqueness**: Confirm that the database `UNIQUE` constraint on `attendance_validations(class_id, subject, session, attendance_date)` prevents duplicate roll-calls.

## 🛠️ Admin Overrides & Auditing
1.  **Test 5.1 – Override Audit Trail**: Verify that Admin overrides in `admin-users.js` (or related files) result in a new `attendance` row and a corresponding entry in `audit_logs`.

## 🚪 Gatekeeper & Clinic Validation
1.  **Test 6.1 – Entry/Exit Synchronization**: Verify that scans in `guard-dashboard.js` and `teacher-gatekeeper.js` correctly update `students.current_status` and insert the correct `entry_type`.
2.  **Test 6.2 – Gatekeeper Boundaries**: Ensure gatekeepers cannot access or modify the roll-call validation table.
3.  **Test 7.1 – Clinic Integrity**: Verify that clinic visits in `clinic_visits` do not interfere with the append-only attendance history.

## 📈 Analytics & Calendar Validation
1.  **Test 8.1 – Excused Status Logic**: Verify in `admin-analytics.js` that students with `status = 'excused'` are correctly excluded from the total absence count.
2.  **Test 8.2 – Absence Thresholds**: Validate the warning (10) and critical (20) absence logic in `admin-analytics.js`.
3.  **Test 9.1 – Suspension Day Enforcement**: Check if the system prevents attendance logging on dates marked as suspended in the school calendar.

## 🏁 Final Deliverable
A detailed **QA Validation Report** following the user's requested format, identifying any security leaks, logic gaps, or schema violations.
