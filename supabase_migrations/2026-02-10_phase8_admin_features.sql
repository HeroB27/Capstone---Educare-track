-- PHASE 8: Admin Features Implementation
-- Created: 2026-02-10
-- Description: Adds tables for grade time rules, password requests, and teacher gatekeeper flag

-- 1. Create grade_time_rules table
CREATE TABLE IF NOT EXISTS public.grade_time_rules (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    grade_level text NOT NULL,
    start_time time NOT NULL,
    break_time time NOT NULL,
    end_time time NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(grade_level)
);

COMMENT ON TABLE public.grade_time_rules IS 'Stores grade-level specific time rules for tap in/out';
COMMENT ON COLUMN public.grade_time_rules.grade_level IS 'Grade level (e.g., Grade 1, Grade 2, etc.)';
COMMENT ON COLUMN public.grade_time_rules.start_time IS 'School start time for this grade';
COMMENT ON COLUMN public.grade_time_rules.break_time IS 'Break/lunch time for this grade';
COMMENT ON COLUMN public.grade_time_rules.end_time IS 'School end time for this grade';

-- 2. Create password_reset_requests table (matches existing code)
CREATE TABLE IF NOT EXISTS public.password_reset_requests (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    requested_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    note text,
    status text DEFAULT 'pending',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.password_reset_requests IS 'Stores password reset requests from users';
COMMENT ON COLUMN public.password_reset_requests.requested_user_id IS 'User who requested password reset';
COMMENT ON COLUMN public.password_reset_requests.note IS 'Optional note about the request';
COMMENT ON COLUMN public.password_reset_requests.status IS 'Request status';
COMMENT ON COLUMN public.password_reset_requests.updated_at IS 'When the request was last updated';

-- 3. Add is_gatekeeper column to teachers table
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS is_gatekeeper boolean DEFAULT false;

COMMENT ON COLUMN public.teachers.is_gatekeeper IS 'Flag indicating if teacher can act as gatekeeper';

-- 4. Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- 5. Create triggers for updated_at
DROP TRIGGER IF EXISTS trg_grade_time_rules_updated_at ON public.grade_time_rules;
CREATE TRIGGER trg_grade_time_rules_updated_at
    BEFORE UPDATE ON public.grade_time_rules
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_password_requests_updated_at ON public.password_requests;
CREATE TRIGGER trg_password_requests_updated_at
    BEFORE UPDATE ON public.password_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- 6. Insert default grade time rules
INSERT INTO public.grade_time_rules (grade_level, start_time, break_time, end_time)
VALUES
    ('Kinder', '07:30:00', '10:00:00', '12:00:00'),
    ('Grade 1', '07:30:00', '10:00:00', '12:00:00'),
    ('Grade 2', '07:30:00', '10:00:00', '12:00:00'),
    ('Grade 3', '07:30:00', '10:00:00', '12:00:00'),
    ('Grade 4', '07:30:00', '10:00:00', '12:00:00'),
    ('Grade 5', '07:30:00', '10:00:00', '12:00:00'),
    ('Grade 6', '07:30:00', '10:00:00', '12:00:00'),
    ('Grade 7', '07:30:00', '10:00:00', '15:00:00'),
    ('Grade 8', '07:30:00', '10:00:00', '15:00:00'),
    ('Grade 9', '07:30:00', '10:00:00', '15:00:00'),
    ('Grade 10', '07:30:00', '10:00:00', '15:00:00'),
    ('Grade 11', '07:30:00', '12:00:00', '16:00:00'),
    ('Grade 12', '07:30:00', '12:00:00', '16:00:00')
ON CONFLICT (grade_level) DO UPDATE
SET start_time = EXCLUDED.start_time,
    break_time = EXCLUDED.break_time,
    end_time = EXCLUDED.end_time,
    updated_at = now();

-- 7. Update issue_student_id function to match requirements
CREATE OR REPLACE FUNCTION public.issue_student_id(p_student_id uuid, p_force boolean DEFAULT false)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  existing_id uuid;
  new_code text;
  student_lrn text;
  current_year text;
  last4_lrn text;
  random4 text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Get student LRN
  SELECT lrn INTO student_lrn
  FROM public.students
  WHERE id = p_student_id;

  IF student_lrn IS NULL THEN
    RAISE EXCEPTION 'Student not found or missing LRN';
  END IF;

  -- Check for existing active ID
  SELECT si.id
  INTO existing_id
  FROM public.student_ids si
  WHERE si.student_id = p_student_id
    AND si.is_active = true
  ORDER BY si.created_at DESC
  LIMIT 1;

  IF existing_id IS NOT NULL AND NOT p_force THEN
    RAISE EXCEPTION 'active_id_exists';
  END IF;

  -- Generate ID according to requirements: EDU-<current_year>-<last4digits_lrn>-<random4>
  current_year := extract(year FROM current_date)::text;
  last4_lrn := right(regexp_replace(student_lrn, '\D', '', 'g'), 4);
  last4_lrn := lpad(coalesce(last4_lrn, ''), 4, '0');
  random4 := lpad((floor(random() * 10000))::text, 4, '0');
  
  new_code := 'EDU-' || current_year || '-' || last4_lrn || '-' || random4;

  -- Deactivate existing ID if force re-issue
  IF existing_id IS NOT NULL THEN
    UPDATE public.student_ids
    SET is_active = false
    WHERE id = existing_id;
  END IF;

  -- Insert new ID
  INSERT INTO public.student_ids (student_id, qr_code, is_active)
  VALUES (p_student_id, new_code, true)
  RETURNING qr_code INTO new_code;

  RETURN new_code;
END;
$$;

-- 8. Create RLS policies
ALTER TABLE public.grade_time_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;

-- Grade time rules: Readable by all authenticated users
CREATE POLICY "grade_time_rules_read" ON public.grade_time_rules
    FOR SELECT USING (auth.role() = 'authenticated');

-- Grade time rules: Only admins can modify
CREATE POLICY "grade_time_rules_modify" ON public.grade_time_rules
    FOR ALL USING (public.is_admin());

-- Password reset requests: Users can create their own requests
CREATE POLICY "password_reset_requests_self_insert" ON public.password_reset_requests
    FOR INSERT WITH CHECK (requested_user_id = auth.uid());

-- Password reset requests: Users can read their own requests
CREATE POLICY "password_reset_requests_self_select" ON public.password_reset_requests
    FOR SELECT USING (requested_user_id = auth.uid());

-- Password reset requests: Admins can read all requests
CREATE POLICY "password_reset_requests_admin_read" ON public.password_reset_requests
    FOR SELECT USING (public.is_admin());

-- Password reset requests: Admins can update status
CREATE POLICY "password_reset_requests_admin_update" ON public.password_reset_requests
    FOR UPDATE USING (public.is_admin());

-- 9. Add photo column to students table for ID photos
ALTER TABLE public.students 
    ADD COLUMN IF NOT EXISTS photo_path text,
    ADD COLUMN IF NOT EXISTS photo_mime text;

COMMENT ON COLUMN public.students.photo_path IS 'Path to student photo in storage';
COMMENT ON COLUMN public.students.photo_mime IS 'MIME type of student photo';

-- 10. Create storage bucket for student photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('student-photos', 'student-photos', true, 5242880, '{"image/jpeg", "image/png", "image/gif"}')
ON CONFLICT (id) DO UPDATE 
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 11. RLS policies for student photos bucket
CREATE POLICY "student_photos_read" ON storage.objects
    FOR SELECT USING (bucket_id = 'student-photos');

CREATE POLICY "student_photos_insert" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'student-photos' AND public.is_admin());

CREATE POLICY "student_photos_update" ON storage.objects
    FOR UPDATE USING (bucket_id = 'student-photos' AND public.is_admin());

CREATE POLICY "student_photos_delete" ON storage.objects
    FOR DELETE USING (bucket_id = 'student-photos' AND public.is_admin());