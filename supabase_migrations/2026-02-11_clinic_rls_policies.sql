-- ============================================================================
-- CLINIC, GUARD, TEACHER ROLE GRANTS AND RLS POLICIES
-- ============================================================================
-- Date: 2026-02-11
-- Purpose: Allow clinic, guard, and teacher staff to access clinic tables
-- Tables: clinic_passes, clinic_visits, students (for joins)
-- ============================================================================
-- OVERLAP CHECK: Parent policies for clinic_passes/visits already exist in:
--   - 2026-02-11_parent_rls_complete_fix.sql (parents_select_clinic_visits)
-- ============================================================================

-- ============================================================================
-- PART 1: TABLE-LEVEL GRANTS (PostgreSQL)
-- ============================================================================

-- Grant SELECT on profiles to authenticated (for role lookups)
GRANT SELECT ON profiles TO authenticated;

-- ============================================================================
-- PART 2: CLINIC_PASSES TABLE - RLS Policies for Clinic Role
-- ============================================================================

-- Enable RLS on clinic_passes if not already enabled
ALTER TABLE clinic_passes ENABLE ROW LEVEL SECURITY;

-- Clinic: SELECT all clinic_passes
CREATE POLICY clinic_select_clinic_passes ON clinic_passes
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'clinic')
    );

-- Clinic: INSERT new clinic_passes (for creating passes if needed)
CREATE POLICY clinic_insert_clinic_passes ON clinic_passes
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'clinic')
    );

-- Clinic: UPDATE clinic_passes (approve/reject passes)
CREATE POLICY clinic_update_clinic_passes ON clinic_passes
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'clinic')
    );

-- ============================================================================
-- PART 3: CLINIC_VISITS TABLE - RLS Policies for Clinic Role
-- ============================================================================

-- Enable RLS on clinic_visits if not already enabled
ALTER TABLE clinic_visits ENABLE ROW LEVEL SECURITY;

-- Clinic: SELECT all clinic_visits
CREATE POLICY clinic_select_clinic_visits ON clinic_visits
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'clinic')
    );

-- Clinic: INSERT new clinic_visits (create visit when approving pass)
CREATE POLICY clinic_insert_clinic_visits ON clinic_visits
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'clinic')
    );

-- Clinic: UPDATE clinic_visits (update status, notes, etc.)
CREATE POLICY clinic_update_clinic_visits ON clinic_visits
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'clinic')
    );

-- ============================================================================
-- PART 4: STUDENTS TABLE - RLS Policies for Clinic Role (for joins)
-- ============================================================================

-- Clinic: SELECT students (for displaying student info in passes/visits)
-- Note: Overlaps with existing policies, using for safety
CREATE POLICY clinic_select_students ON students
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'clinic')
    );

-- ============================================================================
-- PART 5: GUARD ROLE - SELECT Access to Clinic Tables
-- ============================================================================

-- Guard: SELECT clinic_passes (to see passes at gate)
-- Note: Guard policies for clinic tables may already exist in guard-specific migration
CREATE POLICY guard_select_clinic_passes ON clinic_passes
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'guard')
    );

-- Guard: SELECT clinic_visits (to see active visits)
CREATE POLICY guard_select_clinic_visits ON clinic_visits
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'guard')
    );

-- ============================================================================
-- PART 6: TEACHER ROLE - SELECT Access to Clinic Tables
-- ============================================================================

-- Teacher: SELECT clinic_passes (to see their issued passes)
CREATE POLICY teacher_select_clinic_passes ON clinic_passes
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher')
    );

-- Teacher: SELECT clinic_visits (to see visits for their students)
CREATE POLICY teacher_select_clinic_visits ON clinic_visits
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher')
    );

-- ============================================================================
-- PART 7: PARENT ROLE ALREADY COVERED
-- ============================================================================
-- NOTE: Parent policies for clinic_passes and clinic_visits already exist in:
--       2026-02-11_parent_rls_complete_fix.sql
--       - parents_select_clinic_visits
--       - parent_select_clinic_passes (added below for completeness)

-- Parent: SELECT clinic_passes (for their children)
-- Added here for completeness if not already covered
CREATE POLICY parent_select_clinic_passes ON clinic_passes
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM students
            WHERE students.parent_id = auth.uid()
            AND students.id = clinic_passes.student_id
        )
    );

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check all clinic-related policies:
-- SELECT schemaname, tablename, policyname, roles FROM pg_policies
-- WHERE policyname LIKE 'clinic_%' OR policyname LIKE 'guard_%'
-- OR policyname LIKE 'teacher_%' OR policyname LIKE 'parent_%'
-- ORDER BY tablename, policyname;

-- Check for duplicate policies:
-- SELECT tablename, policyname, cmd FROM pg_policies
-- WHERE policyname LIKE 'clinic_%' OR policyname LIKE 'guard_%'
-- OR policyname LIKE 'teacher_%' OR policyname LIKE 'parent_select_clinic%'
-- ORDER BY tablename, policyname;

-- Check current user role:
-- SELECT id, role FROM profiles WHERE id = auth.uid();
