# 🧪 EDUCARE TRACK – QA REPORT

Project: Educare Track (Supabase-based attendance system)
Date: 2026-02-02
Supabase project ref: tkwjxmhnroqprmjfoaua
Tester: Trae (AI Assistant)

## ✅ WORKING AS EXPECTED
- **Schema Structure**: All core tables (`students`, `classes`, `attendance`, `excuse_letters`, `clinic_visits`) are defined with correct relationships.
- **UI Logic**: Admin, Teacher, and Guard dashboards have implemented the required workflows (UI-side).
- **Analytics**: `analytics_engine.py` is present for batch processing of risk reports.
- **Notification Logic**: `notifications` table and UI polling logic are implemented.

## ⚠️ ROLE MISALIGNMENTS
- **Guard Role Overreach**: The Guard UI (`guard-dashboard.js`) writes directly to the `attendance` table (which is a derived/status table) instead of the raw `attendance_events` log.
- **Client-Side Business Logic**: The Guard client calculates "Late" vs "On Time" status. This logic should be strictly server-side (in the Attendance Engine) to prevent manipulation.

## ❌ BROKEN OR MISSING
- **CRITICAL: Auth & RLS Incompatibility**:
  - The Application uses `localStorage` for session management (custom/simulated auth).
  - The Database RLS policies rely on `auth.uid()` (Supabase Native Auth).
  - **Result**: All database requests will be blocked by RLS when enabled, as `auth.uid()` will be null for `localStorage` users.
- **Missing Attendance Engine**: There is no backend trigger or function to derive `attendance` records from `attendance_events`. The `attendance_events` table is currently **unused** by the application code.
- **No Raw Event Log**: Since `attendance_events` is unused, there is no immutable log of scans. If a Teacher overrides attendance, the original scan data is lost (overwritten in `attendance` table).

## 🔐 SECURITY RISKS
- **Bypass Vulnerability**: Due to the Auth/RLS mismatch, the application likely requires the `service_role` key or `anon` key with open policies to function, negating the security model.
- **Data Integrity**: Guards can effectively "decide" a student's status by manipulating the client-side time check before sending to the DB.

## 🧪 REQUIRED TEST CASES
- **TC-AUTH-01**: Attempt to fetch `students` using a `localStorage` "token" while RLS is enabled. (Expected: FAIL/Access Denied).
- **TC-FLOW-01**: Guard scan should insert into `attendance_events` only. (Currently FAILS - inserts into `attendance`).
- **TC-RLS-01**: Verify Admin cannot modify `attendance_events` (Immutable log).

## 🚫 CONSTRAINTS VIOLATED
- **"No step mutates raw scan events"**: Violation. The current system writes directly to the final status table, making "raw events" non-existent in the app flow.
- **"Assume Supabase Auth"**: Violation. App implements custom `localStorage` auth.
