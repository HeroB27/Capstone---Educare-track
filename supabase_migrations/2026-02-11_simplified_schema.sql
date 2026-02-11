-- ============================================================
-- EDUCARE TRACK - SIMPLIFIED SCHEMA (ONE COMMAND)
-- Run this in Supabase SQL Editor - Copy & Paste All
-- ============================================================

-- 1. CASCADE DROP ALL EXISTING TABLES
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
DROP TABLE IF EXISTS public.subject_attendance CASCADE;
DROP TABLE IF EXISTS public.homeroom_attendance CASCADE;
DROP TABLE IF EXISTS public.attendance_rules CASCADE;
DROP TABLE IF EXISTS public.class_schedules CASCADE;
DROP TABLE IF EXISTS public.subjects CASCADE;
DROP TABLE IF EXISTS public.students CASCADE;
DROP TABLE IF EXISTS public.classes CASCADE;
DROP TABLE IF EXISTS public.parents CASCADE;
DROP TABLE IF EXISTS public.clinic_staff CASCADE;
DROP TABLE IF EXISTS public.guards CASCADE;
DROP TABLE IF EXISTS public.teachers CASCADE;
DROP TABLE IF EXISTS public.user_passwords CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- 2. CREATE ALL TABLES

CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    phone TEXT,
    email TEXT,
    address TEXT,
    role TEXT NOT NULL CHECK (role IN ('admin', 'teacher', 'parent', 'guard', 'clinic')),
    is_active BOOLEAN DEFAULT TRUE,
    is_gatekeeper BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.user_passwords (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(profile_id)
);

CREATE TABLE public.teachers (
    profile_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    employee_id TEXT,
    is_gatekeeper BOOLEAN DEFAULT FALSE
);

CREATE TABLE public.guards (
    profile_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    employee_id TEXT
);

CREATE TABLE public.clinic_staff (
    profile_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    employee_id TEXT
);

CREATE TABLE public.parents (
    profile_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    parent_type TEXT DEFAULT 'Parent' CHECK (parent_type IN ('Parent', 'Guardian'))
);

CREATE TABLE public.classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grade_level TEXT NOT NULL,
    strand TEXT,
    room TEXT,
    homeroom_teacher_id UUID REFERENCES public.profiles(id),
    subject_teachers UUID[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.subjects (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    grade_level TEXT NOT NULL,
    strand TEXT,
    type TEXT CHECK (type IN ('core', 'applied', 'specialization', 'other')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.class_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
    subject_code TEXT REFERENCES public.subjects(code),
    teacher_id UUID REFERENCES public.profiles(id),
    day_of_week TEXT CHECK (day_of_week IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday')),
    start_time TIME,
    end_time TIME,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    lrn TEXT UNIQUE,
    dob DATE,
    gender TEXT CHECK (gender IN ('male', 'female', 'other')),
    grade_level TEXT NOT NULL,
    strand TEXT,
    class_id UUID REFERENCES public.classes(id),
    address TEXT,
    photo_path TEXT,
    parent_id UUID REFERENCES public.profiles(id),
    current_status TEXT DEFAULT 'out' CHECK (current_status IN ('in', 'out', 'clinic')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.attendance_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grade_level TEXT NOT NULL UNIQUE,
    entry_time TIME NOT NULL,
    grace_until TIME NOT NULL,
    late_until TIME NOT NULL,
    min_subject_minutes INTEGER DEFAULT 30,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.homeroom_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    class_id UUID REFERENCES public.classes(id),
    date DATE NOT NULL,
    tap_in_time TIMESTAMPTZ,
    tap_out_time TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'absent' CHECK (status IN ('present', 'late', 'absent', 'excused', 'partial')),
    late_by INTERVAL,
    early_leave INTERVAL,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, date)
);

CREATE TABLE public.subject_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    subject_code TEXT REFERENCES public.subjects(code),
    date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'absent' CHECK (status IN ('present', 'late', 'absent', 'excused')),
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, subject_code, date)
);

CREATE TABLE public.clinic_visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    visit_time TIMESTAMPTZ DEFAULT NOW(),
    reason TEXT NOT NULL,
    treated_by UUID REFERENCES public.profiles(id),
    notes TEXT,
    status TEXT DEFAULT 'in_clinic' CHECK (status IN ('in_clinic', 'treated', 'referred')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.clinic_passes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    clinic_visit_id UUID REFERENCES public.clinic_visits(id),
    issued_by UUID REFERENCES public.profiles(id),
    reason TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    issued_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    audience_teachers BOOLEAN DEFAULT FALSE,
    audience_parents BOOLEAN DEFAULT FALSE,
    audience_staff BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES public.profiles(id),
    class_id UUID REFERENCES public.classes(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES public.profiles(id),
    verb TEXT NOT NULL,
    object TEXT NOT NULL,
    "read" BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.school_calendar (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT CHECK (type IN ('holiday', 'suspension', 'event', 'exam')),
    title TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    notes TEXT,
    grade_scope TEXT DEFAULT 'all',
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.excuse_letters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES public.profiles(id),
    absent_date DATE NOT NULL,
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    remarks TEXT,
    attachment_path TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.password_reset_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requested_user_id TEXT NOT NULL,
    requested_by UUID REFERENCES public.profiles(id),
    note TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.student_ids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    qr_code TEXT NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    value JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.tap_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.students(id),
    gatekeeper_id UUID REFERENCES public.profiles(id),
    tap_type TEXT CHECK (tap_type IN ('in', 'out')),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    status TEXT CHECK (status IN ('success', 'late', 'early', 'invalid')),
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. CREATE INDEXES
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_profiles_username ON public.profiles(username);
CREATE INDEX idx_students_class_id ON public.students(class_id);
CREATE INDEX idx_students_parent_id ON public.students(parent_id);
CREATE INDEX idx_students_grade_level ON public.students(grade_level);
CREATE INDEX idx_homeroom_attendance_student_date ON public.homeroom_attendance(student_id, date);
CREATE INDEX idx_clinic_visits_student_id ON public.clinic_visits(student_id);
CREATE INDEX idx_announcements_created_at ON public.announcements(created_at);
CREATE INDEX idx_school_calendar_date ON public.school_calendar(start_date, end_date);
CREATE INDEX idx_notifications_recipient ON public.notifications(recipient_id, "read");

-- 4. DISABLE RLS ON ALL TABLES
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.students DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.homeroom_attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.subject_attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_visits DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.excuse_letters DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_ids DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_passwords DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tap_logs DISABLE ROW LEVEL SECURITY;

-- 5. INSERT SAMPLE USERS (password: demo123)
INSERT INTO public.profiles (full_name, username, phone, role, is_active) VALUES
    ('Administrator', 'ADM-2026-0001-0001', '09111111111', 'admin', TRUE),
    ('Juan dela Cruz', 'TCH-2026-0001-0001', '09122222222', 'teacher', TRUE),
    ('Maria Santos', 'GRD-2026-0001-0001', '09133333333', 'guard', TRUE),
    ('Dr. Ana Reyes', 'CLN-2026-0001-0001', '09144444444', 'clinic', TRUE),
    ('Pedro Paterno', 'PAR-2026-0001-0001', '09155555555', 'parent', TRUE);

-- Set passwords for sample users
INSERT INTO public.user_passwords (profile_id, password_hash)
SELECT id, 'demo123' FROM public.profiles WHERE username IN (
    'ADM-2026-0001-0001', 'TCH-2026-0001-0001', 'GRD-2026-0001-0001', 
    'CLN-2026-0001-0001', 'PAR-2026-0001-0001'
);

-- Insert role-specific data
INSERT INTO public.teachers (profile_id, employee_id)
SELECT id, 'EMP-001' FROM public.profiles WHERE username = 'TCH-2026-0001-0001';

INSERT INTO public.guards (profile_id, employee_id)
SELECT id, 'EMP-002' FROM public.profiles WHERE username = 'GRD-2026-0001-0001';

INSERT INTO public.clinic_staff (profile_id, employee_id)
SELECT id, 'EMP-003' FROM public.profiles WHERE username = 'CLN-2026-0001-0001';

INSERT INTO public.parents (profile_id, parent_type)
SELECT id, 'Parent' FROM public.profiles WHERE username = 'PAR-2026-0001-0001';

-- Sample classes
INSERT INTO public.classes (grade_level, strand, room, is_active) VALUES
    ('Grade 10', 'STEM', 'Room 101', TRUE),
    ('Grade 9', NULL, 'Room 102', TRUE),
    ('Grade 8', NULL, 'Room 103', TRUE);

-- Sample subjects
INSERT INTO public.subjects (code, name, grade_level, type) VALUES
    ('MATH-10', 'Mathematics 10', 'Grade 10', 'core'),
    ('SCI-10', 'Science 10', 'Grade 10', 'core'),
    ('FIL-10', 'Filipino 10', 'Grade 10', 'core'),
    ('ENG-10', 'English 10', 'Grade 10', 'core');

-- Attendance rules
INSERT INTO public.attendance_rules (grade_level, entry_time, grace_until, late_until, min_subject_minutes) VALUES 
    ('Kinder', '07:30', '07:45', '08:00', 30),
    ('1', '07:30', '07:45', '08:00', 30),
    ('2', '07:30', '07:45', '08:00', 30),
    ('3', '07:30', '07:45', '08:00', 30),
    ('4', '07:30', '07:45', '08:00', 30),
    ('5', '07:30', '07:45', '08:00', 30),
    ('6', '07:30', '07:45', '08:00', 30),
    ('JHS', '07:30', '07:45', '08:00', 45),
    ('SHS', '07:30', '07:45', '08:00', 60);

-- System settings
INSERT INTO public.system_settings (key, value) VALUES 
    ('school_start_time', '{"value": "07:30"}'),
    ('late_threshold_minutes', '{"value": 15}');

-- 6. VERIFY
SELECT 'Done! Users created:' as status;
SELECT id, full_name, username, role FROM public.profiles ORDER BY role;
