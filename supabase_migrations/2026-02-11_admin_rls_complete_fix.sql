-- ============================================================================
-- ADMIN RLS ADDITIONAL FIX - Additional Tables for 403 Forbidden Errors
-- ============================================================================
-- Date: 2026-02-11
-- Issue: Error 42501 (permission denied) for additional admin dashboard tables
-- Tables: classes, homeroom_attendance, announcements, scanners, 
--         student_ids, tap_logs, clinic_passes, clinic_visits, 
--         excuse_letters, subject_attendance
-- Note: students and notifications are already fixed in 2026-02-11_fix_table_grants_and_rls.sql
-- ============================================================================

-- ============================================================================
-- PART 1: TABLE-LEVEL GRANTS (PostgreSQL) - Additional Tables
-- ============================================================================

GRANT SELECT ON classes TO authenticated;
GRANT SELECT ON homeroom_attendance TO authenticated;
GRANT SELECT ON announcements TO authenticated;
GRANT SELECT ON scanners TO authenticated;
GRANT SELECT ON student_ids TO authenticated;
GRANT SELECT ON tap_logs TO authenticated;
GRANT SELECT ON clinic_passes TO authenticated;
GRANT SELECT ON clinic_visits TO authenticated;
GRANT SELECT ON excuse_letters TO authenticated;
GRANT SELECT ON subject_attendance TO authenticated;


-- ============================================================================
-- PART 2: CLASSES TABLE - Admin RLS Policies
-- ============================================================================

-- Admin: SELECT all classes
CREATE POLICY admin_select_classes ON classes
    FOR SELECT TO authenticated
    USING ( EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    ));

-- Admin: INSERT new classes
CREATE POLICY admin_insert_classes ON classes
    FOR INSERT TO authenticated
    WITH CHECK ( EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    ));

-- Admin: UPDATE classes
CREATE POLICY admin_update_classes ON classes
    FOR UPDATE TO authenticated
    USING ( EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    ));

-- Admin: DELETE classes
CREATE POLICY admin_delete_classes ON classes
    FOR DELETE TO authenticated
    USING ( EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    ));


-- ============================================================================
-- PART 3: HOMEROOM_ATTENDANCE TABLE - Admin RLS Policies
-- ============================================================================

-- Admin: SELECT all homeroom_attendance records
CREATE POLICY admin_select_homeroom_attendance ON homeroom_attendance
    FOR SELECT TO authenticated
    USING ( EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    ));

-- Admin: INSERT homeroom_attendance records
CREATE POLICY admin_insert_homeroom_attendance ON homeroom_attendance
    FOR INSERT TO authenticated
    WITH CHECK ( EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    ));

-- Admin: UPDATE homeroom_attendance
CREATE POLICY admin_update_homeroom_attendance ON homeroom_attendance
    FOR UPDATE TO authenticated
    USING ( EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    ));

-- Admin: DELETE homeroom_attendance records
CREATE POLICY admin_delete_homeroom_attendance ON homeroom_attendance
    FOR DELETE TO authenticated
    USING ( EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    ));


-- ============================================================================
-- PART 4: ANNOUNCEMENTS TABLE - Admin RLS Policies
-- ============================================================================

-- Admin: ALL operations on announcements
CREATE POLICY admin_all_announcements ON announcements
    FOR ALL TO authenticated
    USING ( EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    ));


-- ============================================================================
-- PART 5: SCANNERS TABLE - Admin RLS Policies
-- ============================================================================

-- Admin: SELECT scanners
CREATE POLICY admin_select_scanners ON scanners
    FOR SELECT TO authenticated
    USING ( EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    ));


-- ============================================================================
-- PART 6: STUDENT_IDS TABLE - Admin RLS Policies
-- ============================================================================

-- Admin: SELECT student_ids
CREATE POLICY admin_select_student_ids ON student_ids
    FOR SELECT TO authenticated
    USING ( EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    ));


-- ============================================================================
-- PART 7: TAP_LOGS TABLE - Admin RLS Policies
-- ============================================================================

-- Admin: SELECT tap_logs
CREATE POLICY admin_select_tap_logs ON tap_logs
    FOR SELECT TO authenticated
    USING ( EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    ));


-- ============================================================================
-- PART 8: CLINIC_PASSES TABLE - Admin RLS Policies
-- ============================================================================

-- Admin: SELECT clinic_passes
CREATE POLICY admin_select_clinic_passes ON clinic_passes
    FOR SELECT TO authenticated
    USING ( EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    ));

-- Admin: INSERT clinic_passes
CREATE POLICY admin_insert_clinic_passes ON clinic_passes
    FOR INSERT TO authenticated
    WITH CHECK ( EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    ));

-- Admin: UPDATE clinic_passes
CREATE POLICY admin_update_clinic_passes ON clinic_passes
    FOR UPDATE TO authenticated
    USING ( EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    ));

-- Admin: DELETE clinic_passes
CREATE POLICY admin_delete_clinic_passes ON clinic_passes
    FOR DELETE TO authenticated
    USING ( EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    ));


-- ============================================================================
-- PART 9: CLINIC_VISITS TABLE - Admin RLS Policies
-- ============================================================================

-- Admin: SELECT clinic_visits
CREATE POLICY admin_select_clinic_visits ON clinic_visits
    FOR SELECT TO authenticated
    USING ( EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    ));

-- Admin: UPDATE clinic_visits
CREATE POLICY admin_update_clinic_visits ON clinic_visits
    FOR UPDATE TO authenticated
    USING ( EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    ));


-- ============================================================================
-- PART 10: EXCUSE_LETTERS TABLE - Admin RLS Policies
-- ============================================================================

-- Admin: SELECT excuse_letters
CREATE POLICY admin_select_excuse_letters ON excuse_letters
    FOR SELECT TO authenticated
    USING ( EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    ));

-- Admin: UPDATE excuse_letters
CREATE POLICY admin_update_excuse_letters ON excuse_letters
    FOR UPDATE TO authenticated
    USING ( EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    ));


-- ============================================================================
-- PART 11: SUBJECT_ATTENDANCE TABLE - Admin RLS Policies
-- ============================================================================

-- Admin: SELECT subject_attendance
CREATE POLICY admin_select_subject_attendance ON subject_attendance
    FOR SELECT TO authenticated
    USING ( EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    ));

-- Admin: INSERT subject_attendance
CREATE POLICY admin_insert_subject_attendance ON subject_attendance
    FOR INSERT TO authenticated
    WITH CHECK ( EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    ));

-- Admin: UPDATE subject_attendance
CREATE POLICY admin_update_subject_attendance ON subject_attendance
    FOR UPDATE TO authenticated
    USING ( EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    ));


-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check admin policies:
-- SELECT schemaname, tablename, policyname FROM pg_policies 
-- WHERE policyname LIKE 'admin_%' ORDER BY tablename;

-- Check table grants:
-- SELECT * FROM information_schema.table_privileges 
-- WHERE grantee = 'authenticated' ORDER BY table_name;
