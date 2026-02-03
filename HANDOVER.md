# 🎓 EDUCARE TRACK - HANDOVER GUIDE

Welcome to the **Educare Track** project! This is a production-grade school monitoring system built with **Supabase**, **Tailwind CSS**, and **PWA** capabilities.

---

## 🚀 How to Open & Run the Project

1.  **Local Server (Recommended)**:
    - Open your terminal in the project root.
    - Run: `python -m http.server 8000`
    - Open your browser to: `http://localhost:8000`
2.  **Direct Access**: You can also just open `index.html` directly in your browser, but PWA features (Service Workers) require a local server to function correctly.
3.  **Database Setup**:
    - Open `data-initializer.html` in your browser.
    - Click **"Wipe & Seed Production Data"**. This will populate the Supabase database with all roles, classes, and students needed for testing.

---

## 🛠 Project Structure

-   `admin/`, `teacher/`, `guard/`, `clinic/`, `parent/`: Role-specific HTML dashboards and their JS.
-   `js/`: Shared logic and Supabase integrations (`auth.js`, `supabase.js`, `utils.js`).
-   `supabase/functions/`: Edge functions (Deno) including `seed`, `admin-create-user`, `admin-update-user`.
-   `service-worker.js`: Handles caching and offline queuing for the PWA.
-   `from SUPABASE.txt`: Canonical database schema baseline (Single Source of Truth).

---

## ✅ Recent Changes (Stabilization)

-   Fixed role-based redirects so Guard/Clinic/Parent no longer loop back to login. See `index.html` role mapping.
-   Hardened access gating across dashboards using `checkAccess` in `js/utils.js`.
-   Aligned Admin features to schema: use `classes.grade` (not `grade_level`) and deterministic `classes.id`. See `admin/admin-classes.js`.
-   Consolidated database schema to `from SUPABASE.txt`.
-   Synced seed data logic with schema (classes, subjects, students). See `supabase/functions/seed/index.ts`.

---

## 🏗 Core Workflows to Understand

### 1. Guard (Gatekeeper)
-   **Gate Scans**: Scans student QRs. Detects `entry` or `exit`.
-   **Tap Logic**: Identifies `late`, `morning_absent` (afternoon entry), and `early_exit`.
-   **Offline Mode**: Scans are queued in LocalStorage if the internet is down and synced automatically when back online.

### 2. Clinic (Medical)
-   **The Chain**: Teacher Pass → Nurse Approval → QR Check-in → Nurse Findings → Teacher Approval → Parent Alert.
-   **Accountability**: No student enters the clinic without a teacher's pass.

### 3. Admin (Operator)
-   **Management**: Multi-step modals for creating Staff (Teacher, Guard, Clinic) and linking Students to Parents.
-   **Analytics**: Visual charts for attendance trends and "Critical Absence" (20+) alerts.

---

## 🎯 What to Do Next (Upgrades)

1.  **PWA Push Notifications**: Implement real-world push alerts using the Web Push API (currently uses an internal notification system).
2.  **Photo Uploads**: Integrate a real storage solution (Supabase Storage) for student ID photos (currently uses Base64 strings).
3.  **Report Generation**: Add a "Generate PDF" feature for student attendance reports and clinic history.
4.  **Admin Calendar**: Link the school calendar more deeply into the attendance engine (e.g., auto-marking holidays as non-school days).

---

## 🧪 Testing Checklist

-   [ ] **Tailwind Fallback**: Disable internet and verify that `css/offline-fallback.css` loads if the CDN fails.
-   [ ] **Offline Scanning**: Toggle "Offline" in DevTools, scan a student, and verify it syncs when back "Online".
-   [ ] **ID Generation**: Create a new student and verify the ID matches `EDU-2026-LRN-RAND`.
-   [ ] **Clinic Gating**: Try to check a student into the clinic without a teacher-issued pass (should be blocked).
-   [ ] **Parent Notifications**: Verify parents only receive clinic results AFTER the teacher approves the findings.

---

## 🔑 Credentials (Sample Data)
- **Admin**: `admin1@educare.edu` / `Educare@2024`
- **Teacher**: `teacher1@educare.edu` / `Educare@2024`
- **Guard**: `guard1@educare.edu` / `Educare@2024`
- **Nurse**: `nurse1@educare.edu` / `Educare@2024`
- **Parent**: `parent1@educare.edu` / `Educare@2024`

## 🔗 Supabase Connection (Backend)
- **Project Name**: Educare Track
- **URL**: `https://tkwjxmhnroqprmjfoaua.supabase.co`
- **DB Password**: `idxn+9%NV2v+9Eg`
- **Service Worker / Python**: Requires the `SERVICE_ROLE_KEY` from the Supabase dashboard to perform administrative tasks. / `Educare@2024`

Good luck! This system is built to feel like a real school information system. Reach out if you have questions!
