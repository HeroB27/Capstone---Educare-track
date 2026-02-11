# Educare Track System Documentation

## Overview

**Educare Track** is a school management system built with Supabase (PostgreSQL) and vanilla JavaScript front-end. It handles student attendance, clinic visits, announcements, and parent communications through QR code scanning.

---

## User Roles

| Role | Description | Access Level |
|------|-------------|--------------|
| `admin` | School Administrator | Full system access |
| `teacher` | Class Teacher | Class management, attendance |
| `parent` | Parent/Guardian | View child data, submit excuses |
| `guard` | School Guard | Entry/exit scanning |
| `clinic` | Clinic Staff | Medical visits, pass approval |

---

## Database Tables

### Core Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `profiles` | User accounts & roles | `id`, `full_name`, `role`, `is_active` |
| `students` | Student records | `id`, `full_name`, `lrn`, `class_id`, `current_status` |
| `classes` | Class definitions | `id`, `grade_level`, `homeroom_teacher_id` |
| `subjects` | Subject catalog | `code`, `name`, `grade_level` |

### Attendance Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `homeroom_attendance` | Daily attendance | `student_id`, `date`, `status`, `tap_in_time`, `tap_out_time` |
| `subject_attendance` | Per-subject attendance | `student_id`, `subject_code`, `date`, `status` |
| `attendance_rules` | Grading period rules | `grade_level`, `entry_time`, `grace_until`, `late_until` |
| `class_schedules` | Weekly schedules | `class_id`, `subject_code`, `day_of_week`, `start_time` |

### Clinic Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `clinic_visits` | Student medical visits | `student_id`, `visit_time`, `reason`, `status` |
| `clinic_passes` | Clinic exit passes | `student_id`, `clinic_visit_id`, `status`, `issued_by` |

### Communication Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `announcements` | School-wide announcements | `title`, `body`, `audience_*` flags |
| `notifications` | User notifications | `recipient_id`, `verb`, `object`, `read` |
| `excuse_letters` | Absence excuses | `student_id`, `absent_date`, `reason`, `status` |

### Admin Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `school_calendar` | Events & holidays | `type`, `start_date`, `end_date`, `grade_scope` |
| `student_ids` | QR code IDs | `student_id`, `qr_code`, `is_active` |
| `tap_logs` | Scan audit trail | `student_id`, `gatekeeper_id`, `tap_type`, `timestamp` |
| `system_settings` | Configuration | `key`, `value` |

---

## RLS (Row Level Security) Policies

### Profiles
- **SELECT**: All authenticated users can view profiles
- **UPDATE**: Users can only update their own profile

### Students
- **SELECT**: All authenticated users can view students
- **ALL**: Teachers can manage students in their class (via `homeroom_teacher_id` or `subject_teachers`)

### Announcements
- **SELECT**: Based on audience flags:
  - Admins see all
  - Teachers see `audience_teachers = true`
  - Parents see `audience_parents = true`
  - Guards see `audience_guard = true`
  - Clinic staff see `audience_clinic = true` or `audience_staff = true`

### Notifications
- **SELECT**: Users see only their own notifications

### Clinic Visits
- **ALL**: Only users with `role = 'clinic'` can manage

### Analytics Functions (Admin Only)
- `get_secure_attendance_trend()`
- `get_secure_class_performance()`
- `get_secure_critical_absences()`
- `get_secure_frequent_late_students()`
- `get_secure_clinic_visit_analytics()`

---

## System Workflows

### 1. QR Code Scanning (Entry/Exit)

```
Student QR (EDU-YYYY-LAST4LRN-XXXX)
    ↓
Guard scans via scanner module
    ↓
lookupStudentByQr() validates format
    ↓
recordTap() processes tap
    ↓
├─ Check school calendar (no classes today?)
├─ Check duplicate taps (2s debounce)
├─ Validate tap sequence (in → out)
├─ Update homeroom_attendance
├─ Update students.current_status (in/out/clinic)
├─ Insert tap_logs entry
└─ Send notifications to parent
```

**QR Format**: `EDU-YYYY-LAST4LRN-XXXX`
- `EDU`: Fixed prefix
- `YYYY`: 4-digit year
- `LAST4LRN`: Last 4 digits of student's LRN
- `XXXX`: 4-digit sequence

### 2. Daily Attendance

```
Morning (6AM - 12PM):
├─ Student taps IN
├─ computeArrivalStatus() determines:
│  ├─ Before grace_until → "present"
│  ├─ Before late_until → "late"
│  └─ After late_until → "absent"
└─ upsert homeroom_attendance (tap_in_time, status)

Afternoon (12PM - 6PM):
├─ Student taps OUT
├─ Check incomplete day (tapped in but no out)
└─ Update homeroom_attendance (tap_out_time)
```

### 3. Clinic Workflow

```
Student feels ill
    ↓
Teacher/Guard refers to clinic
    ↓
Clinic staff creates clinic_visits record
    ↓
Clinic issues clinic_pass (status: pending)
    ↓
Parent receives notification
    ↓
Clinic staff approves/rejects pass
    ↓
If approved: Student status → "clinic"
If rejected: Pass status → "rejected"
```

### 4. Excuse Letter Workflow

```
Student absent
    ↓
Parent submits excuse_letters record
    ↓
Status: "pending"
    ↓
Admin reviews and:
├─ Status → "approved" (absence excused)
└─ Status → "rejected" (absence unexcused)
```

### 5. School Calendar Events

Events that block tapping:
- `holiday`
- `break`
- `emergency`
- `shortened`
- `suspension`

Events that don't block:
- `event`
- `exam`

---

## Features by User Role

### Admin
- Dashboard with analytics (attendance trends, class performance)
- Manage classes, subjects, students
- View all attendance records
- Manage announcements
- Manage school calendar
- View clinic visit analytics
- Issue and re-issue student ID cards
- Password reset requests

### Teacher
- Class dashboard
- Mark homeroom attendance (manual override)
- Mark subject attendance
- View class schedule
- Submit announcements to parents
- Refer students to clinic
- View announcements

### Parent
- View child's attendance records
- View tap logs (in/out times)
- Submit excuse letters
- Receive notifications (tap in/out, clinic visits)
- View announcements

### Guard
- Scan student QR codes (entry/exit)
- View scan logs
- Refer students to clinic
- View announcements

### Clinic Staff
- Log student clinic visits
- Issue/approve/reject clinic passes
- View clinic visit history
- View announcements

---

## File Structure

```
educare-track/
├── admin/              # Admin dashboard pages
├── teacher/            # Teacher pages
├── parent/            # Parent pages
├── guard/             # Guard scanner pages
├── clinic/            # Clinic pages
├── auth/              # Login page
├── core/              # Shared utilities
│   ├── core.js       # Supabase client, auth
│   ├── scan-actions.js # QR scanning logic
│   ├── school-calendar.js # Calendar checks
│   ├── shell.js      # App shell navigation
│   ├── config.js     # Configuration
│   └── ui.js         # UI helpers
├── debug/             # Debug tools (deleted)
├── analytics/         # Analytics utilities
├── supabase_migrations/ # Database schema
├── exports/           # Generated exports
└── scripts/           # Seeder scripts
```

---

## Authentication

- **Method**: Supabase Auth (email/password)
- **Email format**: `{username}@educare.local` (auto-converted)
- **Session**: Stored in localStorage (`educare_profile_v1`)
- **Role check**: `profile.role` determines dashboard

---

## API Reference

### Core Functions

| Function | Purpose |
|----------|---------|
| `signInWithUserIdPassword(userId, password)` | Login |
| `signOut()` | Logout |
| `fetchMyProfile()` | Get current user profile |
| `requireAuthAndProfile()` | Require authenticated user |
| `lookupStudentByQr(qrCode)` | Find student by QR |
| `recordTap({gatekeeperId, student, tapType})` | Process scan |
| `notify({recipientId, actorId, verb, object})` | Send notification |
| `getNoClassesEvent({dateStr, gradeLevel})` | Check calendar |

### Notification Verbs

| Verb | Meaning |
|------|---------|
| `TAP_IN` | Student arrived |
| `LATE_ARRIVAL` | Student arrived late |
| `TAP_OUT` | Student left |
| `EARLY_DEPARTURE` | Student left early |
| `CLINIC_ENTRY` | Student entered clinic |
| `CLINIC_EXIT` | Student left clinic |
| `PASS_APPROVED` | Clinic pass approved |
| `PASS_REJECTED` | Clinic pass rejected |

---

## Database Functions

| Function | Returns | Purpose |
|----------|---------|---------|
| `get_student_attendance_summary(uuid)` | Summary stats | Attendance rate calculation |
| `issue_student_id(uuid)` | UUID | Generate student QR code |
| `get_secure_*()` | Admin-only views | Analytics (admin only) |

---

## Status Values

### Student Current Status
- `in` - Student is in school
- `out` - Student has left school
- `clinic` - Student is in clinic

### Attendance Status
- `present` - On time
- `late` - Arrived after grace period
- `absent` - Did not attend
- `excused` - Excused absence
- `partial` - Partial day (morning only)
- `morning_absent` - Morning absence
- `excused_absent` - Excused absence (alternative)

### Tap Log Status
- `success` - Successful tap
- `late` - Late arrival
- `early` - Early departure
- `invalid` - Invalid tap
- `duplicate` - Duplicate scan ignored
- `blocked` - Tap blocked (no classes)

### Clinic Visit Status
- `in_clinic` - Currently in clinic
- `treated` - Treatment complete
- `referred` - Referred to hospital

### Clinic Pass Status
- `pending` - Awaiting approval
- `approved` - Approved by clinic
- `rejected` - Rejected by clinic

### Excuse Letter Status
- `pending` - Awaiting review
- `approved` - Approved by admin
- `rejected` - Rejected by admin

---

## Configuration

### System Settings (system_settings table)

| Key | Purpose |
|-----|---------|
| `school_start_time` | School opening time |
| `school_dismissal_time` | School closing time |
| `late_threshold_minutes` | Minutes before marked late |
| `early_exit_threshold_minutes` | Minutes before early exit |

### Scanner Config

| Setting | Default | Purpose |
|---------|---------|---------|
| `SCAN_DEBOUNCE_MS` | 2000 | Debounce duplicate scans |

---

## Last Updated

2026-02-11
