# EDUCARE TRACK - Enhanced Attendance, Clinic, and Excuse System

I will implement the updated data structures and workflows to fully integrate clinic visits and excuse letters into the attendance system.

## 1. Core Attendance Enhancements
I will update the attendance logic across all roles to support the new multi-status flow:
-   **Status Updates**: Add `clinic` and `excused` to the possible statuses for both Homeroom and Subject attendance.
-   **Contextual Remarks**: Update the recording logic in `teacher-attendance.js` and `guard-dashboard.js` to use the `remarks` field for linking to specific `excuse_letter_id` or `clinic_visit_id`.
-   **Session Tracking**: Ensure every attendance record correctly identifies the session (`AM` or `PM`) and entry type (`manual`, `QR`, `auto`).

## 2. Clinic Visit & Pass Integration
I will refine the clinic module to automate attendance updates:
-   **Automatic "Clinic" Status**: When a student is admitted in `clinic-checkin.js`, their current attendance status (Homeroom or Subject) will automatically be updated to `clinic`.
-   **Clinic Visit Records**: Every admission will create a detailed entry in `clinic_visits`, including the reason, treating staff, and notes.
-   **Clinic Pass Generation**: I will implement the logic for `clinic_passes` to track students authorized to leave class for medical reasons.
-   **Discharge Logic**: Update `clinic-checkout.js` to finalize the attendance status (e.g., `sent_home` or `returned`) and notify parents and teachers.

## 3. Excuse Letter Workflow
I will implement a complete end-to-end excuse letter management system:
-   **Parent Submission**: Create `parent/parent-excuse.html` and `parent-excuse.js` to allow parents to submit letters with reasons and dates.
-   **Teacher Approval**: Update `teacher-excuse.js` so that when a letter is approved, the system automatically finds the corresponding attendance records for that date and updates their status to `excused`, linking them to the letter ID.

## 4. Reporting & Analytics
I will update the analytics dashboards to reflect the more granular data:
-   **Detailed Summaries**: The Admin and Teacher dashboards will now show separate counts for `Excused` absences and `Clinic` visits.
-   **Trend Analysis**: Update charts in `admin-analytics.js` to track clinic load and excuse letter approval rates.

## 5. Implementation Steps
1.  **Attendance Statuses**: Update `teacher-attendance.js` and `guard-dashboard.js` status badges and cycle logic.
2.  **Clinic Admission**: Update `clinic-checkin.js` to record visits and update attendance.
3.  **Parent Excuses**: Build the submission interface for parents.
4.  **Excuse Approval**: Link approved letters to attendance in `teacher-excuse.js`.
5.  **Analytics**: Update `admin-analytics.js` and `admin-dashboard.js`.

Shall I proceed with these enhancements?