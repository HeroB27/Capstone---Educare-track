-- Phase 5 v1.0.0
-- Admin access + ensure RLS enabled consistently on core tables used by the web app.

-- =========================
-- RLS ENABLE (core tables)
-- =========================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_ids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homeroom_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subject_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tap_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.excuse_letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_calendar ENABLE ROW LEVEL SECURITY;

-- =========================
-- ADMIN POLICIES (broad, but role-gated)
-- =========================

DROP POLICY IF EXISTS "admin all profiles" ON public.profiles;
CREATE POLICY "admin all profiles" ON public.profiles FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin all classes" ON public.classes;
CREATE POLICY "admin all classes" ON public.classes FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin all class_schedules" ON public.class_schedules;
CREATE POLICY "admin all class_schedules" ON public.class_schedules FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin all subjects" ON public.subjects;
CREATE POLICY "admin all subjects" ON public.subjects FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin all students" ON public.students;
CREATE POLICY "admin all students" ON public.students FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin all student_ids" ON public.student_ids;
CREATE POLICY "admin all student_ids" ON public.student_ids FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin all homeroom_attendance" ON public.homeroom_attendance;
CREATE POLICY "admin all homeroom_attendance" ON public.homeroom_attendance FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin all subject_attendance" ON public.subject_attendance;
CREATE POLICY "admin all subject_attendance" ON public.subject_attendance FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin all tap_logs" ON public.tap_logs;
CREATE POLICY "admin all tap_logs" ON public.tap_logs FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin all clinic_passes" ON public.clinic_passes;
CREATE POLICY "admin all clinic_passes" ON public.clinic_passes FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin all clinic_visits" ON public.clinic_visits;
CREATE POLICY "admin all clinic_visits" ON public.clinic_visits FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin all notifications" ON public.notifications;
CREATE POLICY "admin all notifications" ON public.notifications FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin all announcements" ON public.announcements;
CREATE POLICY "admin all announcements" ON public.announcements FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin all excuse_letters" ON public.excuse_letters;
CREATE POLICY "admin all excuse_letters" ON public.excuse_letters FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin all attendance_rules" ON public.attendance_rules;
CREATE POLICY "admin all attendance_rules" ON public.attendance_rules FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin all system_settings" ON public.system_settings;
CREATE POLICY "admin all system_settings" ON public.system_settings FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin all password_reset_requests" ON public.password_reset_requests;
CREATE POLICY "admin all password_reset_requests" ON public.password_reset_requests FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin all school_calendar" ON public.school_calendar;
CREATE POLICY "admin all school_calendar" ON public.school_calendar FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

