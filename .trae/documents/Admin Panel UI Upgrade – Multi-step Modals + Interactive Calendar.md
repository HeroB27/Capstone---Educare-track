## Current State (What Exists)
- Admin shell + pages already exist: Dashboard/Users/Classes/Attendance/ID Cards/Announcements/Calendar/Settings.
- Users page has basic CRUD + a simple “Link student” modal.
- Calendar is currently a list + modal, not an interactive calendar.
- Important rule: analytics dashboards must show only real Supabase data (use empty states, never dummy numbers).

## Goal (This Request)
Upgrade the Admin Panel UI/UX to a modern, unified Users module with multi-step modal flows (parents/students and staff), plus an interactive calendar view (Google Calendar-like) with event create/edit/delete and optional announcement.

## Database Changes (Keep Minimal)
- Add `profiles.address text` (supports Parent Info modal without adding new tables).
- No new tables required beyond what already exists; reuse:
  - `profiles` (parents/staff)
  - `students` (children)
  - `student_ids` (QR strings)
  - `school_calendar` (events)
  - `announcements` (optional calendar announcement)
- Provide a clean “incremental migration” SQL snippet (ALTER TABLE + policies only; no drops).

## Users Module (Modern Table + Multi-step Wizards)
### 1) Unified Users Table
- Implement:
  - Search (name / user id)
  - Role filter
  - Sort (name, role, active)
  - Role badges + Active toggle
  - Actions: Edit
- Keep one unified view for Parents/Teachers/Guards/Clinic (+ Admin if desired).

### 2) Parent + Student Flow (Multi-step Modal)
Implement a stepper wizard that collects and previews everything before writing to Supabase:
1) Parent Info: name, phone, address, role (Parent/Guardian)
2) Student Info: full name, address (prefilled), emergency contact (parent phone), grade level, strand
3) Add Another Student: repeat step 2 (store students[] in memory)
4) Generate Student IDs: generate QR codes for each student after insert (one per student)
5) Confirmation: summary of parent + all students
6) Preview: final view and then submit

**Important auth constraint (no edge functions):**
- Creating Supabase Auth users from the browser is unsafe (requires service role key).
- Implement “Account Creation” as:
  - Create `profiles/students/student_ids` in Supabase (safe via admin RLS)
  - Generate credentials on-screen (username + password) for admin to copy
  - Optional: export a local JSON file that the admin runs via a Node script to create Auth users using service role key (local-only, not shipped to clients).
- Never store raw passwords in Supabase tables.

### 3) Staff Flow (Teacher/Clinic/Guard)
Stepper wizard:
1) Role + basic info
2) Account creation (username + password shown to admin only, not stored)
3) Preview & confirm
Then:
- Create `profiles` row immediately.
- Optionally export credentials for local Node script Auth creation.

### 4) User ID Conventions
- Students: `EDU-[year]-last4LRN-XXXX`
- Staff: `ADM/TCH/CLC/GRD-[year]-last4Phone-XXXX`
- Display the generated IDs in UI.
- Keep schema simple: store staff user id in `profiles.username`; store student QR string in `student_ids.qr_code`.

## Class Management Improvements
- Keep existing CRUD.
- Enforce “homeroom teacher is always first subject” in a direct way:
  - When adding the first schedule to a class and `homeroom_teacher_id` is empty, auto-set it to that schedule’s teacher.
  - Subject dropdown remains filtered by grade/strand.
- Add optional “Assigned classes” indicator on teacher rows in Users table (computed via query, no schema change).

## Calendar Module (Interactive)
- Replace list UI with an interactive calendar (month/week/day) using a CDN library (FullCalendar).
- Click date → modal to add event
- Click event → modal to edit/delete
- Event types: Holiday, Emergency Suspension, Shortened Period (stored in `school_calendar.type`)
- Colors/icons per type.
- On save, prompt: “Announce this event?” Yes/No.
  - If Yes: create an `announcements` row with audience flags (Teachers/Parents/Staff) and include grade scope in body.

## Design Requirements (Modern UI)
- Implement consistent cards, badges, icons, and stepper UI.
- Keep everything mobile-friendly and readable.

## Verification
- Verify Users flows:
  - Can add parent + multiple students
  - Creates correct rows in `profiles`, `students`, `student_ids`
  - Credentials export works and does not store passwords
- Verify Calendar:
  - Create/edit/delete events
  - Optional announcement creation
- Verify dashboard rule:
  - Still no dummy analytics data; empty states when no Supabase data exists.

If you confirm, I’ll implement this upgrade by updating the minimal DB migration, then refactoring Users + Calendar pages to the new UX, and finally adding the local-only Auth creation export workflow.