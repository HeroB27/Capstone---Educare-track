-- Fix: Add table-level GRANTS and RLS policies for students and notifications
-- Created: 2026-02-11
-- Issue: 42501 permission denied even with RLS disabled

-- ============================================
-- PART 1: Table-level GRANTS (PostgreSQL level)
-- ============================================

-- Grant SELECT on students table to authenticated role
GRANT SELECT ON students TO authenticated;

-- Grant SELECT on notifications table to authenticated role
GRANT SELECT ON notifications TO authenticated;

-- ============================================
-- PART 2: RLS Policies for students table (admin access)
-- ============================================

-- Admin can SELECT all students
CREATE POLICY "admin_select_students" ON students
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Admin can INSERT new students
CREATE POLICY "admin_insert_students" ON students
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Admin can UPDATE students
CREATE POLICY "admin_update_students" ON students
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Admin can DELETE students
CREATE POLICY "admin_delete_students" ON students
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- ============================================
-- PART 3: RLS Policies for notifications table
-- ============================================

-- Users can SELECT their own notifications
CREATE POLICY "notifications_select_own" ON notifications
    FOR SELECT
    TO authenticated
    USING (recipient_id = auth.uid());

-- Users can INSERT notifications for themselves
CREATE POLICY "notifications_insert_own" ON notifications
    FOR INSERT
    TO authenticated
    WITH CHECK (recipient_id = auth.uid());

-- Admin can SELECT all notifications
CREATE POLICY "admin_select_notifications" ON notifications
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Admin can DELETE any notification
CREATE POLICY "admin_delete_notifications" ON notifications
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- ============================================
-- Verification Query (run in SQL Editor)
-- ============================================
-- SELECT * FROM information_schema.table_privileges WHERE table_name IN ('students', 'notifications');
-- SELECT * FROM pg_policies WHERE tablename IN ('students', 'notifications');
