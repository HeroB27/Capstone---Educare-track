-- ==========================================
-- EDUCARE TRACK - PRODUCTION RESET SCRIPT
-- ==========================================
-- This script restores EVERY table and implements 
-- hardened RLS for Admin and authenticated read access.

-- 1. CLEANUP
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- 2. CORE EXTENSIONS
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 3. PROFILES & ROLE TABLES
CREATE TABLE public.profiles ( 
   id uuid DEFAULT gen_random_uuid(), 
   custom_id text UNIQUE NOT NULL, -- Naming convention: ADM/TCH/CLC/GRD-YYYY-LLLL-XXXX
   phone text, 
   email text UNIQUE NOT NULL, 
   avatar_url text, 
   full_name text NOT NULL, 
   username text UNIQUE, 
   photo_url text, 
   is_active boolean DEFAULT true NOT NULL, 
   nickname text, 
   gender text, 
   birthdate date, 
   role text NOT NULL, 
   created_at timestamptz DEFAULT now(), 
   updated_at timestamptz DEFAULT now(), 
   PRIMARY KEY (id), 
   CHECK (role IN ('admin','teacher','parent','guard','clinic')) 
 );

CREATE TABLE public.admin_staff (
  id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  position text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.teachers (
  id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  employee_no text UNIQUE,
  is_homeroom boolean DEFAULT false,
  is_gatekeeper boolean DEFAULT false,
  assigned_subjects text[],
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.parents (
  id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  address text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.guards (
  id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  shift text,
  assigned_gate text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.clinic_staff (
  id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  license_no text,
  position text,
  created_at timestamptz DEFAULT now()
);

-- 4. ACADEMIC STRUCTURE
CREATE TABLE public.classes (
  id text PRIMARY KEY,
  grade text,
  strand text,
  adviser_id uuid REFERENCES public.teachers(id) ON DELETE SET NULL,
  room text,
  level text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.students ( 
   id text PRIMARY KEY, -- Naming convention: EDU-YYYY-LLLL-XXXX
   lrn text UNIQUE NOT NULL, 
   full_name text NOT NULL, 
   dob date, 
   gender text, 
   grade_level text NOT NULL, 
   strand text, 
   class_id text REFERENCES public.classes(id) ON DELETE SET NULL, 
   address text, 
   photo_url text, 
   current_status text DEFAULT 'out' NOT NULL, 
   created_at timestamptz DEFAULT now(), 
   updated_at timestamptz DEFAULT now(), 
   CHECK (id <> '') 
 );

CREATE TABLE public.parent_students (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_id uuid REFERENCES public.parents(id) ON DELETE CASCADE,
  student_id text REFERENCES public.students(id) ON DELETE CASCADE,
  relationship text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (parent_id, student_id)
);

CREATE TABLE public.subjects (
  code text PRIMARY KEY,
  name text,
  grade_level text NOT NULL,
  semester text, -- '1', '2' or NULL
  strand text,   -- 'STEM', 'ABM', 'HUMSS', 'ICT' or NULL
  type text CHECK (type IN ('core', 'applied', 'specialization', 'other')),
  description text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.class_schedules (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id text REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_code text REFERENCES public.subjects(code) ON DELETE CASCADE,
  teacher_id uuid REFERENCES public.teachers(id) ON DELETE CASCADE,
  day_of_week text,
  start_time time,
  end_time time,
  semester text,
  created_at timestamptz DEFAULT now(),
  CHECK (end_time > start_time)
);

-- 5. ATTENDANCE & VALIDATION
CREATE TABLE public.attendance_rules ( 
   id uuid DEFAULT gen_random_uuid() PRIMARY KEY, 
   grade_level text UNIQUE, 
   in_start time, 
   grace_until time, 
   late_until time, 
   dismissal_time time, -- Added for tap-out logic
   min_subject_minutes int DEFAULT 30, 
   created_at timestamptz DEFAULT now() 
 );

CREATE TABLE public.attendance_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id text REFERENCES public.students(id) ON DELETE CASCADE,
  event_type text,
  timestamp timestamptz DEFAULT now(),
  device_id text,
  recorded_by uuid REFERENCES public.profiles(id)
);

CREATE TABLE public.attendance (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id text REFERENCES public.students(id) ON DELETE CASCADE,
  date date,
  status text,
  recorded_by uuid REFERENCES public.profiles(id),
  timestamp timestamptz DEFAULT now(),
  class_id text,
  session text,
  entry_type text,
  method text,
  remarks text
);

CREATE TABLE public.subject_attendance (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id text REFERENCES public.students(id) ON DELETE CASCADE,
  subject_code text REFERENCES public.subjects(code) ON DELETE CASCADE,
  date date,
  status text,
  recorded_by uuid REFERENCES public.profiles(id),
  remarks text,
  recorded_at timestamptz DEFAULT now()
);

CREATE TABLE public.attendance_validations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  attendance_id uuid REFERENCES public.attendance(id) ON DELETE CASCADE,
  validated_by uuid REFERENCES public.profiles(id),
  status text,
  class_id text,
  teacher_id uuid REFERENCES public.teachers(id),
  subject text,
  session text,
  attendance_date date,
  remarks text,
  validated_at timestamptz DEFAULT now(),
  UNIQUE (class_id, subject, session, attendance_date)
);

-- 6. EXCUSE & CLINIC MODULES
CREATE TABLE public.excuse_letters (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id text REFERENCES public.students(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.parents(id) ON DELETE CASCADE,
  absent_date date,
  reason text,
  status text,
  remarks text,
  issued_at timestamptz DEFAULT now()
);

CREATE TABLE public.clinic_visits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id text REFERENCES public.students(id) ON DELETE CASCADE,
  visit_time timestamptz DEFAULT now(),
  reason text,
  treated_by uuid REFERENCES public.clinic_staff(id),
  notes text,
  status text
);

CREATE TABLE public.clinic_passes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id text REFERENCES public.students(id) ON DELETE CASCADE,
  clinic_visit_id uuid REFERENCES public.clinic_visits(id) ON DELETE CASCADE,
  issued_by uuid REFERENCES public.profiles(id),
  issued_at timestamptz DEFAULT now(),
  reason text,
  status text
);

-- 7. UTILITIES & LOGS
CREATE TABLE public.qr_codes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id text REFERENCES public.students(id) ON DELETE CASCADE,
  qr_hash text UNIQUE,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.announcements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text,
  content text,
  audience text[] DEFAULT '{}',
  is_pinned boolean DEFAULT false,
  posted_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_id uuid REFERENCES public.profiles(id),
  actor_id uuid REFERENCES public.profiles(id),
  verb text,
  object jsonb DEFAULT '{}'::jsonb,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.school_calendar (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  type text,
  title text,
  start_date date,
  end_date date,
  notes text,
  grade_scope text DEFAULT 'all',
  created_by uuid REFERENCES public.profiles(id),
  event_date date,
  description text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.system_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  key text UNIQUE,
  value jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.audit_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id uuid REFERENCES public.profiles(id),
  action text,
  target_table text,
  target_id text,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- 8. SECURITY (RLS) & POLICIES
-- Enable RLS on all tables
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- Helper function to get role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- UNIVERSAL POLICIES (Bulletproof)
-- 1. Everyone who is logged in can READ everything (Frictionless)
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
  LOOP
    EXECUTE format('CREATE POLICY "Auth Read All %s" ON public.%I FOR SELECT TO authenticated USING (true)', t, t);
  END LOOP;
END $$;

-- 2. Admins can do EVERYTHING (God Mode)
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
  LOOP
    EXECUTE format('CREATE POLICY "Admin God Mode %s" ON public.%I ALL TO authenticated USING (public.get_user_role() = ''admin'')', t, t);
  END LOOP;
END $$;

-- 3. Users can update their OWN profiles
CREATE POLICY "Self Update Profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- 9. TRIGGERS
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, custom_id, username, phone)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'full_name', 'New User'),
    COALESCE(new.raw_user_meta_data->>'role', 'parent'),
    COALESCE(new.raw_user_meta_data->>'custom_id', 'TEMP-' || new.id),
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    custom_id = COALESCE(EXCLUDED.custom_id, profiles.custom_id),
    username = COALESCE(EXCLUDED.username, profiles.username),
    phone = COALESCE(EXCLUDED.phone, profiles.phone);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 10. GRANTS
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, postgres;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, postgres;
