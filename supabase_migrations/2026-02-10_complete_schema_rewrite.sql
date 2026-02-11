-- Complete Database Schema Rewrite for Educare Track
-- This migration DROPS all existing tables and recreates them with proper constraints

-- ==================== EXTENSIONS ====================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ==================== DROP EXISTING TABLES (CASCADE) ====================

-- Drop tables in reverse order to handle foreign key constraints
DROP TABLE IF EXISTS public.tap_logs CASCADE;
DROP TABLE IF EXISTS public.system_settings CASCADE;
DROP TABLE IF EXISTS public.student_ids CASCADE;
DROP TABLE IF EXISTS public.password_reset_requests CASCADE;
DROP TABLE IF EXISTS public.excuse_letters CASCADE;
DROP TABLE IF EXISTS public.school_calendar CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.announcements CASCADE;
DROP TABLE IF EXISTS public.clinic_passes CASCADE;
DROP TABLE IF EXISTS public.clinic_visits CASCADE;
DROP TABLE IF EXISTS public.class_schedules CASCADE;
DROP TABLE IF EXISTS public.subject_attendance CASCADE;
DROP TABLE IF EXISTS public.homeroom_attendance CASCADE;
DROP TABLE IF EXISTS public.attendance_rules CASCADE;
DROP TABLE IF EXISTS public.subjects CASCADE;
DROP TABLE IF EXISTS public.classes CASCADE;
DROP TABLE IF EXISTS public.students CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Drop functions and triggers
DROP FUNCTION IF EXISTS public.get_student_attendance_summary CASCADE;
DROP FUNCTION IF EXISTS public.issue_student_id CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column CASCADE;

-- Drop policies
DO $$
BEGIN
    -- Drop all RLS policies
    EXECUTE (
        SELECT string_agg('DROP POLICY IF EXISTS "' || policyname || '" ON ' || schemaname || '.' || tablename || ' CASCADE;', ' ')
        FROM pg_policies 
        WHERE schemaname = 'public'
    );
EXCEPTION 
    WHEN others THEN NULL;
END$$;

-- Remove tables from realtime publication
DO $$
BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS ' || 
        string_agg('public.' || table_name, ', ') 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN (
        'announcements', 'notifications', 'clinic_visits', 
        'students', 'profiles', 'homeroom_attendance'
    );
EXCEPTION
    WHEN others THEN NULL;
END$$;

-- ==================== CORE TABLES ====================

-- Users and Authentication
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id),
    full_name text NOT NULL,
    username text NOT NULL UNIQUE,
    phone text,
    email text,
    role text NOT NULL CHECK (role IN ('admin', 'teacher', 'parent', 'guard', 'clinic')),
    is_active boolean DEFAULT true,
    is_gatekeeper boolean DEFAULT false,
    address text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Classes
CREATE TABLE IF NOT EXISTS public.classes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    grade_level text NOT NULL,
    strand text,
    homeroom_teacher_id uuid REFERENCES public.profiles(id),
    room text,
    subject_teachers uuid[] DEFAULT '{}',
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Students
CREATE TABLE IF NOT EXISTS public.students (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name text NOT NULL,
    lrn text UNIQUE,
    dob date,
    gender text CHECK (gender IN ('male', 'female', 'other')),
    grade_level text NOT NULL,
    strand text,
    class_id uuid REFERENCES public.classes(id),
    address text,
    photo_path text,
    photo_mime text,
    parent_id uuid REFERENCES public.profiles(id),
    current_status text DEFAULT 'out' CHECK (current_status IN ('in', 'out', 'clinic')),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Subjects
CREATE TABLE IF NOT EXISTS public.subjects (
    code text PRIMARY KEY,
    name text NOT NULL,
    grade_level text NOT NULL,
    strand text,
    type text CHECK (type IN ('core', 'applied', 'specialization', 'other')),
    created_at timestamptz DEFAULT now()
);

-- ==================== ATTENDANCE MODULE ====================

-- Attendance Rules
CREATE TABLE IF NOT EXISTS public.attendance_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    grade_level text NOT NULL UNIQUE,
    entry_time time NOT NULL,
    grace_until time NOT NULL,
    late_until time NOT NULL,
    min_subject_minutes integer DEFAULT 30,
    created_at timestamptz DEFAULT now()
);

-- Homeroom Attendance
CREATE TABLE IF NOT EXISTS public.homeroom_attendance (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid REFERENCES public.students(id),
    class_id uuid REFERENCES public.classes(id),
    date date NOT NULL,
    tap_in_time timestamptz,
    tap_out_time timestamptz,
    status text NOT NULL DEFAULT 'absent' CHECK (status IN ('present', 'late', 'absent', 'excused', 'partial', 'excused_absent', 'morning_absent')),
    late_by interval,
    early_leave interval,
    remarks text,
    created_at timestamptz DEFAULT now(),
    UNIQUE(student_id, date)
);

-- Subject Attendance
CREATE TABLE IF NOT EXISTS public.subject_attendance (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid REFERENCES public.students(id),
    subject_code text REFERENCES public.subjects(code),
    date date NOT NULL,
    status text NOT NULL DEFAULT 'absent' CHECK (status IN ('present', 'late', 'absent', 'excused', 'partial', 'excused_absent', 'morning_absent')),
    remarks text,
    created_at timestamptz DEFAULT now(),
    UNIQUE(student_id, subject_code, date)
);

-- Class Schedules
CREATE TABLE IF NOT EXISTS public.class_schedules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id uuid REFERENCES public.classes(id),
    subject_code text REFERENCES public.subjects(code),
    teacher_id uuid REFERENCES public.profiles(id),
    day_of_week text CHECK (day_of_week IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday')),
    start_time time,
    end_time time,
    created_at timestamptz DEFAULT now()
);

-- ==================== CLINIC MODULE ====================

-- Clinic Visits
CREATE TABLE IF NOT EXISTS public.clinic_visits (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid REFERENCES public.students(id),
    visit_time timestamptz DEFAULT now(),
    reason text NOT NULL,
    treated_by uuid REFERENCES public.profiles(id),
    notes text,
    status text DEFAULT 'in_clinic' CHECK (status IN ('in_clinic', 'treated', 'referred')),
    created_at timestamptz DEFAULT now()
);

-- Clinic Passes
CREATE TABLE IF NOT EXISTS public.clinic_passes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid REFERENCES public.students(id),
    clinic_visit_id uuid REFERENCES public.clinic_visits(id),
    issued_by uuid REFERENCES public.profiles(id),
    reason text,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    issued_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now()
);

-- ==================== COMMUNICATIONS MODULE ====================

-- Announcements
CREATE TABLE IF NOT EXISTS public.announcements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    body text NOT NULL,
    audience_teachers boolean DEFAULT false,
    audience_parents boolean DEFAULT false,
    audience_staff boolean DEFAULT false,
    audience_guard boolean DEFAULT false,
    audience_clinic boolean DEFAULT false,
    created_by uuid REFERENCES public.profiles(id),
    class_id uuid REFERENCES public.classes(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id uuid REFERENCES public.profiles(id),
    actor_id uuid REFERENCES public.profiles(id),
    verb text NOT NULL,
    object jsonb DEFAULT '{}',
    read boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- ==================== ADMINISTRATION MODULE ====================

-- School Calendar
CREATE TABLE IF NOT EXISTS public.school_calendar (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    type text CHECK (type IN ('holiday', 'suspension', 'event', 'exam')),
    title text NOT NULL,
    start_date date NOT NULL,
    end_date date,
    notes text,
    grade_scope text DEFAULT 'all',
    created_by uuid REFERENCES public.profiles(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Excuse Letters
CREATE TABLE IF NOT EXISTS public.excuse_letters (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid REFERENCES public.students(id),
    parent_id uuid REFERENCES public.profiles(id),
    absent_date date NOT NULL,
    reason text NOT NULL,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    remarks text,
    attachment_path text,
    attachment_name text,
    attachment_mime text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Password Reset Requests
CREATE TABLE IF NOT EXISTS public.password_reset_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    requested_user_id text NOT NULL,
    requested_by_profile_id uuid REFERENCES public.profiles(id),
    note text,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'rejected')),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- ==================== ID CARDS MODULE ====================

-- Student IDs
CREATE TABLE IF NOT EXISTS public.student_ids (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid REFERENCES public.students(id),
    qr_code text NOT NULL UNIQUE,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- ==================== SYSTEM MODULE ====================

-- System Settings
CREATE TABLE IF NOT EXISTS public.system_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key text NOT NULL UNIQUE,
    value jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Tap Logs
CREATE TABLE IF NOT EXISTS public.tap_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid REFERENCES public.students(id),
    gatekeeper_id uuid REFERENCES public.profiles(id),
    tap_type text NOT NULL CHECK (tap_type IN ('in', 'out')),
    timestamp timestamptz DEFAULT now(),
    status text CHECK (status IN ('success', 'late', 'early', 'invalid')),
    remarks text,
    created_at timestamptz DEFAULT now()
);

-- ==================== INDEXES ====================

-- Profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON public.profiles(is_active);

-- Students indexes
CREATE INDEX IF NOT EXISTS idx_students_class_id ON public.students(class_id);
CREATE INDEX IF NOT EXISTS idx_students_parent_id ON public.students(parent_id);
CREATE INDEX IF NOT EXISTS idx_students_grade_level ON public.students(grade_level);
CREATE INDEX IF NOT EXISTS idx_students_lrn ON public.students(lrn);

-- Attendance indexes
CREATE INDEX IF NOT EXISTS idx_homeroom_attendance_student_date ON public.homeroom_attendance(student_id, date);
CREATE INDEX IF NOT EXISTS idx_homeroom_attendance_class_date ON public.homeroom_attendance(class_id, date);
CREATE INDEX IF NOT EXISTS idx_subject_attendance_student_subject_date ON public.subject_attendance(student_id, subject_code, date);

-- Clinic indexes
CREATE INDEX IF NOT EXISTS idx_clinic_visits_student_id ON public.clinic_visits(student_id);
CREATE INDEX IF NOT EXISTS idx_clinic_visits_status ON public.clinic_visits(status);

-- Announcements indexes
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON public.announcements(created_at);
CREATE INDEX IF NOT EXISTS idx_announcements_class_id ON public.announcements(class_id);

-- Calendar indexes
CREATE INDEX IF NOT EXISTS idx_school_calendar_date_range ON public.school_calendar(start_date, end_date);

-- ==================== RLS POLICIES ====================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homeroom_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subject_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.excuse_letters ENABLE ROW LEVEL SECURITY;

-- Profiles RLS
CREATE POLICY "Profiles are viewable by authenticated users" ON public.profiles
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Students RLS
CREATE POLICY "Students are viewable by authenticated users" ON public.students
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Teachers can manage their class students" ON public.students
    FOR ALL USING (
        auth.uid() IN (
            SELECT homeroom_teacher_id FROM public.classes WHERE id = class_id
            UNION
            SELECT jsonb_array_elements_text(subject_teachers)::uuid FROM public.classes WHERE id = class_id
        )
    );

-- Announcements RLS
CREATE POLICY "Announcements are viewable based on audience" ON public.announcements
    FOR SELECT USING (
        auth.role() = 'authenticated' AND (
            -- Admin sees all
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
            OR
            -- Teachers see teacher announcements
            (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher') AND audience_teachers)
            OR
            -- Parents see parent announcements  
            (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'parent') AND audience_parents)
            OR
            -- Guard sees guard announcements
            (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'guard') AND audience_guard)
            OR
            -- Clinic sees clinic announcements
            (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'clinic') AND audience_clinic)
        )
    );

-- Notifications RLS
CREATE POLICY "Users can only see their own notifications" ON public.notifications
    FOR SELECT USING (recipient_id = auth.uid());

-- Clinic Visits RLS
CREATE POLICY "Clinic staff can manage clinic visits" ON public.clinic_visits
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'clinic')
    );

-- ==================== FUNCTIONS ====================

-- Function to get student attendance summary
CREATE OR REPLACE FUNCTION public.get_student_attendance_summary(student_uuid uuid)
RETURNS TABLE (
    total_days integer,
    present_days integer,
    late_days integer,
    absent_days integer,
    attendance_rate numeric
) LANGUAGE sql STABLE AS $$
    SELECT 
        COUNT(*) as total_days,
        COUNT(*) FILTER (WHERE status = 'present') as present_days,
        COUNT(*) FILTER (WHERE status = 'late') as late_days,
        COUNT(*) FILTER (WHERE status IN ('absent', 'excused')) as absent_days,
        ROUND(COUNT(*) FILTER (WHERE status IN ('present', 'late')) * 100.0 / GREATEST(COUNT(*), 1), 2) as attendance_rate
    FROM public.homeroom_attendance
    WHERE student_id = student_uuid
$$;

-- Function to issue student ID
CREATE OR REPLACE FUNCTION public.issue_student_id(student_uuid uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    new_id uuid;
    student_data public.students;
BEGIN
    -- Get student data
    SELECT * INTO student_data FROM public.students WHERE id = student_uuid;
    
    -- Generate QR code (LRN + timestamp)
    INSERT INTO public.student_ids (student_id, qr_code)
    VALUES (student_uuid, student_data.lrn || '-' || EXTRACT(epoch FROM now())::text)
    RETURNING id INTO new_id;
    
    RETURN new_id;
END;
$$;

-- ==================== TRIGGERS ====================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all tables with updated_at column
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON public.students
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_classes_updated_at BEFORE UPDATE ON public.classes
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_announcements_updated_at BEFORE UPDATE ON public.announcements
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON public.notifications
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_school_calendar_updated_at BEFORE UPDATE ON public.school_calendar
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_excuse_letters_updated_at BEFORE UPDATE ON public.excuse_letters
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_password_reset_requests_updated_at BEFORE UPDATE ON public.password_reset_requests
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_student_ids_updated_at BEFORE UPDATE ON public.student_ids
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON public.system_settings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==================== COMMENTS ====================

COMMENT ON TABLE public.profiles IS 'User profiles with role-based access';
COMMENT ON TABLE public.students IS 'Student records with academic information';
COMMENT ON TABLE public.classes IS 'Class information with teacher assignments';
COMMENT ON TABLE public.homeroom_attendance IS 'Daily homeroom attendance records';
COMMENT ON TABLE public.announcements IS 'School announcements with audience targeting';
COMMENT ON TABLE public.clinic_visits IS 'Student clinic visit records';
COMMENT ON TABLE public.school_calendar IS 'School calendar events and holidays';

-- ==================== COMPLETION ====================

-- Grant necessary permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Enable realtime for tables that need it
ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.clinic_visits;