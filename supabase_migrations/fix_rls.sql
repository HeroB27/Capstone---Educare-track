-- Fix RLS Policies - Run this in Supabase SQL Editor

-- 1. Drop all RLS policies
DROP POLICY IF EXISTS "Allow anonymous access" ON public.profiles;
DROP POLICY IF EXISTS "Allow authenticated access" ON public.profiles;
DROP POLICY IF EXISTS "Enable access for authenticated users only" ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.profiles;

-- Repeat for all tables
DROP POLICY IF EXISTS "Allow anonymous access" ON public.students;
DROP POLICY IF EXISTS "Allow authenticated access" ON public.students;
DROP POLICY IF EXISTS "Enable all operations" ON public.students;

DROP POLICY IF EXISTS "Allow anonymous access" ON public.user_passwords;
DROP POLICY IF EXISTS "Allow authenticated access" ON public.user_passwords;

DROP POLICY IF EXISTS "Allow anonymous access" ON public.notifications;
DROP POLICY IF EXISTS "Allow authenticated access" ON public.notifications;

-- 2. Disable RLS on all tables
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.students DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.homeroom_attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.subject_attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_visits DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_passes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_calendar DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.excuse_letters DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_ids DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_passwords DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tap_logs DISABLE ROW LEVEL SECURITY;

-- 3. Verify
SELECT 'RLS disabled' as status;
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
