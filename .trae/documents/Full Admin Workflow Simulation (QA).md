## What I will simulate (end-to-end)

### A) Admin → Classes (Setup)
- Create a class (G11+strand) in Admin Classes.
- Assign adviser (updates `classes.adviser_id`).
- Add class schedules per semester (writes `class_schedules.subject_code`, `semester`).
- Verify via DB: `classes`, `subjects`, `class_schedules`.

### B) Teacher → Clinic Pass Flow
- Teacher issues clinic pass (`clinic_passes.status='pending'`).
- Clinic approves (`clinic_passes.status='approved'`).
- Clinic check-in (creates `clinic_visits.status='checked_in'`, marks pass `used`, updates student current_status).
- Clinic findings (updates `clinic_visits.status='treated'` and writes Decision into `clinic_visits.notes`).
- Teacher “approve notify parent” (appends `Parent Notified` in `clinic_visits.notes`, sends parent notification).
- Clinic checkout (updates `clinic_visits.status='released'`, updates student current_status).

### C) Parent → Excuse Letter → Teacher Approval
- Parent submits excuse letter with `absent_date`.
- Teacher approves/rejects and sets `excuse_letters.remarks`.
- If approved: verify student’s `attendance` and `subject_attendance` are updated to `excused` for that date.

## How I will verify each step
- UI checks (page-level) + exact DB assertions (expected row counts + expected field values).
- For each stage, I’ll provide 1–2 SQL snippets you can run in Supabase SQL Editor to confirm correctness.

## Known blockers I will validate first (before running the flow)
- RLS/Auth mismatch: many SQL policies rely on `auth.uid()` but the app uses localStorage login; if RLS is enabled, many writes may fail.
- Scanning/event architecture mismatch: code writes to `attendance` (not `attendance_events`), and scanners differ in fields they write.
- Parent dashboard notifications are unimplemented in the main parent dashboard ([parent-dashboard.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/parent/parent-dashboard.js#L156-L162)).
- Capstone duplicate scripts still contain older excuse-letter logic (e.g. [Capstone teacher-excuse.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/Capstone---Educare-track/js/teacher-excuse.js)).

## Deliverables after simulation
- A pass/fail checklist with evidence (UI action → DB state).
- A short list of any remaining runtime blockers with exact file/line references.
- Minimal patches to remove the blockers found during the simulation.