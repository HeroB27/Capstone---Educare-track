-- Phase 4 (Guard + Clinic) v0.0.1
-- Incremental migration: minimal RLS/policies to support guard/clinic scanning + teacher gatekeeper scanning.

-- =========================
-- HELPERS
-- =========================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_teacher_gatekeeper()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.system_settings s
    WHERE s.key = 'teacher_gatekeepers'
      AND (s.value->'teacher_ids') ? auth.uid()::text
  );
$$;

-- =========================
-- RLS ENABLE
-- =========================

ALTER TABLE IF EXISTS public.attendance_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.student_ids ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.homeroom_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tap_logs ENABLE ROW LEVEL SECURITY;

-- =========================
-- ATTENDANCE RULES (READ)
-- =========================

DROP POLICY IF EXISTS "attendance_rules read authenticated" ON public.attendance_rules;
CREATE POLICY "attendance_rules read authenticated"
ON public.attendance_rules
FOR SELECT
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "attendance_rules admin write" ON public.attendance_rules;
CREATE POLICY "attendance_rules admin write"
ON public.attendance_rules
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- =========================
-- STUDENT IDS (SCAN LOOKUP)
-- =========================

DROP POLICY IF EXISTS "student_ids scan read staff" ON public.student_ids;
DROP POLICY IF EXISTS "student_ids scan read guard clinic admin" ON public.student_ids;
DROP POLICY IF EXISTS "student_ids scan read teacher gatekeeper" ON public.student_ids;

CREATE POLICY "student_ids scan read guard clinic admin"
ON public.student_ids
FOR SELECT
USING (public.is_admin() OR public.is_guard() OR public.is_clinic());

CREATE POLICY "student_ids scan read teacher gatekeeper"
ON public.student_ids
FOR SELECT
USING (public.is_teacher() AND public.is_teacher_gatekeeper() AND public.teacher_can_access_student(student_id));

DROP POLICY IF EXISTS "student_ids admin write" ON public.student_ids;
CREATE POLICY "student_ids admin write"
ON public.student_ids
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- =========================
-- SYSTEM SETTINGS (TEACHER GATEKEEPERS)
-- =========================

DROP POLICY IF EXISTS "system_settings read teacher_gatekeepers" ON public.system_settings;
CREATE POLICY "system_settings read teacher_gatekeepers"
ON public.system_settings
FOR SELECT
USING (auth.uid() IS NOT NULL AND key = 'teacher_gatekeepers');

DROP POLICY IF EXISTS "system_settings admin write" ON public.system_settings;
CREATE POLICY "system_settings admin write"
ON public.system_settings
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- =========================
-- STUDENTS (CURRENT STATUS UPDATE)
-- =========================

DROP POLICY IF EXISTS "students update current_status by guard" ON public.students;
CREATE POLICY "students update current_status by guard"
ON public.students
FOR UPDATE
USING (public.is_guard())
WITH CHECK (public.is_guard());

DROP POLICY IF EXISTS "students update current_status by teacher" ON public.students;
CREATE POLICY "students update current_status by teacher"
ON public.students
FOR UPDATE
USING (public.is_teacher() AND public.teacher_can_access_student(id))
WITH CHECK (public.is_teacher() AND public.teacher_can_access_student(id));

-- =========================
-- HOMEROOM ATTENDANCE (GUARD WRITE)
-- =========================

DROP POLICY IF EXISTS "homeroom_attendance insert by guard" ON public.homeroom_attendance;
CREATE POLICY "homeroom_attendance insert by guard"
ON public.homeroom_attendance
FOR INSERT
WITH CHECK (public.is_guard());

DROP POLICY IF EXISTS "homeroom_attendance update by guard" ON public.homeroom_attendance;
CREATE POLICY "homeroom_attendance update by guard"
ON public.homeroom_attendance
FOR UPDATE
USING (public.is_guard())
WITH CHECK (public.is_guard());

-- =========================
-- TAP LOGS (TEACHER GATEKEEPER INSERT)
-- =========================

DROP POLICY IF EXISTS "tap_logs insert by teacher gatekeeper" ON public.tap_logs;
CREATE POLICY "tap_logs insert by teacher gatekeeper"
ON public.tap_logs
FOR INSERT
WITH CHECK (
  public.is_teacher()
  AND gatekeeper_id = auth.uid()
  AND public.teacher_can_access_student(student_id)
);
