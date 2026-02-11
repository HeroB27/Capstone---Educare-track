-- ============================================================================
-- PARENT ROLE GRANTS AND RLS POLICIES - Complete Fix
-- ============================================================================
-- Date: 2026-02-11
-- Purpose: Ensure parent role has proper Grants and RLS Policies for all queries
-- Reference: 
--   - supabase_migrations/2026-02-11_fix_table_grants_and_rls.sql
--   - supabase_migrations/2026-02-11_admin_rls_complete_fix.sql
-- ============================================================================
-- NOTE: Table-level grants are already covered in previous migrations for:
--       students, notifications, classes, homeroom_attendance, announcements,
--       scanners, student_ids, tap_logs, clinic_passes, clinic_visits, 
--       excuse_letters, subject_attendance
-- ============================================================================

-- ============================================================================
-- PART 1: ADDITIONAL GRANTS NEEDED (Not covered in previous 2026-02-11 files)
-- ============================================================================

-- Grant INSERT on notifications to authenticated (already has SELECT)
GRANT INSERT ON notifications TO authenticated;

-- Grant SELECT, INSERT on excuse_letters to authenticated (already has SELECT)
GRANT INSERT ON excuse_letters TO authenticated;

-- Grant SELECT on profiles to authenticated (for viewing teacher details)
GRANT SELECT ON profiles TO authenticated;


-- ============================================================================
-- PART 2: STUDENTS TABLE - Parent RLS Policies
-- ============================================================================

-- Parents can SELECT their linked students
-- (Note: students table already has grants from 2026-02-11_fix_table_grants_and_rls.sql)
-- IMPORTANT: Use direct column comparison to avoid infinite recursion
CREATE POLICY IF NOT EXISTS parents_select_students ON students
    FOR SELECT
    TO authenticated
    USING (parent_id = auth.uid());


-- ============================================================================
-- PART 3: NOTIFICATIONS TABLE - Parent RLS Policies
-- ============================================================================

-- Parents can SELECT their own notifications
-- (Note: notifications_select_own already exists from 2026-02-11_fix_table_grants_and_rls.sql)
-- Adding parent-specific comment for documentation

-- Parents can INSERT notifications for themselves (to notify teachers)
-- (Note: notifications_insert_own already exists from 2026-02-11_fix_table_grants_and_rls.sql)
-- The existing policy covers all authenticated users including parents


-- ============================================================================
-- PART 4: EXCUSE_LETTERS TABLE - Parent RLS Policies
-- ============================================================================

-- Parents can SELECT their own excuse letters
CREATE POLICY parents_select_excuse_letters ON excuse_letters
    FOR SELECT
    TO authenticated
    USING (parent_id = auth.uid());

-- Parents can INSERT excuse letters for their children
CREATE POLICY parents_insert_excuse_letters ON excuse_letters
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM students s
            WHERE s.id = excuse_letters.student_id AND s.parent_id = auth.uid()
        )
    );


-- ============================================================================
-- PART 5: CLINIC_VISITS TABLE - Parent RLS Policies
-- ============================================================================

-- Parents can SELECT clinic visits for their children
-- (Note: clinic_visits already has grants from 2026-02-11_admin_rls_complete_fix.sql)
CREATE POLICY parents_select_clinic_visits ON clinic_visits
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM students s
            WHERE s.id = clinic_visits.student_id AND s.parent_id = auth.uid()
        )
    );


-- ============================================================================
-- PART 6: TAP_LOGS TABLE - Parent RLS Policies
-- ============================================================================

-- Parents can SELECT tap logs for their children
-- (Note: tap_logs already has grants from 2026-02-11_admin_rls_complete_fix.sql)
CREATE POLICY parents_select_tap_logs ON tap_logs
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM students s
            WHERE s.id = tap_logs.student_id AND s.parent_id = auth.uid()
        )
    );


-- ============================================================================
-- PART 7: HOMEROOM_ATTENDANCE TABLE - Parent RLS Policies
-- ============================================================================

-- Parents can SELECT homeroom attendance for their children
-- (Note: homeroom_attendance already has grants from 2026-02-11_admin_rls_complete_fix.sql)
CREATE POLICY parents_select_homeroom_attendance ON homeroom_attendance
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM students s
            WHERE s.id = homeroom_attendance.student_id AND s.parent_id = auth.uid()
        )
    );


-- ============================================================================
-- PART 8: CLASSES TABLE - Parent RLS Policies
-- ============================================================================

-- Parents can SELECT classes their children belong to
-- (Note: classes already has grants from 2026-02-11_admin_rls_complete_fix.sql)
CREATE POLICY parents_select_classes ON classes
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM students s
            WHERE s.class_id = classes.id AND s.parent_id = auth.uid()
        )
    );


-- ============================================================================
-- PART 9: PROFILES TABLE - Parent RLS Policies
-- ============================================================================

-- Parents can SELECT profiles (for viewing teacher details)
-- (Note: profiles already has grants from core RLS, this is explicit)
CREATE POLICY parents_select_profiles ON profiles
    FOR SELECT
    TO authenticated
    USING (auth.uid() IS NOT NULL);


-- ============================================================================
-- PART 10: SUBJECT_ATTENDANCE TABLE - Parent RLS Policies
-- ============================================================================

-- Parents can SELECT subject attendance for their children
-- (Note: subject_attendance already has grants from 2026-02-11_admin_rls_complete_fix.sql)
CREATE POLICY parents_select_subject_attendance ON subject_attendance
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM students s
            WHERE s.id = subject_attendance.student_id AND s.parent_id = auth.uid()
        )
    );


-- ============================================================================
-- PART 11: ANNOUNCEMENTS TABLE - Parent RLS Policies
-- ============================================================================

-- Parents can SELECT announcements targeted to parents
-- (Note: Already covered by existing "Announcements are viewable based on audience" policy
--  from SchemaCurrentInformation/policies,triggers,etc.txt - no additional policy needed)


-- ============================================================================
-- PART 12: SCANNERS TABLE - Parent RLS Policies
-- ============================================================================

-- Parents can SELECT scanners (for viewing gate activity context)
-- (Note: scanners already has grants from 2026-02-11_admin_rls_complete_fix.sql)
CREATE POLICY parents_select_scanners ON scanners
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM students s WHERE s.parent_id = auth.uid()
        )
    );


-- ============================================================================
-- PART 13: STUDENT_IDS TABLE - Parent RLS Policies
-- ============================================================================

-- Parents can SELECT student IDs for their children
-- (Note: student_ids already has grants from 2026-02-11_admin_rls_complete_fix.sql)
CREATE POLICY parents_select_student_ids ON student_ids
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM students s
            WHERE s.id = student_ids.student_id AND s.parent_id = auth.uid()
        )
    );


-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check parent policies:
-- SELECT schemaname, tablename, policyname FROM pg_policies 
-- WHERE policyname LIKE '%parents%' OR policyname LIKE '%parent%' 
-- ORDER BY tablename;

-- Check table grants:
-- SELECT * FROM information_schema.table_privileges 
-- WHERE grantee = 'authenticated' ORDER BY table_name;

-- Check for duplicate policies:
-- SELECT tablename, policyname, cmd FROM pg_policies 
-- WHERE policyname LIKE '%parent%' ORDER BY tablename;
