-- =============================================
-- FIX: Analytics Security
-- Restrict analytics views to admin only
-- =============================================

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS public.get_secure_attendance_trend CASCADE;
DROP FUNCTION IF EXISTS public.get_secure_class_performance CASCADE;
DROP FUNCTION IF EXISTS public.get_secure_critical_absences CASCADE;
DROP FUNCTION IF EXISTS public.get_secure_frequent_late_students CASCADE;
DROP FUNCTION IF EXISTS public.get_secure_clinic_visit_analytics CASCADE;

-- Create secure functions that check admin access before returning data
CREATE OR REPLACE FUNCTION public.get_secure_attendance_trend()
RETURNS SETOF public.attendance_trend_7day
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT * FROM public.attendance_trend_7day
    WHERE public.is_admin();
$$;

CREATE OR REPLACE FUNCTION public.get_secure_class_performance()
RETURNS SETOF public.class_performance_analytics
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT * FROM public.class_performance_analytics
    WHERE public.is_admin();
$$;

CREATE OR REPLACE FUNCTION public.get_secure_critical_absences()
RETURNS SETOF public.critical_absences
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT * FROM public.critical_absences
    WHERE public.is_admin();
$$;

CREATE OR REPLACE FUNCTION public.get_secure_frequent_late_students()
RETURNS SETOF public.frequent_late_students
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT * FROM public.frequent_late_students
    WHERE public.is_admin();
$$;

CREATE OR REPLACE FUNCTION public.get_secure_clinic_visit_analytics()
RETURNS SETOF public.clinic_visit_analytics
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT * FROM public.clinic_visit_analytics
    WHERE public.is_admin();
$$;

-- Comment on functions
COMMENT ON FUNCTION public.get_secure_attendance_trend() IS 'Admin only - secure access to attendance trend analytics';
COMMENT ON FUNCTION public.get_secure_class_performance() IS 'Admin only - secure access to class performance analytics';
COMMENT ON FUNCTION public.get_secure_critical_absences() IS 'Admin only - secure access to critical absences analytics';
COMMENT ON FUNCTION public.get_secure_frequent_late_students() IS 'Admin only - secure access to frequent late students analytics';
COMMENT ON FUNCTION public.get_secure_clinic_visit_analytics() IS 'Admin only - secure access to clinic visit analytics';
