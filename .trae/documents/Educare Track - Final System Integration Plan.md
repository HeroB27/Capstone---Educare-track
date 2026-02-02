# EDUCARE TRACK - Final System Integration Plan

## 1. Security & Access Control (RLS)
I will implement Row Level Security (RLS) across all tables to ensure data privacy and role-based access as requested.
-   **Profiles**: Users can only see their own profile; Admins see all.
-   **Students**: Parents can only see their children; Teachers see students in their classes/homeroom.
-   **Attendance**: Guards can insert; Parents see their children's history; Teachers see their class records.
-   **Clinic & Excuse Letters**: Strict access for Clinic staff and assigned Teachers respectively.

## 2. Attendance Engine (Derived Logic)
I will implement the "Derived Attendance" logic using Supabase triggers and functions:
-   **Auto-Subject Attendance**: When a student scans IN at the gate, the system will automatically populate `subject_attendance` for all their scheduled classes that day.
-   **Late/Absent Detection**: Automatically mark students as "Late" or "Absent" based on school-wide arrival rules and individual class schedules.
-   **Immutable Scans**: Ensure gate scans remain immutable event logs, with derived states stored in computed tables.

## 3. Analytics & Real-time Dashboards
I will link the revamped UI to live data:
-   **Admin Dashboard**: Replace mock chart data with real-time aggregates from the `attendance` and `subject_attendance` tables.
-   **Analytics Page**: Implement the logic in [admin-analytics.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/admin-analytics.js) to show attendance trends, risk factors (high absence), and class performance.
-   **CSV Export**: Finalize the "Export Analytics" feature for Admin users.

## 4. Admin CRUD & Modals
I will verify and refine the administrative workflows:
-   **User Management**: Ensure the step-by-step modals for Parent + Student creation are fully functional, including photo uploads and QR generation.
-   **Class Management**: Verify the flow for assigning homeroom and subject teachers.
-   **School Calendar**: Ensure holidays and suspensions correctly block attendance recording.

## 5. Progress & Verification
-   **Progress Reports**: Generate a status report after each major update as per workspace rules.
-   **End-to-End Test**: Perform a full walkthrough from student registration to QR scanning and parent notification.

I will start by creating the comprehensive SQL migration for RLS and the Attendance Engine. Shall I proceed?