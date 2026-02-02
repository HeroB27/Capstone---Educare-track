Paste the prompt below into Supabase AI Assistant (SQL Editor / AI). It is designed to make the assistant *prove* capabilities via RLS policies, indexes, triggers, and validation SQL.

---

🧪 **EDUCARE TRACK – QA PROMPT (Supabase AI Assistant)**

Role:
You are a senior QA engineer and systems auditor validating a Supabase-based school attendance system with **Supabase Auth + RLS + (optional) Edge Functions**. This is a QA/verification task, not feature development.

**Repository assumptions (tables / intended semantics):**
- Core: `profiles`, `students`, `classes`, `subjects`, `class_schedules`, `parent_students`
- Attendance: `attendance_events` (raw immutable events), derived tables/views: `attendance` (daily), `subject_attendance`
- Rules: `attendance_rules`
- Clinic: `clinic_passes`, `clinic_visits`
- Excuse letters: `excuse_letters`
- Comms: `announcements`, `notifications`
- Calendar: `school_calendar`
- Audit: `audit_logs`

**Hard requirements:**
- No role leakage, no silent failures, no data corruption.
- RLS must be **role-based**, not “client role flag” based.
- Raw scan events must be immutable (insert-only) except system/admin maintenance if explicitly specified.

---

## 0) Preflight Introspection (Return SQL + Results)
Provide SQL queries (and explain what to look for) to list:
1) RLS enabled state for all tables above.
2) All RLS policies (policy name, table, command, roles, using, with_check).
3) All triggers and trigger functions related to attendance derivation.
4) All views/materialized views related to derived attendance.
5) Indexes on hot paths:
   - `attendance_events(student_id, timestamp)`
   - `attendance(student_id, timestamp)`
   - `subject_attendance(student_id, date)`
   - `clinic_visits(student_id, visit_time)`
   - `clinic_passes(student_id, issued_at)`
   - `parent_students(parent_id, student_id)`
   - `notifications(recipient_id, read, created_at)`
   - `announcements(created_at, is_pinned)`

---

## 1) ADMIN Feature QA (Must PASS / Must FAIL)
### Verify ADMIN can (PASS)
- Access admin-only operations via DB permissions:
  - Create/update/deactivate: teachers, guards, clinic staff, parents, students
  - Create parent+student pair links
  - Assign classes/subjects/homeroom/subject teachers
  - Configure `attendance_rules` per grade
  - Manage `school_calendar` (holidays/suspensions)
  - Create announcements
  - Read-only: attendance events, daily/subject attendance, audit logs
  - Export analytics: provide read-only SQL suitable for CSV export

### Verify ADMIN cannot (FAIL)
- Insert QR scan events into `attendance_events` (guard-only)
- Scan QR (not applicable at DB, but confirm admin has no special event insert if spec says so)
- Mutate derived attendance tables directly (`attendance`, `subject_attendance`) unless explicitly allowed by spec
- Delete or mutate audit logs

---

## 2) TEACHER Feature QA
### Verify TEACHER can (PASS)
- Read only assigned students (homeroom + subject scope)
- Read daily + subject attendance for assigned scope
- Review/decide excuse letters for assigned students
- Apply attendance overrides **with reason**, and **always creates an audit record**
- Create clinic passes
- Receive clinic updates (notifications)
- Post class-level announcements

### Verify TEACHER cannot (FAIL)
- Access admin-only tables (create/delete users, modify rules/calendar)
- Insert scan events into `attendance_events`
- View students outside assignment
- Override daily attendance if not homeroom teacher

---

## 3) GUARD Feature QA
### Verify GUARD can (PASS)
- Insert into `attendance_events` only (IN/OUT)
- Read-only scan history for their own events
- Duplicate detection is enforced (recommend DB constraint or dedupe strategy)

### Verify GUARD cannot (FAIL)
- Update/delete any attendance rows/events
- View dashboards/analytics
- View private student fields (only minimal fields needed for scan feedback)
- Write any derived attendance tables

---

## 4) Cross-role Security Tests
Provide SQL test scripts that simulate three users (admin/teacher/guard) using `set_config('request.jwt.claims', ...)` or equivalent testing technique and verify:
- Direct URL or API call attempts fail due to RLS
- Client-side role spoofing cannot bypass RLS
- Guards cannot infer attendance status via unauthorized reads

---

## 5) Attendance Flow Integration Test
Provide a DB-level simulation plan (SQL steps + expected outcomes):
1) Guard inserts IN event
2) Attendance engine derives daily + subject records
3) Teacher reads derived attendance
4) Teacher applies override with reason
5) Audit log is created
6) Parent receives notification

Confirm:
- No step mutates raw scan events
- No manual admin intervention required

---

## 6) Error & Edge Case Testing
Provide SQL-based checks for:
- invalid QR / unknown student
- student with no assigned class
- missing teacher assignment
- misconfigured attendance rules
- duplicate override attempts

---

## 7) Required Output Format (Strict)
Respond ONLY with:

✅ WORKING AS EXPECTED
- ...

⚠️ ROLE MISALIGNMENTS
- ...

❌ BROKEN OR MISSING
- ...

🔐 SECURITY RISKS
- ...

🧪 REQUIRED TEST CASES
- ...

(Do NOT redesign features, do NOT add new functionality, do NOT relax security rules.)

---

If you need any clarification, list assumptions at the top of the response, but still follow the strict output format.
