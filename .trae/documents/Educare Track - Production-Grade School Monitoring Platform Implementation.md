# EDUCARE TRACK - Living System Implementation Plan

This plan transforms the current project into a production-grade school monitoring platform, strictly adhering to the "Master Prompt" rules for all five roles (Admin, Teacher, Parent, Guard, Clinic).

## 1. Core System Refinement
- **Update [utils.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/utils.js)**:
  - Implement precise ID formats:
    - Student: `EDU-YYYY-last4LRN-XXXX`
    - Staff: `ADM-YYYY-last4phone-XXXX`, `TCH-...`, `GRD-...`, `CLC-...`
  - Enhance `renderAdminLayout` and `renderTeacherLayout` to include the unified sidebar/main content structure with role-specific color themes (Violet for Admin, Blue for Teacher, etc.).
  - Add `renderParentLayout`, `renderGuardLayout`, and `renderClinicLayout` to ensure UI consistency across all roles.

## 2. Admin - System Operator Overhaul
- **Update [admin-users.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/admin-users.js)**:
  - Refactor Staff Creation into a step-by-step modal (Role → Personal Info → Account Creation → Confirmation).
  - Ensure Student Creation flow includes the detailed Parent + Student relationship logic.
- **Enhance [admin-analytics.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/admin-analytics.js)**:
  - Implement Trend Analytics (Late vs Absent) using Chart.js.
  - Add "Critical Absence List" (20+ absences) with export to CSV functionality.
- **Update [admin-calendar.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/admin-calendar.js)** and **[admin-settings.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/admin-settings.js)**:
  - Ensure holidays/suspensions and tap-in/out times directly drive the global attendance engine.

## 3. Guard - Gatekeeper Tap Logic
- **Enhance [guard-dashboard.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/guard-dashboard.js)**:
  - Implement "Morning Absent" detection (first scan in afternoon).
  - Implement "Early Exit" and "Late Exit" logic based on Admin dismissal settings.
  - Enforce strict duplicate scan blocking.
  - Ensure every scan triggers parent notifications via the unified `notifications` table.

## 4. Clinic - Medical Workflow Polishing
- **Refine [clinic-approval.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/clinic-approval.js)**, **[clinic-checkin.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/clinic-checkin.js)**, and **[clinic-findings.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/clinic-findings.js)**:
  - Ensure the workflow is "Medical-Grade": Pass approval → QR Check-in → Nurse Findings → Teacher Approval → Parent Notification → Checkout.
  - Enforce immutability of clinic data after checkout.

## 5. Teacher & Parent Dashboards
- **Update [teacher-attendance.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/teacher-attendance.js)** and **[teacher-excuse.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/teacher-excuse.js)**:
  - Implement Homeroom vs Subject roll call review.
  - Link excuse letter approval directly to attendance status updates.
- **Update [parent-dashboard.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/parent-dashboard.js)**:
  - Implement real-time "Child Status" (In / Out / In Clinic) tracking.
  - Add a monthly attendance calendar view.

## 6. PWA & Real-time Integration
- **Update [service-worker.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/service-worker.js)**:
  - Implement background sync and offline scan queuing for guards and clinic staff.
- **Global Real-time**:
  - Ensure all dashboards use Supabase real-time listeners for the unified notification box.

## Verification Plan
- **Test User Creation**: Verify ID formats for students and all staff roles.
- **Test Tap Logic**: Simulate late entry, morning absent (afternoon entry), and early exit to verify correct attendance flags.
- **Test Clinic Flow**: Follow a student from teacher pass to nurse findings to teacher approval to parent alert.
- **Test Offline Mode**: Simulate a guard scan while offline and verify sync once back online.
- **Test Notifications**: Verify that parents only receive clinic alerts after teacher approval.

Shall I proceed with refining the core utilities and layout engines first?