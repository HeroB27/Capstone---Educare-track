# EDUCARE TRACK - Admin Workflow Alignment Plan

I will align the Admin features with the canonical "deterministic logic" provided, focusing on event-driven architecture and rule-based attendance.

## 1. Database Schema Refinement
I will update the `Supabase tables.txt` and the live database with:
- **`attendance_rules` Table**: A dedicated table to store grade-level specific arrival times, grace periods, and late cutoffs (moving away from basic JSON settings).
- **`attendance_events` Table**: This will store every raw QR scan (IN/OUT) as a sacred record, ensuring that final attendance status is *derived* and not manually entered.
- **RLS Policy Implementation**: Add the authoritative Admin bypass logic: `exists (select 1 from profiles where id = auth.uid() and role = 'admin')`.

## 2. Admin System Configuration ([admin-settings.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/admin/admin-settings.js))
- **Dynamic Rule Management**: Update the settings page to allow admins to define the `attendance_rules` per grade level.
- **Authoritative Setup**: Ensure the "arrival time" and "grace periods" are stored in the new structured table for the attendance engine to use.

## 3. School Calendar Enhancements ([admin-calendar.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/admin/admin-calendar.js))
- **Suspension Handling**: Refine the calendar to explicitly handle "Suspensions" which will signal the attendance engine to skip deriving records for those days.
- **School Year Lifecycle**: Add fields to define the start and end dates of the academic year.

## 4. Attendance Flow Alignment
- **Event-First Scanning**: I will update the scanning logic (used by Guards) to write to the `attendance_events` table.
- **Derived Status Logic**: Ensure the dashboard analytics and teacher views pull from the `attendance` (derived) table, while preserving the raw event logs in `attendance_events`.

## 5. Verification
- Confirm that Admin role checks correctly bypass RLS.
- Verify that grade-level rules (e.g., Grade 11 STEM vs Grade 1) are correctly loaded.
- Ensure all attendance overrides by teachers are logged and immutable.

Shall I proceed with these system-level alignments?