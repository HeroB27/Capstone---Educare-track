# 🧪 EDUCARE TRACK – UI QA CHECKLISTS (Admin / Teacher / Guard)

Use this with:
- [supabase_qa_bundle.sql](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/supabase_qa_bundle.sql)
- [supabase_role_sim_tests.sql](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/supabase_role_sim_tests.sql)
- [QA_REPORT_TEMPLATE.md](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/QA_REPORT_TEMPLATE.md)

## 1) ADMIN Feature QA

### 1.1 Access control (UI)
- PASS: Admin can open all `/admin/*.html` pages.
- FAIL: Non-admin role redirected or blocked.

Evidence to capture:
- Screenshot of URL + role badge/header.

### 1.2 Create/update/deactivate users (UI)
- Teachers / Guards / Clinic staff / Parents / Students
- PASS: Create persists in DB, appears on reload.
- PASS: Deactivate hides from role lists where appropriate.

DB checks (run in SQL Editor as admin/service):
```sql
select role, count(*) from profiles group by role;
select count(*) from students;
```

### 1.3 Parent + student pairing (UI)
- PASS: Linking a parent to student creates row in `parent_students`.

DB check:
```sql
select parent_id, student_id
from parent_students
order by created_at desc nulls last
limit 20;
```

### 1.4 Assign classes, subjects, homeroom, subject teachers (UI)
- PASS: `classes.adviser_id` updates.
- PASS: `class_schedules.teacher_id` and `subject_code` saved per semester.

DB check:
```sql
select id, grade, strand, adviser_id from classes order by created_at desc limit 10;
select class_id, semester, subject_code, teacher_id, start_time, end_time
from class_schedules
order by created_at desc nulls last
limit 20;
```

### 1.5 Attendance rules (UI)
- PASS: Can create/update per-grade rule row in `attendance_rules`.

DB check:
```sql
select * from attendance_rules order by created_at desc;
```

### 1.6 Calendar & suspension days (UI)
- PASS: Create holiday/suspension entries and they block school day logic.

DB check:
```sql
select * from school_calendar order by created_at desc limit 20;
```

### 1.7 Announcements (UI)
- PASS: Admin can create announcements; `audience` contains correct roles; `is_pinned` toggles ordering.

DB check:
```sql
select id, title, audience, is_pinned, posted_by, created_at
from announcements
order by is_pinned desc, created_at desc
limit 20;
```

### 1.8 Read-only analytics and audit logs (UI)
- PASS: Admin can view attendance + subject attendance + audit logs.
- FAIL: Admin cannot delete/mutate audit logs.

DB checks:
```sql
select count(*) from audit_logs;
```

---

## 2) TEACHER Feature QA

### 2.1 Teacher page access (UI)
- PASS: Teacher can access `/teacher/*.html` pages.
- FAIL: Teacher blocked from `/admin/*.html`.

### 2.2 Assigned student scope (UI)
- PASS: Teacher only sees assigned homeroom and/or scheduled subject students.
- FAIL: Teacher cannot view students not assigned.

DB checks (compare lists):
```sql
select id from classes where adviser_id = '<TEACHER_UID>' limit 5;
select class_id, subject_code from class_schedules where teacher_id = '<TEACHER_UID>' limit 20;
```

### 2.3 Excuse letters decision workflow (UI)
- PASS: Teacher can approve/reject letters relevant to their scope.
- PASS: Decision writes `excuse_letters.status` and `excuse_letters.remarks`.
- PASS: If approved, attendance becomes `excused` for that date (daily + subject).
- PASS: Parent receives notification (`notifications.recipient_id = parent_id`, `verb='excuse_letter_decision'`).

DB checks:
```sql
select id, student_id, parent_id, absent_date, status, issued_at, remarks
from excuse_letters
order by issued_at desc
limit 20;

select id, recipient_id, verb, read, created_at
from notifications
order by created_at desc
limit 20;
```

### 2.4 Clinic pass workflow (UI)
- PASS: Teacher creates clinic pass → `clinic_passes.status='pending'`.
- PASS: Teacher sees clinic updates / parent notify approval step if implemented.

DB checks:
```sql
select id, student_id, issued_by, status, issued_at, clinic_visit_id
from clinic_passes
order by issued_at desc
limit 20;
```

### 2.5 Teacher announcements (UI)
- PASS: Teacher posts announcement; targets correct audience; visible to that role.

DB check:
```sql
select id, title, audience, is_pinned, posted_by, created_at
from announcements
where posted_by = '<TEACHER_UID>'
order by created_at desc
limit 20;
```

---

## 3) GUARD Feature QA

### 3.1 Access control (UI)
- PASS: Guard only accesses guard pages (scanner/dashboard if present).
- FAIL: Guard cannot access teacher/admin pages.

### 3.2 Scan logic (UI)
Simulate:
- IN scan (first scan of day)
- Duplicate IN scan (should be rejected/throttled)
- OUT without prior IN
- Scan after school hours
- Scan on holiday/suspension day

Expected:
- Raw scan events stored only in `attendance_events` (insert-only).
- Derived tables update via engine (if implemented).

DB checks:
```sql
select id, student_id, event_type, timestamp, recorded_by
from attendance_events
order by timestamp desc
limit 50;
```

### 3.3 Guard restrictions (Must FAIL)
- FAIL: Guard cannot UPDATE/DELETE `attendance_events`.
- FAIL: Guard cannot read full student profile fields beyond minimal needs.

Use [supabase_role_sim_tests.sql](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/supabase_role_sim_tests.sql) to validate under RLS.

---

## 4) Attendance Flow Integration Test (End-to-End)

Steps:
1) Guard inserts IN event for student in `attendance_events`.\n+2) Attendance engine derives daily status in `attendance` + subject rows in `subject_attendance`.\n+3) Teacher views derived attendance.\n+4) Teacher applies override with reason.\n+5) Audit log created.\n+6) Parent notified.\n+\n+Evidence:\n+- SQL outputs showing the event row is unchanged (immutable).\n+- SQL outputs showing derived rows updated appropriately.\n+- `audit_logs` contains an override record.\n+- `notifications` contains a parent notification.\n+\n***Note***\n+If your implementation currently writes scans into `attendance` directly (instead of `attendance_events`), that is a role/architecture mismatch against the “event-driven attendance” requirement and should be reported under ❌ BROKEN OR MISSING.\n+
