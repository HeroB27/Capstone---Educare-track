ALTER TABLE public.class_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS class_schedules_teacher_select ON public.class_schedules;
CREATE POLICY class_schedules_teacher_select
ON public.class_schedules
FOR SELECT
TO authenticated
USING (public.is_teacher() AND teacher_id = auth.uid());

DROP POLICY IF EXISTS subjects_read_authenticated ON public.subjects;
CREATE POLICY subjects_read_authenticated
ON public.subjects
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);
