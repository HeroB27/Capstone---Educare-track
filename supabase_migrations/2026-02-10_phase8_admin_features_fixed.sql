-- PHASE 8: Admin Features Implementation (FIXED)
-- Created: 2026-02-10
-- Description: Adds tables for grade time rules, password requests, and teacher gatekeeper flag
-- FIX: Uses profiles table instead of non-existent teachers table

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
    created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.password_reset_requests IS 'Stores password reset requests from users';
COMMENT ON COLUMN public.password_reset_requests.requested_user_id IS 'User who requested password reset';
COMMENT ON COLUMN public.password_reset_requests.note IS 'Optional note about the request';
COMMENT ON COLUMN public.password_reset_requests.status IS 'Request status';

-- 3. Add is_gatekeeper column to profiles table (for teachers)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_gatekeeper boolean DEFAULT false;

COMMENT ON COLUMN public.profiles.is_gatekeeper IS 'Flag indicating if user can act as gatekeeper (typically for teachers)';

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

-- 5. Apply updated_at trigger to tables that need it
DO $$
BEGIN
    -- Grade time rules trigger
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'set_grade_time_rules_updated_at'
    ) THEN
        CREATE TRIGGER set_grade_time_rules_updated_at
            BEFORE UPDATE ON public.grade_time_rules
            FOR EACH ROW
            EXECUTE FUNCTION public.set_updated_at();
    END IF;

    -- Password reset requests trigger (removed - no updated_at column)
    -- Note: password_reset_requests table doesn't have updated_at column
END
$$;

-- 6. RLS Policies
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

-- 7. Add photo column to students table for ID photos
ALTER TABLE public.students 
    ADD COLUMN IF NOT EXISTS photo_path text,
    ADD COLUMN IF NOT EXISTS photo_mime text;

COMMENT ON COLUMN public.students.photo_path IS 'Path to student photo in storage';
COMMENT ON COLUMN public.students.photo_mime IS 'MIME type of student photo';

-- 8. Create storage bucket for student photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('student-photos', 'student-photos', true, 5242880, '{"image/jpeg", "image/png", "image/gif"}')
ON CONFLICT (id) DO NOTHING;

-- 9. Storage policies for student photos
CREATE POLICY "student_photos_read" ON storage.objects
    FOR SELECT USING (bucket_id = 'student-photos');

CREATE POLICY "student_photos_insert" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'student-photos' AND public.is_admin());

CREATE POLICY "student_photos_update" ON storage.objects
    FOR UPDATE USING (bucket_id = 'student-photos' AND public.is_admin());

CREATE POLICY "student_photos_delete" ON storage.objects
    FOR DELETE USING (bucket_id = 'student-photos' AND public.is_admin());

-- 10. Enable RLS on new tables
ALTER TABLE public.grade_time_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;