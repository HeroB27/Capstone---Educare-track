# Implementation Plan: Educare Track - School Management System

I will build a comprehensive, role-based school management system using HTML, Tailwind CSS, JavaScript, and Supabase. The system will support Admin, Teacher, Parent, Guard, and Clinic roles with specialized dashboards and real-time attendance tracking.

## Technical Architecture
- **Frontend**: HTML5, Tailwind CSS (Responsive/Mobile-first), Vanilla JavaScript.
- **Backend/Database**: Supabase (PostgreSQL, Auth, Real-time notifications).
- **Libraries**: 
  - `Chart.js` for data analytics.
  - `html5-qrcode` for QR code scanning.
  - `qrcode.js` for ID QR generation.
  - `Lucide Icons` for UI consistency.
- **PWA**: Manifest and Service Worker for mobile app experience.

## Phase 1: Core Infrastructure
1.  **Project Initialization**: Create the directory structure and shared `styles.css`.
2.  **Supabase Integration**: Create `js/supabase-config.js` with the provided credentials and client initialization.
3.  **Authentication**: Develop `index.html` (Login) and `js/auth.js` to handle role-based redirection.

## Phase 2: Admin Module (Violet Theme)
1.  **Dashboard**: Implement `admin-dashboard.html` with charts for attendance trends, clinic reasons, and class performance.
2.  **User Management**: Create modals for the multi-step registration flow (Parent -> Account -> Student -> ID Generation).
3.  **ID Management**: Develop the ID printing system (2x3 format) with automatic QR code generation using the `EDU-YYYY-LRN-XXXX` format.
4.  **Class & Schedule**: Build the interface for assigning homeroom and subject teachers.
5.  **Settings**: Create the "Tap in/out" configuration and School Calendar pages.

## Phase 3: Guard/Gatekeeper Module (Yellow Theme)
1.  **Scanning Interface**: Build `guard-scanner.html` with camera support (Mobile) and USB scanner integration (PC).
2.  **Attendance Logic**: Implement the complex tap-in/out rules (late detection, duplicate scan prevention, early dismissal alerts).
3.  **Real-time Notifications**: Trigger parent notifications immediately upon successful scanning.

## Phase 4: Teacher & Parent Modules (Blue/Green Themes)
1.  **Teacher Dashboard**: Real-time student status list, subject attendance tracking, and clinic pass generation.
2.  **Parent Dashboard**: Live "In/Out" status, attendance history calendar, and excuse letter upload portal.
3.  **Excuse Letter Workflow**: System for parents to upload and teachers to approve/reject letters.

## Phase 5: Clinic Module (Red Theme)
1.  **Clinic Management**: Student check-in via QR, findings entry, and the notification chain (Nurse -> Teacher -> Parent).

## Phase 6: PWA & Final Polish
1.  **PWA Integration**: Add `manifest.json` and `service-worker.js`.
2.  **Mobile Optimization**: Ensure all dashboards and modals are fully responsive using Tailwind.
3.  **Testing**: Verify the notification box system and data persistence in Supabase.

---
**Does this plan align with your vision for the Educare Track system? Please confirm to start the implementation.**