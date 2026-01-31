# Clinic Module Implementation Plan (Schema-Aware)

We will implement a medical-grade clinic workflow that integrates directly with your existing Supabase schema. This plan strictly follows the requested logic flow, ensuring teacher approval, QR-based check-in, nurse findings, and multi-step notifications with full audit logging.

## Phase 1: Teacher Side - Clinic Pass Issuance
- **Update [teacher-clinic.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/teacher-clinic.js)**:
  - Modify `submitPass` to insert into `attendance` table (`entry_type: 'clinic'`, `status: 'pending'`).
  - Send notification to clinic staff via `notifications` table (`verb: 'clinic_pass_issued'`).
  - Log initial audit `CLINIC_PASS_ISSUED`.

## Phase 2: Clinic Staff Approval
- **Create [clinic-approval.html](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/pages/clinic-approval.html) and [clinic-approval.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/clinic-approval.js)**:
  - View students with `pending` clinic attendance.
  - Nurse can "Approve" or "Reject" the pass.
  - Updates `attendance.status` to `approved` or `rejected`.
  - Notifies issuing teacher of the decision.
  - Audit: Log `CLINIC_PASS_APPROVED` or `CLINIC_PASS_REJECTED`.

## Phase 3: Student QR Check-in
- **Create [clinic-checkin.html](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/pages/clinic-checkin.html) and [clinic-checkin.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/clinic-checkin.js)**:
  - QR Scanner (using `jsQR`) for student admission.
  - Validates student ID via `qr_codes` and checks for an `approved` clinic pass in `attendance`.
  - On Success: 
    - Insert into `clinic_visits`.
    - Update `students.current_status` to `in_clinic`.
    - Update `attendance.status` to `in_clinic`.
    - Notify homeroom and subject teachers.
  - Audit: Log `CLINIC_CHECKIN`.

## Phase 4: Medical Findings & Decision
- **Create [clinic-findings.html](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/pages/clinic-findings.html) and [clinic-findings.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/clinic-findings.js)**:
  - Manage "Active Patients" (`in_clinic`).
  - Nurse inputs `reason` and `notes` into `clinic_visits`.
  - Nurse selects decision: `return_to_class`, `rest_at_clinic`, or `send_home` (stored in `attendance.remarks`).
  - Notify Teacher: `clinic_findings_ready`.
  - Audit: Log `CLINIC_FINDINGS_UPDATED`.

## Phase 5: Teacher Approval & Parent Notification
- **Update [teacher-clinic.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/teacher-clinic.js)**:
  - Add a "Findings Approval" section for teachers.
  - Teacher approves parent notification for the nurse's decision.
  - On Approval: Insert `notifications` record for Parent (`verb: 'clinic_update'`).
  - Audit: Log `PARENT_NOTIFIED_FROM_CLINIC`.

## Phase 6: Clinic Check-out (Discharge)
- **Create [clinic-checkout.html](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/pages/clinic-checkout.html) and [clinic-checkout.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/clinic-checkout.js)**:
  - Discharge patients from the clinic.
  - Update `students.current_status` ('out' or 'sent_home').
  - Update `attendance.status` ('returned' or 'sent_home').
  - Send final notifications to Teacher and Parent.
  - Audit: Log `CLINIC_CHECKOUT`.

Please confirm if you are ready for me to begin implementing these schema-locked features.