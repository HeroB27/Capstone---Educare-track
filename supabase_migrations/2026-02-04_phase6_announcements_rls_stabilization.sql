ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS announcements_teacher_select_global ON public.announcements;
CREATE POLICY announcements_teacher_select_global
ON public.announcements
FOR SELECT
TO authenticated
USING (public.is_teacher() AND audience_teachers = true AND class_id IS NULL);

DROP POLICY IF EXISTS announcements_teacher_select_by_class ON public.announcements;
CREATE POLICY announcements_teacher_select_by_class
ON public.announcements
FOR SELECT
TO authenticated
USING (public.is_teacher() AND audience_teachers = true AND class_id IS NOT NULL AND public.teacher_can_access_class(class_id));

DROP POLICY IF EXISTS announcements_teacher_update_own ON public.announcements;
CREATE POLICY announcements_teacher_update_own
ON public.announcements
FOR UPDATE
TO authenticated
USING (public.is_teacher() AND created_by = auth.uid())
WITH CHECK (public.is_teacher() AND created_by = auth.uid() AND public.teacher_can_access_class(class_id));
