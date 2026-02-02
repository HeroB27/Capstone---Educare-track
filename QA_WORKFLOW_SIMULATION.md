# Educare Track – Workflow Simulation Checklist (UI + DB)

This checklist validates the end-to-end admin-configured workflows using the current schema in [Supabase tables.txt](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/Supabase%20tables.txt).

## 0) Preflight (Must Pass)

### 0.1 Confirm schema fields exist
- Ensure your Supabase project has the updated fields used by the UI:
  - `announcements.content`, `announcements.posted_by`, `announcements.is_pinned`
  - `notifications.recipient_id`, `notifications.read`
  - `clinic_passes.status` supports `pending/approved/rejected/used`

### 0.2 Confirm RLS/Auth alignment
The app uses localStorage-based login (not Supabase Auth). If your DB policies rely on `auth.uid()`, browser requests will fail when RLS is enabled.

Run (Supabase SQL Editor):
```sql
select relname, relrowsecurity
from pg_class
where relnamespace = 'public'::regnamespace
and relname in (
  'profiles','students','attendance','subject_attendance','parent_students',
  'announcements','notifications','clinic_visits','clinic_passes','excuse_letters'
)
order by relname;
```

Expected:
- If `relrowsecurity = true`, you must ensure your policies work with the app’s auth model (or migrate auth to Supabase Auth).

## 1) Admin → Classes Setup

### 1.1 Create class (UI)
- Admin → Class Management → Create New Class
  - Grade 11, Strand STEM, Room 301

Verify (SQL):
```sql
select * from classes order by created_at desc limit 5;
```

### 1.2 Assign adviser (UI)
- Admin → open Assign modal → pick teacher → Save

Verify (SQL):
```sql
select id, grade, strand, adviser_id, room
from classes
order by created_at desc
limit 5;
```

### 1.3 Add schedules per semester (UI)
- Admin → Assign modal → Semester 1 → Add Subject Periods → Save
- Switch Semester 2 → Add Subject Periods → Save

Verify (SQL):
```sql
select class_id, semester, subject_code, teacher_id, start_time, end_time
from class_schedules
where class_id = '<YOUR_CLASS_ID>'
order by semester, start_time;
```

Expected:
- Semester 1 and Semester 2 rows are distinct.
- `subject_code` matches rows in `subjects(code)`.

## 2) Teacher → Clinic Pass Workflow

### 2.1 Issue clinic pass (UI)
- Teacher → Clinic → New Pass → select student → Submit

Verify (SQL):
```sql
select id, student_id, issued_by, status, issued_at, reason, clinic_visit_id
from clinic_passes
order by issued_at desc
limit 5;
```
Expected:
- New row with `status='pending'`.

### 2.2 Approve pass (UI)
- Clinic → Pass Approvals → Approve

Verify (SQL):
```sql
select id, status
from clinic_passes
where id = '<PASS_ID>';
```
Expected:
- `status='approved'`.

### 2.3 Clinic check-in (UI)
- Clinic → QR Check-in → scan student QR

Verify (SQL):
```sql
select id, student_id, treated_by, status, visit_time, reason, notes
from clinic_visits
order by visit_time desc
limit 5;
```
Expected:
- New row with `status='checked_in'`.

Verify the pass is consumed:
```sql
select id, status, clinic_visit_id
from clinic_passes
where id = '<PASS_ID>';
```
Expected:
- `status='used'` and `clinic_visit_id` set.

### 2.4 Nurse findings (UI)
- Clinic → Nurse Findings → select patient → set decision → Save

Verify (SQL):
```sql
select id, status, notes
from clinic_visits
where id = '<VISIT_ID>';
```
Expected:
- `status='treated'` and `notes` contains `Decision: ...`.

### 2.5 Teacher notifies parent (UI)
- Teacher → Clinic → Approve Parent Notify

Verify (SQL):
```sql
select id, notes
from clinic_visits
where id = '<VISIT_ID>';
```
Expected:
- `notes` includes `Parent Notified`.

Verify parent notification:
```sql
select id, recipient_id, verb, object, read, created_at
from notifications
order by created_at desc
limit 10;
```

### 2.6 Clinic checkout (UI)
- Clinic → Checkout → Confirm Discharge

Verify (SQL):
```sql
select id, status
from clinic_visits
where id = '<VISIT_ID>';
```
Expected:
- `status='released'`.

## 3) Parent → Excuse Letter → Teacher Decision

### 3.1 Parent submits excuse letter (UI)
- Parent → Excuse Letters → submit for a specific absent_date

Verify (SQL):
```sql
select id, student_id, parent_id, absent_date, status, issued_at, remarks
from excuse_letters
order by issued_at desc
limit 10;
```
Expected:
- New row with `status='pending'`.

### 3.2 Teacher approves/rejects (UI)
- Teacher → Excuse Letters → approve or reject (requires comment on reject)

Verify (SQL):
```sql
select id, status, remarks
from excuse_letters
where id = '<LETTER_ID>';
```

### 3.3 If approved: attendance becomes excused (UI + DB)
Verify (SQL):
```sql
select id, student_id, status, timestamp, remarks
from attendance
where student_id = '<STUDENT_ID>'
and timestamp >= '<ABSENT_DATE>T00:00:00Z'
and timestamp <= '<ABSENT_DATE>T23:59:59Z'
order by timestamp desc;
```

Verify subject attendance:
```sql
select id, student_id, subject_code, date, status, remarks
from subject_attendance
where student_id = '<STUDENT_ID>'
and date = '<ABSENT_DATE>';
```

## 4) Expected Known Failure Points (If Not Addressed)
- RLS policies relying on `auth.uid()` while using localStorage auth.
- Missing canonical `subjects` rows for the grade/strand/semester (Class schedules dropdown will be empty).
- Multiple scanners writing inconsistent attendance fields (status/session/recorded_by).

