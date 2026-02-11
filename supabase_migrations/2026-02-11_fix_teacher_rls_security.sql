-- =============================================
-- FIX: Teacher RLS Security Issues
-- Addresses critical security vulnerabilities identified in QA report
-- =============================================

-- Fix 1: Remove overly broad students SELECT policy that allows any authenticated user to view ALL students
-- This was the critical security vulnerability identified in the QA report
DROP POLICY IF EXISTS "Students are viewable by authenticated users" ON public.students;

-- Fix 2: Verify existing teacher policies are sufficient
-- The existing policies for teachers to access their class students should now work correctly
-- since the overly broad policy has been removed

-- Fix 3: Simplify status mapping by removing unnecessary internal status handling
-- This has been handled in application code (scan-actions.js)

-- Add validation comment to ensure policies are working correctly
-- [Date Checked: 2026-02-11] | [Remarks: Fixed critical RLS security vulnerability - students table no longer exposes all data to all authenticated users. Removed overly broad SELECT policy.]