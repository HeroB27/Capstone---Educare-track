ALTER TABLE IF EXISTS public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.school_calendar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "system_settings read attendance" ON public.system_settings;
CREATE POLICY "system_settings read attendance"
ON public.system_settings
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND key IN ('school_start_time', 'late_threshold_minutes', 'gate_rules', 'teacher_gatekeepers')
);

DROP POLICY IF EXISTS "school_calendar read authenticated" ON public.school_calendar;
CREATE POLICY "school_calendar read authenticated"
ON public.school_calendar
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

INSERT INTO public.system_settings (key, value)
VALUES
  ('school_start_time', jsonb_build_object('value', '07:30')),
  ('late_threshold_minutes', jsonb_build_object('value', 15))
ON CONFLICT (key) DO NOTHING;

CREATE INDEX IF NOT EXISTS tap_logs_student_timestamp_idx
  ON public.tap_logs (student_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS clinic_visits_student_status_idx
  ON public.clinic_visits (student_id, status);

CREATE INDEX IF NOT EXISTS excuse_letters_student_date_status_idx
  ON public.excuse_letters (student_id, absent_date, status);

DROP POLICY IF EXISTS homeroom_attendance_teacher_all ON public.homeroom_attendance;
CREATE POLICY homeroom_attendance_teacher_all
ON public.homeroom_attendance
FOR ALL
TO authenticated
USING (public.is_teacher() AND public.teacher_can_access_student(student_id))
WITH CHECK (
  public.is_teacher()
  AND public.teacher_can_access_student(student_id)
  AND NOT EXISTS (
    SELECT 1
    FROM public.clinic_visits cv
    WHERE cv.student_id = homeroom_attendance.student_id
      AND cv.status = 'in_clinic'
  )
  AND (
    NOT EXISTS (
      SELECT 1
      FROM public.excuse_letters el
      WHERE el.student_id = homeroom_attendance.student_id
        AND el.absent_date = homeroom_attendance.date
        AND el.status = 'approved'
    )
    OR homeroom_attendance.status = 'excused_absent'
  )
);

DROP POLICY IF EXISTS subject_attendance_teacher_all ON public.subject_attendance;
CREATE POLICY subject_attendance_teacher_all
ON public.subject_attendance
FOR ALL
TO authenticated
USING (public.is_teacher() AND public.teacher_can_access_subject(student_id, subject_code))
WITH CHECK (
  public.is_teacher()
  AND public.teacher_can_access_subject(student_id, subject_code)
  AND NOT EXISTS (
    SELECT 1
    FROM public.clinic_visits cv
    WHERE cv.student_id = subject_attendance.student_id
      AND cv.status = 'in_clinic'
  )
  AND (
    NOT EXISTS (
      SELECT 1
      FROM public.excuse_letters el
      WHERE el.student_id = subject_attendance.student_id
        AND el.absent_date = subject_attendance.date
        AND el.status = 'approved'
    )
    OR subject_attendance.status = 'excused_absent'
  )
);

CREATE OR REPLACE FUNCTION public.backfill_homeroom_attendance(_class_id uuid, _date date)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  inserted_count integer := 0;
BEGIN
  INSERT INTO public.homeroom_attendance (student_id, class_id, date, status, remarks)
  SELECT s.id, s.class_id, _date, 'absent', 'Auto: no tap-in recorded'
  FROM public.students s
  WHERE s.class_id = _class_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.homeroom_attendance ha
      WHERE ha.student_id = s.id
        AND ha.date = _date
    )
  ON CONFLICT (student_id, date) DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

UPDATE public.homeroom_attendance ha
SET class_id = s.class_id
FROM public.students s
WHERE ha.student_id = s.id
  AND ha.class_id IS NULL;

