ALTER TABLE public.classes RENAME COLUMN grade_level TO grade;
ALTER TABLE public.classes ALTER COLUMN grade TYPE text USING grade::text;
ALTER TABLE public.classes DROP COLUMN section;
ALTER TABLE public.classes RENAME COLUMN homeroom_teacher_id TO adviser_id;
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS strand text;
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS room text;
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS level text;
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS class_id text;
ALTER TABLE public.students ADD CONSTRAINT fk_students_class FOREIGN KEY (class_id) REFERENCES public.classes(id);
ALTER TABLE public.attendance_validations ADD CONSTRAINT chk_session CHECK (session IN ('AM','PM'));
ALTER TABLE public.attendance_validations ADD CONSTRAINT attendance_validations_unique UNIQUE (class_id, subject, session, attendance_date);
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS grade text;
UPDATE public.subjects SET grade = COALESCE(grade, 'General');
ALTER TABLE public.subjects ALTER COLUMN grade SET NOT NULL;
