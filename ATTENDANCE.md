# How Attendance Works (Educare Track)

This system is designed to be simple, reliable, and demo-ready. It uses taps for homeroom attendance and teacher-driven marking for subject attendance, with clear overrides for clinic and excuse letters.

## 1) Tap-In / Tap-Out (Gatekeeping)
- A student is identified by scanning/typing their QR code.
- Every tap attempt is written to `tap_logs` (including duplicates/rejections/blocked days).
- Basic sanity rules:
  - No OUT without a prior IN for the same day.
  - No double IN without OUT.
- A successful tap updates:
  - `students.current_status` to `in` or `out`
  - `homeroom_attendance` for the day (first IN sets status, last OUT sets exit time)

Core logic: [scan-actions.js](file:///c:/Users/Lenovo/Desktop/OFFICIAL%20EDUCARE%20TRACK/core/scan-actions.js)

## 2) Late and Absent (Simple, Explainable)
### Late
- Configured in `system_settings`:
  - `school_start_time` (time, e.g. `07:30`)
  - `late_threshold_minutes` (number, e.g. `15`)
- Rule:
  - If tap-in happens after start time + threshold → `late`
  - Otherwise → `present`

### Absent
- Rule:
  - If a student has **no tap-in for the day** → `absent`
- For clean reports, admins can backfill missing homeroom rows using `backfill_homeroom_attendance(class_id, date)` (creates absent rows for students with no record).

## 3) Subject Attendance (Teacher-Driven)
- Teachers mark subject attendance per scheduled subject period.
- Default status is `present`.
- Teachers can change to:
  - `late`, `absent`, `excused_absent`
- Validation:
  - Teachers can only mark students they are assigned to teach (RLS-enforced).
  - Students are loaded from the schedule’s class roster (UI-level validation).

Teacher page: [teacher-subject-attendance.html](file:///c:/Users/Lenovo/Desktop/OFFICIAL%20EDUCARE%20TRACK/teacher/teacher-subject-attendance.html)

## 4) Clinic Integration
- If a student has an active clinic visit (`clinic_visits.status = in_clinic`):
  - UI displays “In Clinic”
  - Teacher cannot mark subject attendance for that student

## 5) Excuse Letters (Override)
- If an excuse letter is approved for the date (`excuse_letters.status = approved`):
  - Effective attendance becomes `excused_absent`
  - Teacher cannot override to another status
  - UI shows “Excused” and exposes the prior status as “Original”

## 6) No Classes Days (Holiday / Break / Suspension)
- If `school_calendar` has an event of type `holiday`, `break`, or `emergency` covering the date:
  - Attendance UIs show “No classes today” and disable marking
  - Tap attempts are blocked and logged

## 7) Data Consistency Rules
- One homeroom record per student per day.
- One subject record per student per subject per day.
- No orphan attendance should exist (attendance rows should match real students and valid schedules).

Phase 7 SQL migration (policies + indexes + backfill): [2026-02-04_phase7_attendance_enhancement.sql](file:///c:/Users/Lenovo/Desktop/OFFICIAL%20EDUCARE%20TRACK/supabase_migrations/2026-02-04_phase7_attendance_enhancement.sql)

