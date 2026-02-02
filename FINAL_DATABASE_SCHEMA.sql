CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
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
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT profiles_role_check CHECK (role IN ('admin','teacher','parent','guard','clinic'))
);

CREATE TABLE public.admin_staff (
  id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  position text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.teachers (
  id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  employee_no text UNIQUE,
  is_homeroom boolean DEFAULT false NOT NULL,
  is_gatekeeper boolean DEFAULT false NOT NULL,
  assigned_subjects text[],
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.parents (
  id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  address text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.guards (
  id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  shift text,
  assigned_gate text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.clinic_staff (
  id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  license_no text,
  position text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.classes (
  id text PRIMARY KEY,
  grade text NOT NULL,
  strand text,
  adviser_id uuid REFERENCES public.teachers(id) ON DELETE SET NULL,
  room text,
  level text,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.students (
  id text PRIMARY KEY,
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
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT students_id_not_empty CHECK (id <> '')
);

CREATE TABLE public.parent_students (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_id uuid REFERENCES public.parents(id) ON DELETE CASCADE,
  student_id text REFERENCES public.students(id) ON DELETE CASCADE,
  relationship text,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT parent_students_unique UNIQUE (parent_id, student_id)
);

CREATE TABLE public.subjects (
  code text PRIMARY KEY,
  name text NOT NULL,
  grade text NOT NULL,
  semester text,
  strand text,
  type text,
  description text,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT subjects_type_check CHECK (type IS NULL OR type IN ('core', 'applied', 'specialization', 'other'))
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
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT class_schedules_time_check CHECK (end_time > start_time)
);

CREATE TABLE public.attendance_rules (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  grade_level text UNIQUE,
  in_start time,
  grace_until time,
  late_until time,
  dismissal_time time,
  min_subject_minutes int DEFAULT 30 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.attendance_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id text REFERENCES public.students(id) ON DELETE CASCADE,
  event_type text,
  timestamp timestamptz DEFAULT now() NOT NULL,
  device_id text,
  recorded_by uuid REFERENCES public.profiles(id)
);

CREATE TABLE public.attendance (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id text REFERENCES public.students(id) ON DELETE CASCADE,
  date date,
  status text,
  recorded_by uuid REFERENCES public.profiles(id),
  timestamp timestamptz DEFAULT now() NOT NULL,
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
  recorded_at timestamptz DEFAULT now() NOT NULL
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
  validated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT attendance_validations_session_check CHECK (session IS NULL OR session IN ('AM','PM')),
  CONSTRAINT attendance_validations_unique UNIQUE (class_id, subject, session, attendance_date)
);

CREATE TABLE public.excuse_letters (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id text REFERENCES public.students(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.parents(id) ON DELETE CASCADE,
  absent_date date,
  reason text,
  status text,
  remarks text,
  issued_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.clinic_visits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id text REFERENCES public.students(id) ON DELETE CASCADE,
  visit_time timestamptz DEFAULT now() NOT NULL,
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
  issued_at timestamptz DEFAULT now() NOT NULL,
  reason text,
  status text
);

CREATE TABLE public.qr_codes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id text REFERENCES public.students(id) ON DELETE CASCADE,
  qr_hash text UNIQUE,
  is_active boolean DEFAULT true NOT NULL,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.announcements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text,
  content text,
  audience text[] DEFAULT '{}'::text[],
  is_pinned boolean DEFAULT false NOT NULL,
  posted_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_id uuid REFERENCES public.profiles(id),
  actor_id uuid REFERENCES public.profiles(id),
  verb text,
  object jsonb DEFAULT '{}'::jsonb,
  read boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
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
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.system_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  key text UNIQUE,
  value jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.audit_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id uuid REFERENCES public.profiles(id),
  action text,
  target_table text,
  target_id text,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_attendance_student_ts ON public.attendance (student_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_ts ON public.attendance (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_subject_attendance_student_date ON public.subject_attendance (student_id, date);
CREATE INDEX IF NOT EXISTS idx_clinic_visits_student_time ON public.clinic_visits (student_id, visit_time DESC);
CREATE INDEX IF NOT EXISTS idx_parent_students_student ON public.parent_students (student_id);
CREATE INDEX IF NOT EXISTS idx_announcements_created ON public.announcements (created_at DESC);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, username, phone, is_active)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', 'New User'),
    COALESCE(new.raw_user_meta_data->>'role', 'parent'),
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'phone',
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    username = COALESCE(EXCLUDED.username, profiles.username),
    phone = COALESCE(EXCLUDED.phone, profiles.phone);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.process_attendance_event()
RETURNS TRIGGER AS $$
DECLARE
    student_grade text;
    student_name text;
    parent_uid uuid;
    rule_grace_time time;
    rule_late_time time;
    event_time time;
    today_date date;
    new_status text;
    new_remarks text;
    existing_status text;
    notif_verb text;
    notif_object jsonb;
BEGIN
    today_date := NEW.timestamp::date;
    event_time := NEW.timestamp::time;

    SELECT s.grade_level, s.full_name, ps.parent_id
    INTO student_grade, student_name, parent_uid
    FROM public.students s
    LEFT JOIN public.parent_students ps ON ps.student_id = s.id
    WHERE s.id = NEW.student_id;

    SELECT grace_until, late_until INTO rule_grace_time, rule_late_time
    FROM public.attendance_rules
    WHERE grade_level = student_grade;

    IF rule_grace_time IS NULL THEN rule_grace_time := '07:30:00'; END IF;
    IF rule_late_time IS NULL THEN rule_late_time := '08:30:00'; END IF;

    IF NEW.event_type = 'IN' THEN
        SELECT status INTO existing_status
        FROM public.attendance
        WHERE student_id = NEW.student_id AND timestamp::date = today_date;

        IF event_time <= rule_grace_time THEN
            new_status := 'present';
            new_remarks := 'On Time Entry';
        ELSIF event_time <= rule_late_time THEN
            new_status := 'late';
            new_remarks := 'Entered Late';
        ELSE
            new_status := 'late';
            new_remarks := 'Very Late Entry';
        END IF;

        IF existing_status IS NULL THEN
            INSERT INTO public.attendance (
                student_id, status, timestamp, method, entry_type, recorded_by, remarks
            ) VALUES (
                NEW.student_id, new_status, NEW.timestamp, 'qr', 'entry', NEW.recorded_by, new_remarks
            );
        END IF;

        notif_verb := 'attendance_entry';
        notif_object := jsonb_build_object('student_name', student_name, 'time', NEW.timestamp, 'status', new_status);

        UPDATE public.students SET current_status = 'in' WHERE id = NEW.student_id;

    ELSIF NEW.event_type = 'OUT' THEN
        UPDATE public.attendance
        SET remarks = COALESCE(remarks, '') || ' | Out: ' || to_char(event_time, 'HH12:MI AM')
        WHERE student_id = NEW.student_id AND timestamp::date = today_date;

        IF NOT FOUND THEN
             INSERT INTO public.attendance (
                student_id, status, timestamp, method, entry_type, recorded_by, remarks
            ) VALUES (
                NEW.student_id, 'present', NEW.timestamp, 'qr', 'exit', NEW.recorded_by, 'Exit without Entry'
            );
        END IF;

        notif_verb := 'attendance_exit';
        notif_object := jsonb_build_object('student_name', student_name, 'time', NEW.timestamp);

        UPDATE public.students SET current_status = 'out' WHERE id = NEW.student_id;
    END IF;

    IF parent_uid IS NOT NULL THEN
        INSERT INTO public.notifications (
            recipient_id, actor_id, verb, object, read
        ) VALUES (
            parent_uid, NEW.recorded_by, notif_verb, notif_object, false
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_process_attendance_event ON public.attendance_events;
CREATE TRIGGER trg_process_attendance_event
AFTER INSERT ON public.attendance_events
FOR EACH ROW
EXECUTE FUNCTION public.process_attendance_event();

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS \"Auth Read All %s\" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY \"Auth Read All %s\" ON public.%I FOR SELECT TO authenticated USING (true)', t, t);
  END LOOP;
END $$;

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS \"Admin God Mode %s\" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY \"Admin God Mode %s\" ON public.%I FOR ALL TO authenticated USING (public.get_user_role() = ''admin'')', t, t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Self Update Profile" ON public.profiles;
CREATE POLICY "Self Update Profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
