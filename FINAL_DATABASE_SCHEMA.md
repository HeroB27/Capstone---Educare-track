# FINAL DATABASE SCHEMA (Basis)

This is the canonical database schema for Educare Track. It is written to match the current app’s queries and role dashboards.

## Canonical Field Choices

- `classes.grade` (not `classes.grade_level`)
- `subjects.grade` (not `subjects.grade_level`)
- `students.grade_level` remains as-is
- `profiles.password` is intentionally not present (Supabase Auth owns passwords)

## Core Tables

- `profiles`: one row per authenticated user (`id` matches `auth.users.id`), includes `role` and `is_active`.
- `admin_staff`, `teachers`, `parents`, `guards`, `clinic_staff`: role-specific extensions keyed by `profiles.id`.

## Academic Structure

- `classes`: school classes/sections; referenced by `students.class_id`.
- `students`: student master list (text ID), with `current_status` used across guard/clinic flows.
- `parent_students`: links parents to students.
- `subjects`: canonical subject list keyed by `code`, filtered by `grade`, optional `strand` and `semester`.
- `class_schedules`: timetable rows per class and semester.

## Attendance Engine

- `attendance_events`: raw gate scans (IN/OUT).
- `attendance`: derived daily attendance records (plus manual/absent rows).
- `subject_attendance`: per-subject tracking.
- `attendance_validations`: teacher/admin validations.
- `attendance_rules`: time rules per grade level (includes `dismissal_time` used by admin settings).

## Clinic / Excuse

- `clinic_visits`, `clinic_passes`
- `excuse_letters`

## Communications / Admin

- `announcements`
- `notifications`
- `school_calendar`
- `system_settings`
- `audit_logs`

## Security Model (Baseline)

The schema includes a baseline RLS setup:

- RLS enabled for all public tables
- Authenticated users can SELECT all tables (for current dashboard behavior)
- Admins can do all actions on all tables
- Users can UPDATE their own `profiles` row

## Source of Truth

- SQL DDL: `FINAL_DATABASE_SCHEMA.sql`
