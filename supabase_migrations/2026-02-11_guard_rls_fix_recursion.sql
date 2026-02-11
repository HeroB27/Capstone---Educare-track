-- ============================================================================
-- GUARD RLS RECURSION FIX
-- ============================================================================
-- Date: 2026-02-11
-- Purpose: Fix infinite recursion issue in guard profiles policy
-- Issue: The original guard_select_own_profile policy caused infinite recursion
--        by referencing the profiles table in its own USING clause
-- ============================================================================

-- Step 1: Drop the problematic profiles policy (if it exists)
DROP POLICY IF EXISTS guard_select_own_profile ON profiles;

-- Step 2: Drop other guard policies that may have been created
DROP POLICY IF EXISTS guard_select_tap_logs ON tap_logs;
DROP POLICY IF EXISTS guard_insert_tap_logs ON tap_logs;
DROP POLICY IF EXISTS guard_select_students ON students;
DROP POLICY IF EXISTS guard_update_students ON students;
DROP POLICY IF EXISTS guard_select_homeroom_attendance ON homeroom_attendance;
DROP POLICY IF EXISTS guard_insert_homeroom_attendance ON homeroom_attendance;
DROP POLICY IF EXISTS guard_update_homeroom_attendance ON homeroom_attendance;
DROP POLICY IF EXISTS guard_select_notifications ON notifications;
DROP POLICY IF EXISTS guard_insert_notifications ON notifications;
DROP POLICY IF EXISTS guard_select_school_calendar ON school_calendar;

-- ============================================================================
-- RECREATE GUARD POLICIES (Without Recursion)
-- ============================================================================

-- ============================================================================
-- PART 1: TAP_LOGS TABLE - Guard RLS Policies
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
-- PART 2: STUDENTS TABLE - Guard RLS Policies
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
-- PART 3: HOMEROOM_ATTENDANCE TABLE - Guard RLS Policies
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
-- PART 4: NOTIFICATIONS TABLE - Guard RLS Policies
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
-- PART 5: SCHOOL_CALENDAR TABLE - Guard RLS Policies
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
-- PART 6: PROFILES TABLE - Guard RLS Policies (FIXED - No Recursion)
-- ============================================================================

-- Guards can SELECT their own profile (use direct id = auth.uid() to avoid recursion)
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
