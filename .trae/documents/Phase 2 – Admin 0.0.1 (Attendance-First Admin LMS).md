## What I See Right Now
- The web app is currently a static HTML/Tailwind + JS setup with role dashboards and a simple auth/profile guard.
- The database reset SQL exists, but Phase 2 tables/policies are not complete for admin CRUD (example: no `announcements` table, and admin cannot `select * from profiles` under current RLS).
- Rule noted: analytics must show only real Supabase data (no dummy numbers). This will be enforced by showing empty-state UI when there’s no data.

## Phase 2 (Admin 0.0.1) Deliverable Scope
A simple, demo-ready Admin module with:
- Admin shell (sidebar + pages)
- Working CRUD for core admin entities (users, classes, announcements, calendar, settings)
- Attendance-first dashboard widgets + charts that use real data only
- CSV export and analytics computation done by Python scripts (generated from real Supabase data)

## Database (Schema + RLS) Changes
### 1) Minimal missing tables/columns
- Add `announcements` table (title, body, audience flags, created_by, created_at)
- Add `password_reset_requests` table (requested_by, note, status, created_at) to support “Forgot password → notify admin” without email flows
- Keep existing schema intact; only add what Phase 2 needs

### 2) Admin RLS helper + policies
- Add `is_admin()` SQL helper:
  - True when `profiles.id = auth.uid()` and `profiles.role = 'admin'`
- Add policies:
  - `profiles`: admin can select/insert/update/delete all; users can still select own profile
  - Admin CRUD policies for: `students`, `classes`, `subjects`, `class_schedules`, `attendance_rules`, `homeroom_attendance`, `subject_attendance`, `tap_logs`, `excuse_letters`, `student_ids`, `school_calendar`, `system_settings`, `notifications`, `clinic_visits`, `clinic_passes`, `announcements`, `password_reset_requests`
- Keep policies direct and uniform: “admin can do all” for Phase 2. (Teacher/parent/guard-specific policies come later.)

## Frontend (Admin Web UI)
### 1) Admin layout and navigation
- Create an Admin sidebar layout with these pages:
  - Dashboard
  - Users
  - Classes
  - Attendance
  - ID Cards
  - Announcements
  - Calendar
  - Settings
- Use the existing `requireAuthAndProfile()` guard; deny access if not admin.

### 2) Dashboard (no dummy data)
- Real-time Supabase reads for:
  - Total students
  - Today counts (present/late/absent/excused) based on `homeroom_attendance` for current date
  - Recent announcements
  - Critical alerts:
    - ≥10 absences (computed from real `homeroom_attendance`)
    - frequent late
- Charts:
  - Use a simple CDN chart library (Chart.js) or plain SVG.
  - If there’s no underlying data, show “No data yet” (empty state) and render empty charts (no fake numbers).

### 3) User Management (CRUD)
- Build modals/tables for `profiles` CRUD (teacher/parent/guard/clinic).
- Parent + student workflow (multi-step modal):
  - Parent profile data
  - Student record creation (linked via `students.parent_id`)
  - Create `student_ids` record (QR code string)
- Important security constraint:
  - Creating Supabase Auth accounts cannot be done safely from the browser (service role key must not be exposed).
  - Solution for 0.0.1: UI manages `profiles/students` records; Auth account creation stays in CLI scripts (Node) for demo.
  - Add a “Generate login credentials” panel that shows the exact `user_id` and the placeholder email mapping used by login.

### 4) Class Management
- CRUD `classes`
- Assignment:
  - homeroom_teacher_id
  - `class_schedules` subject assignments filtered by grade/strand
- Class view:
  - list students in class
  - show attendance % (computed from real data)
  - tap status from `students.current_status`
  - manual override for today’s `homeroom_attendance`

### 5) Attendance (Admin)
- Simple attendance page:
  - filter by date/class
  - view homeroom attendance table
  - manual override (status/remarks)
- Tap-in/out logic wiring will be Phase 3, but admin can edit records now.

### 6) Announcements
- CRUD `announcements` with audience checkboxes
- Show recent announcements on dashboard

### 7) Calendar + Settings
- Calendar CRUD using `school_calendar`
- Tap-in/out settings using `attendance_rules` (per grade-level)
- Teacher gatekeeper assignment stored in `system_settings` or a tiny `gatekeepers` table (whichever stays simplest)

## Python Analytics (Real Data Only)
- Add a small `analytics/` folder with Python scripts that:
  - Pull real data from Supabase (service role key via env)
  - Compute:
    - attendance % and trends
    - critical alerts
    - CSV exports
  - Output files:
    - `exports/dashboard_metrics.json`
    - `exports/attendance_export.csv`
- Admin dashboard will:
  - show live counts from Supabase directly
  - optionally load `exports/dashboard_metrics.json` if present
  - otherwise show “Run analytics script to generate charts/export” (no dummy values)

## Verification (Demo Checklist)
- Admin can navigate all pages while authenticated
- Admin can CRUD profiles/students/classes/announcements/calendar/settings
- Dashboard shows real counts or empty states (never dummy)
- Python scripts generate JSON + CSV from real Supabase data

If you confirm, I’ll start implementing Phase 2 exactly in this order: DB schema/RLS → admin UI shell → CRUD pages → dashboard analytics + charts (no dummy) → python analytics + CSV export → progress report.