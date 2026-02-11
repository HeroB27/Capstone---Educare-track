-- ============================================================================
-- GUARD ROLE GRANTS AND RLS POLICIES - Complete Fix
-- ============================================================================
-- Date: 2026-02-11
-- Purpose: Ensure guard role has proper Grants and RLS Policies for all queries
-- Reference: 
--   - supabase_migrations/2026-02-11_fix_table_grants_and_rls.sql
--   - supabase_migrations/2026-02-11_admin_rls_complete_fix.sql
-- ============================================================================
-- NOTE: Basic SELECT grants are already covered in previous migrations for:
--       students, notifications, tap_logs, homeroom_attendance
-- ============================================================================

-- ============================================================================
-- PART 1: ADDITIONAL GRANTS NEEDED (Not covered in previous 2026-02-11 files)
-- ============================================================================

-- Grant INSERT on tap_logs to authenticated (for recording taps)
GRANT INSERT ON tap_logs TO authenticated;

-- Grant UPDATE on students to authenticated (for updating current_status)
GRANT UPDATE ON students TO authenticated;

-- Grant INSERT, UPDATE on homeroom_attendance to authenticated (for tap in/out)
GRANT INSERT, UPDATE ON homeroom_attendance TO authenticated;

-- Grant INSERT on notifications to authenticated (already has SELECT)
GRANT INSERT ON notifications TO authenticated;

-- Grant SELECT on school_calendar to authenticated (for checking no-classes events)
GRANT SELECT ON school_calendar TO authenticated;

-- Grant SELECT on profiles to authenticated (for viewing guard profile)
GRANT SELECT ON profiles TO authenticated;


-- ============================================================================
-- PART 2: TAP_LOGS TABLE - Guard RLS Policies
-- ============================================================================

-- Guards can SELECT all tap logs (for dashboard statistics and alerts)
CREATE POLICY guard_select_tap_logs ON tap_logs
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'guard')
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Guards can INSERT tap logs (for recording new taps)
CREATE POLICY guard_insert_tap_logs ON tap_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'guard')
    );


-- ============================================================================
-- PART 3: STUDENTS TABLE - Guard RLS Policies
-- ============================================================================

-- Guards can SELECT all students (for lookup by QR code)
CREATE POLICY guard_select_students ON students
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'guard')
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Guards can UPDATE students (for updating current_status)
CREATE POLICY guard_update_students ON students
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'guard')
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'guard')
    );


-- ============================================================================
-- PART 4: HOMEROOM_ATTENDANCE TABLE - Guard RLS Policies
-- ============================================================================

-- Guards can SELECT homeroom_attendance (for viewing attendance records)
CREATE POLICY guard_select_homeroom_attendance ON homeroom_attendance
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'guard')
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Guards can INSERT homeroom_attendance (for recording tap-out without prior record)
CREATE POLICY guard_insert_homeroom_attendance ON homeroom_attendance
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'guard')
    );

-- Guards can UPDATE homeroom_attendance (for recording tap-out)
CREATE POLICY guard_update_homeroom_attendance ON homeroom_attendance
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'guard')
    );


-- ============================================================================
-- PART 5: NOTIFICATIONS TABLE - Guard RLS Policies
-- ============================================================================

-- Guards can SELECT notifications (for viewing their own notifications)
CREATE POLICY guard_select_notifications ON notifications
    FOR SELECT
    TO authenticated
    USING (
        recipient_id = auth.uid()
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Guards can INSERT notifications (for notifying parents of taps)
CREATE POLICY guard_insert_notifications ON notifications
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'guard')
    );


-- ============================================================================
-- PART 6: SCHOOL_CALENDAR TABLE - Guard RLS Policies
-- ============================================================================

-- Guards can SELECT school_calendar (for checking no-classes events)
CREATE POLICY guard_select_school_calendar ON school_calendar
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'guard')
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher')
    );


-- ============================================================================
-- PART 7: PROFILES TABLE - Guard RLS Policies
-- ============================================================================

-- Guards can SELECT their own profile (use direct auth.uid() to avoid recursion)
CREATE POLICY guard_select_own_profile ON profiles
    FOR SELECT
    TO authenticated
    USING (id = auth.uid());


-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check guard policies:
-- SELECT schemaname, tablename, policyname FROM pg_policies 
-- WHERE policyname LIKE '%guard%' ORDER BY tablename;

-- Check table grants:
-- SELECT * FROM information_schema.table_privileges 
-- WHERE grantee = 'authenticated' ORDER BY table_name;

-- Check if guard can access required tables:
-- SELECT tablename, 
--        CASE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE tablename = pg_tables.tablename AND policyname LIKE '%guard%') 
--             THEN 'YES' ELSE 'NO' END as has_guard_policy
-- FROM pg_tables WHERE schemaname = 'public' AND tablename IN (
--     'tap_logs', 'students', 'homeroom_attendance', 'notifications', 'school_calendar', 'profiles'
-- );
