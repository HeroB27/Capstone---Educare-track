-- Fix Permissions - Run this in Supabase SQL Editor

-- Grant access to all tables for anon/service role
GRANT ALL ON TABLE public.profiles TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.user_passwords TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.teachers TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.guards TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.clinic_staff TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.parents TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.classes TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.subjects TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.class_schedules TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.students TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.attendance_rules TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.homeroom_attendance TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.subject_attendance TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.clinic_visits TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.clinic_passes TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.announcements TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.notifications TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.school_calendar TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.excuse_letters TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.password_reset_requests TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.student_ids TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.system_settings TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.tap_logs TO anon, authenticated, service_role;

-- Grant USAGE on sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- Grant EXECUTE on functions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

-- Verify
SELECT 'Permissions granted!' as status;
