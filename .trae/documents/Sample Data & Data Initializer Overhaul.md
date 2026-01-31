# Sample Data & Initializer Update Plan

We will update the [data-initializer.html](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/data-initializer.html) to reflect the new production-grade school system requirements, including precise ID formats, role-specific staff, and end-to-end clinic/attendance workflows.

## 1. Update ID Generation
- Sync the `generateStudentID` and `generateStaffID` functions in the initializer script with the production logic in [utils.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/utils.js).
- Ensure all seeded profiles use these new formats.

## 2. Role-Specific Staff Seeding
- **Guards**: Seed 2 guards with `GRD-` IDs and initial gate assignments.
- **Clinic Staff**: Seed 2 clinic staff with `CLC-` IDs.
- **Parents**: Update parent profile generation to include phone numbers for staff ID generation logic if needed.

## 3. Enhanced Attendance Variety
- Diversify the seeded attendance records to include:
  - `late`: Scans after 07:30 AM.
  - `morning_absent`: First scans after 12:00 PM.
  - `early_exit`: Exit scans before dismissal settings.
  - `late_exit`: Exit scans 30+ minutes after dismissal.

## 4. Clinic Workflow Seeding
- Seed a complete clinic flow for at least 5 students:
  1. `attendance` entry (`entry_type: 'clinic'`, `status: 'pending'`).
  2. Transition to `approved` (Nurse approval).
  3. `clinic_visits` record (QR Check-in).
  4. Nurse findings and decisions stored in `remarks`.
  5. `attendance` entry transition to `returned` or `sent_home` (Checkout).

## 5. Notification & Audit Log Seeding
- Generate sample `notifications` for parents (attendance alerts) and teachers (clinic findings).
- Populated `audit_logs` with the new action types: `GATE_ENTRY`, `GATE_EXIT`, `CLINIC_CHECKIN`, `CLINIC_FINDINGS_UPDATED`, etc.

## 6. Verification
- Verify that the seeding process completes without foreign key violations.
- Check that the new sample data appears correctly in the Admin, Teacher, and Parent dashboards.

Shall I proceed with updating the data initializer script?