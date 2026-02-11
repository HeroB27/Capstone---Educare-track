-- ============================================================================
-- FIX: Remove infinite recursion in students parent policy
-- ============================================================================
-- Date: 2026-02-11
-- Issue: Infinite recursion in students policy due to self-referential subquery
-- ============================================================================

-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS parents_select_students ON students;

-- Create the correct policy using direct column comparison
CREATE POLICY IF NOT EXISTS parents_select_students ON students
    FOR SELECT
    TO authenticated
    USING (parent_id = auth.uid());

-- Verify the fix
-- SELECT policyname, cmd, pg_get_policydef(oid) FROM pg_policy WHERE polname = 'parents_select_students';
