-- Phase 3 (Teachers + Parents) v0.0.1
-- Incremental migration: RLS, helper functions, and required columns for excuse uploads and class-scoped announcements.

-- =========================
-- HELPERS
-- =========================

CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'teacher'
      AND p.is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_parent()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'parent'
      AND p.is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_guard()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'guard'
      AND p.is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_clinic()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'clinic'
      AND p.is_active = true
  );
$$;

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

CREATE OR REPLACE FUNCTION public.teacher_can_access_class(_class_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.classes c
    WHERE c.id = _class_id
      AND c.is_active = true
      AND (
        c.homeroom_teacher_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.class_schedules cs
          WHERE cs.class_id = c.id
            AND cs.teacher_id = auth.uid()
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.teacher_can_access_student(_student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.students s
    WHERE s.id = _student_id
      AND public.teacher_can_access_class(s.class_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.parent_can_access_student(_student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.students s
    WHERE s.id = _student_id
      AND s.parent_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.teacher_can_access_subject(_student_id uuid, _subject_code text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.students s
    WHERE s.id = _student_id
      AND EXISTS (
        SELECT 1
        FROM public.class_schedules cs
        WHERE cs.class_id = s.class_id
          AND cs.teacher_id = auth.uid()
          AND cs.subject_code = _subject_code
      )
  );
$$;

-- =========================
-- DATA SHAPE UPDATES
-- =========================

ALTER TABLE public.excuse_letters
  ADD COLUMN IF NOT EXISTS attachment_path text,
  ADD COLUMN IF NOT EXISTS attachment_name text,
  ADD COLUMN IF NOT EXISTS attachment_mime text;

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS class_id uuid REFERENCES public.classes(id);

CREATE UNIQUE INDEX IF NOT EXISTS homeroom_attendance_student_date_uniq
  ON public.homeroom_attendance (student_id, date);

CREATE UNIQUE INDEX IF NOT EXISTS subject_attendance_student_subject_date_uniq
  ON public.subject_attendance (student_id, subject_code, date);

CREATE INDEX IF NOT EXISTS announcements_class_created_at_idx
  ON public.announcements (class_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_recipient_created_at_idx
  ON public.notifications (recipient_id, created_at DESC);

-- =========================
-- RLS: CLASSES / STUDENTS
-- =========================

DROP POLICY IF EXISTS classes_teacher_select ON public.classes;
CREATE POLICY classes_teacher_select
ON public.classes
FOR SELECT
TO authenticated
USING (public.is_teacher() AND public.teacher_can_access_class(id));

DROP POLICY IF EXISTS students_teacher_select ON public.students;
CREATE POLICY students_teacher_select
ON public.students
FOR SELECT
TO authenticated
USING (public.is_teacher() AND public.teacher_can_access_student(id));

DROP POLICY IF EXISTS students_parent_select ON public.students;
CREATE POLICY students_parent_select
ON public.students
FOR SELECT
TO authenticated
USING (public.is_parent() AND parent_id = auth.uid());

-- =========================
-- RLS: ATTENDANCE / TAPS
-- =========================

DROP POLICY IF EXISTS homeroom_attendance_teacher_all ON public.homeroom_attendance;
CREATE POLICY homeroom_attendance_teacher_all
ON public.homeroom_attendance
FOR ALL
TO authenticated
USING (public.is_teacher() AND public.teacher_can_access_student(student_id))
WITH CHECK (public.is_teacher() AND public.teacher_can_access_student(student_id));

DROP POLICY IF EXISTS homeroom_attendance_parent_select ON public.homeroom_attendance;
CREATE POLICY homeroom_attendance_parent_select
ON public.homeroom_attendance
FOR SELECT
TO authenticated
USING (public.is_parent() AND public.parent_can_access_student(student_id));

DROP POLICY IF EXISTS subject_attendance_teacher_all ON public.subject_attendance;
CREATE POLICY subject_attendance_teacher_all
ON public.subject_attendance
FOR ALL
TO authenticated
USING (public.is_teacher() AND public.teacher_can_access_subject(student_id, subject_code))
WITH CHECK (public.is_teacher() AND public.teacher_can_access_subject(student_id, subject_code));

DROP POLICY IF EXISTS subject_attendance_parent_select ON public.subject_attendance;
CREATE POLICY subject_attendance_parent_select
ON public.subject_attendance
FOR SELECT
TO authenticated
USING (public.is_parent() AND public.parent_can_access_student(student_id));

DROP POLICY IF EXISTS tap_logs_guard_insert ON public.tap_logs;
CREATE POLICY tap_logs_guard_insert
ON public.tap_logs
FOR INSERT
TO authenticated
WITH CHECK (public.is_guard() AND gatekeeper_id = auth.uid());

DROP POLICY IF EXISTS tap_logs_teacher_select ON public.tap_logs;
CREATE POLICY tap_logs_teacher_select
ON public.tap_logs
FOR SELECT
TO authenticated
USING (public.is_teacher() AND public.teacher_can_access_student(student_id));

DROP POLICY IF EXISTS tap_logs_parent_select ON public.tap_logs;
CREATE POLICY tap_logs_parent_select
ON public.tap_logs
FOR SELECT
TO authenticated
USING (public.is_parent() AND public.parent_can_access_student(student_id));

-- =========================
-- RLS: EXCUSE LETTERS
-- =========================

DROP POLICY IF EXISTS excuse_letters_parent_select ON public.excuse_letters;
CREATE POLICY excuse_letters_parent_select
ON public.excuse_letters
FOR SELECT
TO authenticated
USING (public.is_parent() AND parent_id = auth.uid());

DROP POLICY IF EXISTS excuse_letters_parent_insert ON public.excuse_letters;
CREATE POLICY excuse_letters_parent_insert
ON public.excuse_letters
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_parent()
  AND parent_id = auth.uid()
  AND public.parent_can_access_student(student_id)
);

DROP POLICY IF EXISTS excuse_letters_teacher_select ON public.excuse_letters;
CREATE POLICY excuse_letters_teacher_select
ON public.excuse_letters
FOR SELECT
TO authenticated
USING (public.is_teacher() AND public.teacher_can_access_student(student_id));

DROP POLICY IF EXISTS excuse_letters_teacher_update ON public.excuse_letters;
CREATE POLICY excuse_letters_teacher_update
ON public.excuse_letters
FOR UPDATE
TO authenticated
USING (public.is_teacher() AND public.teacher_can_access_student(student_id))
WITH CHECK (public.is_teacher() AND public.teacher_can_access_student(student_id));

-- =========================
-- RLS: CLINIC
-- =========================

DROP POLICY IF EXISTS clinic_visits_clinic_all ON public.clinic_visits;
CREATE POLICY clinic_visits_clinic_all
ON public.clinic_visits
FOR ALL
TO authenticated
USING (public.is_clinic())
WITH CHECK (public.is_clinic());

DROP POLICY IF EXISTS clinic_passes_clinic_all ON public.clinic_passes;
CREATE POLICY clinic_passes_clinic_all
ON public.clinic_passes
FOR ALL
TO authenticated
USING (public.is_clinic())
WITH CHECK (public.is_clinic());

DROP POLICY IF EXISTS clinic_visits_teacher_select ON public.clinic_visits;
CREATE POLICY clinic_visits_teacher_select
ON public.clinic_visits
FOR SELECT
TO authenticated
USING (public.is_teacher() AND public.teacher_can_access_student(student_id));

DROP POLICY IF EXISTS clinic_passes_teacher_select ON public.clinic_passes;
CREATE POLICY clinic_passes_teacher_select
ON public.clinic_passes
FOR SELECT
TO authenticated
USING (public.is_teacher() AND public.teacher_can_access_student(student_id));

DROP POLICY IF EXISTS clinic_passes_teacher_insert ON public.clinic_passes;
CREATE POLICY clinic_passes_teacher_insert
ON public.clinic_passes
FOR INSERT
TO authenticated
WITH CHECK (public.is_teacher() AND issued_by = auth.uid() AND public.teacher_can_access_student(student_id));

DROP POLICY IF EXISTS clinic_passes_teacher_update ON public.clinic_passes;
CREATE POLICY clinic_passes_teacher_update
ON public.clinic_passes
FOR UPDATE
TO authenticated
USING (public.is_teacher() AND issued_by = auth.uid() AND public.teacher_can_access_student(student_id))
WITH CHECK (public.is_teacher() AND issued_by = auth.uid() AND public.teacher_can_access_student(student_id));

DROP POLICY IF EXISTS clinic_visits_parent_select ON public.clinic_visits;
CREATE POLICY clinic_visits_parent_select
ON public.clinic_visits
FOR SELECT
TO authenticated
USING (public.is_parent() AND public.parent_can_access_student(student_id));

DROP POLICY IF EXISTS clinic_passes_parent_select ON public.clinic_passes;
CREATE POLICY clinic_passes_parent_select
ON public.clinic_passes
FOR SELECT
TO authenticated
USING (public.is_parent() AND public.parent_can_access_student(student_id));

-- =========================
-- RLS: NOTIFICATIONS
-- =========================

DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
CREATE POLICY notifications_select_own
ON public.notifications
FOR SELECT
TO authenticated
USING (recipient_id = auth.uid());

DROP POLICY IF EXISTS notifications_insert_actor_self ON public.notifications;
CREATE POLICY notifications_insert_actor_self
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (actor_id = auth.uid());

DROP POLICY IF EXISTS notifications_update_read_own ON public.notifications;
CREATE POLICY notifications_update_read_own
ON public.notifications
FOR UPDATE
TO authenticated
USING (recipient_id = auth.uid())
WITH CHECK (recipient_id = auth.uid());

-- =========================
-- RLS: ANNOUNCEMENTS
-- =========================

DROP POLICY IF EXISTS announcements_teacher_insert ON public.announcements;
CREATE POLICY announcements_teacher_insert
ON public.announcements
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_teacher()
  AND created_by = auth.uid()
  AND public.teacher_can_access_class(class_id)
);

DROP POLICY IF EXISTS announcements_teacher_select_own ON public.announcements;
CREATE POLICY announcements_teacher_select_own
ON public.announcements
FOR SELECT
TO authenticated
USING (public.is_teacher() AND created_by = auth.uid());

DROP POLICY IF EXISTS announcements_teacher_delete_own ON public.announcements;
CREATE POLICY announcements_teacher_delete_own
ON public.announcements
FOR DELETE
TO authenticated
USING (public.is_teacher() AND created_by = auth.uid());

DROP POLICY IF EXISTS announcements_parent_select_by_class ON public.announcements;
CREATE POLICY announcements_parent_select_by_class
ON public.announcements
FOR SELECT
TO authenticated
USING (
  public.is_parent()
  AND audience_parents = true
  AND (
    class_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.students s
      WHERE s.parent_id = auth.uid()
        AND s.class_id = announcements.class_id
    )
  )
);

-- =========================
-- STORAGE: EXCUSE LETTER ATTACHMENTS
-- =========================

INSERT INTO storage.buckets (id, name, public)
VALUES ('excuse_letters', 'excuse_letters', false)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS storage_excuse_parent_insert ON storage.objects;
CREATE POLICY storage_excuse_parent_insert
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'excuse_letters'
  AND public.is_parent()
  AND split_part(name, '/', 1) = auth.uid()::text
  AND public.parent_can_access_student(split_part(name, '/', 2)::uuid)
);

DROP POLICY IF EXISTS storage_excuse_parent_select ON storage.objects;
CREATE POLICY storage_excuse_parent_select
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'excuse_letters'
  AND public.is_parent()
  AND split_part(name, '/', 1) = auth.uid()::text
);

DROP POLICY IF EXISTS storage_excuse_teacher_select ON storage.objects;
CREATE POLICY storage_excuse_teacher_select
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'excuse_letters'
  AND public.is_teacher()
  AND public.teacher_can_access_student(split_part(name, '/', 2)::uuid)
);

DROP POLICY IF EXISTS storage_excuse_admin_all ON storage.objects;
CREATE POLICY storage_excuse_admin_all
ON storage.objects
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());
