# Phase 3 Plan — Teachers & Parents v0.0.1 (Next Steps)

Date/Time: 2026-02-04 12:37

## Goal

Build a web app + PWA for Teacher and Parent workflows in the Educare Track system. Use Supabase as backend, Tailwind CSS for styling, and modular JS for logic. Fully integrate attendance, notifications, excuse letters, and clinic workflows with real-time updates where applicable.

## Scope (v0.0.1)

### Teacher

- Homeroom attendance + subject attendance views (assigned classes/subjects).
- Manual override for attendance (with audit trail into attendance/tap logs).
- Excuse letter portal (approve/reject, view attachment, optional remarks).
- Class announcements (to parents; class-scoped).
- Clinic notifications + pass approvals.
- Optional gatekeeper mode (tap in/out students).

### Parent

- Child dashboard with live tap-in/out status.
- Attendance history (month calendar).
- Excuse letter upload (PDF / Image) with absence date and reason.
- Notification settings (basic toggles/filters where supported).
- Real-time notifications for tap-in/out, clinic visits, urgent announcements, and excuse updates.

## Workflow Integration Requirements

### Admin → Teacher

- Assign classes & subjects to teachers.
- Assign gatekeeper role (optional).
- Teacher dashboard auto-populates assigned classes & students.

### Admin → Parent

- Create parent accounts and link students (already supported via provisioning export + script).
- Parent receives credentials and can log in immediately.

### Teacher ↔ Parent

- Notifications on attendance (late/absent), early exit, clinic events, and announcements.
- Excuse approval/rejection notifications.

## Technical Plan

### 1) Authentication & Role Routing

- Ensure login redirects users to the correct dashboard based on `profiles.role`.
- Enforce role-based authorization through Supabase RLS (not only client-side guards).

### 2) Data Model and RLS (Minimum for v0.0.1)

Tables used (per requirements):
- profiles, students
- homeroom_attendance, subject_attendance, tap_logs
- excuse_letters
- clinic_visits, clinic_passes
- notifications
- announcements

RLS requirements:
- Teacher: only sees assigned classes/students and related attendance/clinic/excuse rows.
- Parent: only sees their linked students and related attendance/clinic/excuse/notification rows.
- Storage: parents upload excuse files to a bucket with access limited to the owning parent and assigned teacher/admin.

### 3) Teacher Pages

#### Teacher Dashboard

- Fetch assigned homeroom + subjects and related student lists.
- Display attendance status per student: present/late/partial/absent/excused_absent/out.
- Manual override modal that writes consistent records to attendance tables and/or tap logs.
- Real-time updates via Supabase subscriptions for attendance/tap logs and clinic pass status.

#### Teacher Excuse Letters

- List excuse letters with status=pending.
- View attachment (PDF/image) from Supabase Storage.
- Approve/reject with remarks → update excuse_letters + generate notifications to parent.

#### Teacher Announcements

- CRUD announcements scoped to teacher’s assigned classes.
- Automatically create notifications for parents in the class scope.

### 4) Parent Pages

#### Parent Dashboard

- List linked children.
- Live in/out status from tap logs + current status field.
- Attendance calendar with color coding (present/late/absent/excused).
- Notification list with badge count and simple filters (optional v0.0.1).
- Real-time subscription for tap-in/out and new notifications.

#### Parent Excuse Upload

- Upload PDF/image to Supabase Storage.
- Insert excuse_letters row including student_id, date, reason, file path, status=pending.
- Notify assigned teacher/admin.

### 5) Notifications

Triggers to support in v0.0.1:
- Tap-in/out
- Late/absent states
- Clinic pass workflow transitions
- Excuse approve/reject
- Teacher announcements

Implementation detail:
- Standardize notification payload schema (title/body/type/target ids/read status).
- Subscribe to notifications by recipient (teacher/parent) for real-time UI updates.

### 6) Clinic Workflow (Minimal End-to-End)

- Teacher issues clinic pass → Clinic approves → Student arrives/logged → Clinic notes → Notify teacher → Teacher approves → Notify parent.
- v0.0.1 can start with teacher issue + approval + notifications; extend to full clinic notes if tables already exist.

### 7) PWA (v0.0.1 Baseline)

- Add/verify manifest, icons, installability checks.
- Cache the app shell (HTML/CSS/JS) for offline load.
- Keep real-time data online-only, but preserve last-viewed state in local storage.

## Milestones (Recommended)

1) Teacher v0.0.1
- Dashboard data wiring + manual override + attendance subscriptions
- Excuse portal approve/reject + storage viewing
- Announcements + parent notifications

2) Parent v0.0.1
- Child dashboard with live status + attendance calendar
- Excuse upload + notifications

3) Cross-cutting
- RLS + storage policies + notification delivery rules
- PWA baseline + smoke test suite

## Definition of Done (v0.0.1)

- Teacher can view assigned classes and manage attendance (including manual override) with real-time updates.
- Parent can view child status and attendance history and submit an excuse letter with upload.
- Notifications arrive in real time for key events (attendance, excuse updates, announcements, clinic transitions).
- All CRUD actions pass RLS checks and do not leak data across classes/parents.

