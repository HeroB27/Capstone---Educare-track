CREATE OR REPLACE FUNCTION public.uuid_from_text(input text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (
    substr(md5(input), 1, 8) || '-' ||
    substr(md5(input), 9, 4) || '-' ||
    substr(md5(input), 13, 4) || '-' ||
    substr(md5(input), 17, 4) || '-' ||
    substr(md5(input), 21, 12)
  )::uuid;
$$;

CREATE OR REPLACE FUNCTION public.hash_int(input text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT abs(('x' || substr(md5(input), 1, 8))::bit(32)::int);
$$;

CREATE OR REPLACE FUNCTION public.run_enterprise_seed(seed_tag text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  teacher_ids uuid[];
  parent_ids uuid[];
  guard_id uuid;
  clinic_id uuid;
  admin_id uuid;
  teachers_len int;
  parents_len int;
  start_date date;
  end_date date;
BEGIN
  SELECT array_agg(p.id ORDER BY p.username)
  INTO teacher_ids
  FROM public.profiles p
  WHERE p.role = 'teacher'
    AND p.is_active = true
    AND p.username LIKE 'TCH-2026-0000-%';

  SELECT array_agg(p.id ORDER BY p.username)
  INTO parent_ids
  FROM public.profiles p
  WHERE p.role = 'parent'
    AND p.is_active = true
    AND p.username LIKE 'PAR-2026-0000-%';

  SELECT p.id INTO guard_id
  FROM public.profiles p
  WHERE p.role = 'guard'
    AND p.is_active = true
  ORDER BY p.created_at ASC
  LIMIT 1;

  SELECT p.id INTO clinic_id
  FROM public.profiles p
  WHERE p.role = 'clinic'
    AND p.is_active = true
  ORDER BY p.created_at ASC
  LIMIT 1;

  SELECT p.id INTO admin_id
  FROM public.profiles p
  WHERE p.role = 'admin'
    AND p.is_active = true
  ORDER BY p.created_at ASC
  LIMIT 1;

  teachers_len := coalesce(array_length(teacher_ids, 1), 0);
  parents_len := coalesce(array_length(parent_ids, 1), 0);

  IF teachers_len < 2 THEN
    RAISE EXCEPTION 'Need at least 2 teachers (profiles.role=teacher) to seed.';
  END IF;
  IF parents_len < 5 THEN
    RAISE EXCEPTION 'Need at least 5 parents (profiles.role=parent) to seed.';
  END IF;
  IF guard_id IS NULL THEN
    RAISE EXCEPTION 'Need a guard profile to seed tap logs.';
  END IF;
  IF clinic_id IS NULL THEN
    RAISE EXCEPTION 'Need a clinic profile to seed clinic data.';
  END IF;
  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'Need an admin profile to seed admin-created content.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'announcements'
      AND column_name = 'class_id'
  ) THEN
    RAISE EXCEPTION 'Missing column public.announcements.class_id. Apply the Phase 3 migration that adds class-scoped announcements.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'excuse_letters'
      AND column_name = 'attachment_path'
  ) THEN
    RAISE EXCEPTION 'Missing attachment columns on public.excuse_letters. Apply the Phase 3 migration that adds attachment metadata.';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'excuse_letters'
      AND column_name = 'attachment_name'
  ) THEN
    RAISE EXCEPTION 'Missing attachment columns on public.excuse_letters. Apply the Phase 3 migration that adds attachment metadata.';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'excuse_letters'
      AND column_name = 'attachment_mime'
  ) THEN
    RAISE EXCEPTION 'Missing attachment columns on public.excuse_letters. Apply the Phase 3 migration that adds attachment metadata.';
  END IF;

  SELECT
    CASE
      WHEN extract(month FROM current_date)::int < 11
        THEN make_date(extract(year FROM current_date)::int - 1, 11, 1)
      ELSE make_date(extract(year FROM current_date)::int, 11, 1)
    END,
    current_date
  INTO start_date, end_date;

  INSERT INTO public.system_settings (id, key, value)
  VALUES
    (public.uuid_from_text(seed_tag || '|settings|school'), 'school_name', jsonb_build_object('value', 'Educare Colleges Inc')),
    (public.uuid_from_text(seed_tag || '|settings|ay'), 'academic_year', jsonb_build_object('value', extract(year FROM current_date)::int::text || '-' || (extract(year FROM current_date)::int + 1)::text)),
    (public.uuid_from_text(seed_tag || '|settings|sem'), 'semester_dates', jsonb_build_object('sem1_start', '2025-08-01', 'sem1_end', '2025-12-15', 'sem2_start', '2026-01-05', 'sem2_end', '2026-05-15')),
    (public.uuid_from_text(seed_tag || '|settings|gate'), 'gate_rules', jsonb_build_object('duplicate_window_ms', 15000, 'allow_teacher_gatekeepers', true))
  ON CONFLICT (key) DO UPDATE
  SET value = excluded.value;

  WITH class_defs AS (
    SELECT * FROM (VALUES
      ('Kinder', NULL::text, 'K-A'),
      ('Grade 1', NULL::text, '1-A'),
      ('Grade 2', NULL::text, '2-A'),
      ('Grade 3', NULL::text, '3-A'),
      ('Grade 4', NULL::text, '4-A'),
      ('Grade 5', NULL::text, '5-A'),
      ('Grade 6', NULL::text, '6-A'),
      ('Grade 7', NULL::text, '7-A'),
      ('Grade 8', NULL::text, '8-A'),
      ('Grade 9', NULL::text, '9-A'),
      ('Grade 10', NULL::text, '10-A'),
      ('Grade 11', 'ABM', '11-ABM'),
      ('Grade 11', 'TVL-ICT', '11-ICT'),
      ('Grade 11', 'HUMSS', '11-HUMSS'),
      ('Grade 11', 'STEM', '11-STEM'),
      ('Grade 12', 'ABM', '12-ABM'),
      ('Grade 12', 'TVL-ICT', '12-ICT'),
      ('Grade 12', 'HUMSS', '12-HUMSS'),
      ('Grade 12', 'STEM', '12-STEM')
    ) AS t(grade_level, strand, room)
  ),
  numbered AS (
    SELECT
      grade_level,
      strand,
      room,
      row_number() OVER (ORDER BY grade_level, strand NULLS FIRST) AS rn
    FROM class_defs
  )
  INSERT INTO public.classes (id, grade_level, strand, room, homeroom_teacher_id, is_active)
  SELECT
    public.uuid_from_text(seed_tag || '|class|' || grade_level || '|' || coalesce(strand, '') || '|' || room),
    grade_level,
    strand,
    room,
    teacher_ids[((rn - 1) % teachers_len) + 1],
    true
  FROM numbered
  ON CONFLICT (id) DO UPDATE
  SET grade_level = excluded.grade_level,
      strand = excluded.strand,
      room = excluded.room,
      homeroom_teacher_id = excluded.homeroom_teacher_id,
      is_active = excluded.is_active;

  WITH grade_levels AS (
    SELECT DISTINCT c.grade_level
    FROM public.classes c
  )
  INSERT INTO public.attendance_rules (id, grade_level, entry_time, grace_until, late_until, min_subject_minutes)
  SELECT
    public.uuid_from_text(seed_tag || '|rule|' || g.grade_level),
    g.grade_level,
    CASE WHEN g.grade_level = 'Kinder' THEN time '08:00' ELSE time '07:30' END,
    CASE WHEN g.grade_level = 'Kinder' THEN time '08:15' ELSE time '07:45' END,
    CASE WHEN g.grade_level = 'Kinder' THEN time '08:45' ELSE time '08:15' END,
    30
  FROM grade_levels g
  ON CONFLICT (grade_level) DO UPDATE
  SET entry_time = excluded.entry_time,
      grace_until = excluded.grace_until,
      late_until = excluded.late_until,
      min_subject_minutes = excluded.min_subject_minutes;

  WITH basic_subjects AS (
    SELECT * FROM (VALUES
      ('ENG', 'English', 'core'),
      ('MATH', 'Mathematics', 'core'),
      ('SCI', 'Science', 'core'),
      ('FIL', 'Filipino', 'core'),
      ('AP', 'Araling Panlipunan', 'core'),
      ('MAPEH', 'MAPEH', 'core'),
      ('ESP', 'Edukasyon sa Pagpapakatao', 'core'),
      ('TLE', 'Technology and Livelihood Education', 'core')
    ) AS t(short, name, type)
  ),
  basic_grades AS (
    SELECT DISTINCT c.grade_level
    FROM public.classes c
    WHERE c.strand IS NULL
  ),
  basic AS (
    SELECT
      CASE
        WHEN bg.grade_level = 'Kinder' THEN 'K'
        ELSE 'G' || lpad(split_part(bg.grade_level, ' ', 2), 2, '0')
      END AS gcode,
      bg.grade_level,
      bs.short,
      bs.name,
      bs.type
    FROM basic_grades bg
    CROSS JOIN basic_subjects bs
  )
  INSERT INTO public.subjects (code, name, grade_level, strand, type)
  SELECT
    (gcode || '_' || short),
    name,
    grade_level,
    NULL,
    type
  FROM basic
  ON CONFLICT (code) DO UPDATE
  SET name = excluded.name,
      grade_level = excluded.grade_level,
      strand = excluded.strand,
      type = excluded.type;

  WITH shs_defs AS (
    SELECT * FROM (VALUES
      ('ABM', 'ACCT', 'Fundamentals of Accountancy', 'specialization'),
      ('ABM', 'BUSMATH', 'Business Mathematics', 'applied'),
      ('ABM', 'FIN', 'Business Finance', 'specialization'),
      ('ABM', 'ENTREP', 'Entrepreneurship', 'specialization'),
      ('TVL-ICT', 'PROG', 'Programming', 'specialization'),
      ('TVL-ICT', 'WEB', 'Web Development', 'specialization'),
      ('TVL-ICT', 'NET', 'Network Fundamentals', 'specialization'),
      ('TVL-ICT', 'CSS', 'Computer Systems Servicing', 'specialization'),
      ('HUMSS', 'DIASS', 'Disciplines and Ideas in the Social Sciences', 'core'),
      ('HUMSS', 'CW', 'Creative Writing', 'applied'),
      ('HUMSS', 'POLGOV', 'Philippine Politics and Governance', 'core'),
      ('HUMSS', 'TRENDS', 'Trends, Networks, and Critical Thinking', 'applied'),
      ('STEM', 'PRECALC', 'Pre-Calculus', 'core'),
      ('STEM', 'CALC', 'Basic Calculus', 'core'),
      ('STEM', 'GENBIO', 'General Biology', 'core'),
      ('STEM', 'GENCHEM', 'General Chemistry', 'core'),
      ('STEM', 'GENPHYS', 'General Physics', 'core'),
      ('STEM', 'STAT', 'Statistics and Probability', 'core'),
      ('STEM', 'RES', 'Research', 'applied')
    ) AS t(strand, short, name, type)
  ),
  shs_grades AS (
    SELECT DISTINCT c.grade_level, c.strand
    FROM public.classes c
    WHERE c.strand IS NOT NULL
  )
  INSERT INTO public.subjects (code, name, grade_level, strand, type)
  SELECT
    ('G' || lpad(split_part(g.grade_level, ' ', 2), 2, '0') || '_' || replace(g.strand, '-', '') || '_' || d.short),
    d.name,
    g.grade_level,
    g.strand,
    d.type
  FROM shs_grades g
  JOIN shs_defs d ON d.strand = g.strand
  ON CONFLICT (code) DO UPDATE
  SET name = excluded.name,
      grade_level = excluded.grade_level,
      strand = excluded.strand,
      type = excluded.type;

  WITH all_classes AS (
    SELECT id, grade_level, strand
    FROM public.classes
    WHERE is_active = true
  ),
  class_subjects AS (
    SELECT
      c.id AS class_id,
      s.code AS subject_code
    FROM all_classes c
    JOIN public.subjects s
      ON s.grade_level = c.grade_level
     AND (s.strand IS NULL OR s.strand = c.strand)
  ),
  slots AS (
    SELECT * FROM (VALUES
      (time '08:00', time '08:50'),
      (time '09:00', time '09:50'),
      (time '10:00', time '10:50'),
      (time '13:00', time '13:50'),
      (time '14:00', time '14:50')
    ) AS t(start_time, end_time)
  ),
  days AS (
    SELECT * FROM (VALUES ('mon'), ('tue'), ('wed'), ('thu'), ('fri')) AS t(day_of_week)
  ),
  numbered AS (
    SELECT
      cs.class_id,
      cs.subject_code,
      public.hash_int(seed_tag || '|sched|' || cs.class_id::text || '|' || cs.subject_code) AS h
    FROM class_subjects cs
  ),
  expanded AS (
    SELECT
      n.class_id,
      n.subject_code,
      teacher_ids[((n.h % teachers_len)) + 1] AS teacher_id,
      (SELECT d.day_of_week FROM days d ORDER BY d.day_of_week OFFSET (n.h % 5) LIMIT 1) AS day_of_week,
      (SELECT s.start_time FROM slots s ORDER BY s.start_time OFFSET (n.h % 5) LIMIT 1) AS start_time,
      (SELECT s.end_time FROM slots s ORDER BY s.start_time OFFSET (n.h % 5) LIMIT 1) AS end_time
    FROM numbered n
  )
  INSERT INTO public.class_schedules (id, class_id, subject_code, teacher_id, day_of_week, start_time, end_time)
  SELECT
    public.uuid_from_text(seed_tag || '|schedule|' || class_id::text || '|' || subject_code || '|' || teacher_id::text || '|' || day_of_week || '|' || start_time::text),
    class_id,
    subject_code,
    teacher_id,
    day_of_week,
    start_time,
    end_time
  FROM expanded
  ON CONFLICT (id) DO UPDATE
  SET teacher_id = excluded.teacher_id,
      day_of_week = excluded.day_of_week,
      start_time = excluded.start_time,
      end_time = excluded.end_time;

  WITH cls AS (
    SELECT c.id AS class_id, c.grade_level, c.strand, c.homeroom_teacher_id
    FROM public.classes c
    WHERE c.is_active = true
  ),
  studs AS (
    SELECT
      c.class_id,
      c.grade_level,
      c.strand,
      gs.i AS n,
      public.hash_int(seed_tag || '|lrn|' || c.class_id::text || '|' || gs.i::text) AS h
    FROM cls c
    CROSS JOIN generate_series(1, 5) AS gs(i)
  ),
  named AS (
    SELECT
      public.uuid_from_text(seed_tag || '|student|' || lpad(((h % 1000000000000))::text, 12, '0')) AS id,
      ('Student ' || ((h % 9000) + 1000)::text) AS full_name,
      lpad(((h % 1000000000000))::text, 12, '0') AS lrn,
      CASE WHEN (h % 2) = 0 THEN 'M' ELSE 'F' END AS gender,
      class_id,
      grade_level,
      strand,
      parent_ids[((h % parents_len) + 1)] AS parent_id
    FROM studs
  )
  INSERT INTO public.students (id, full_name, lrn, gender, grade_level, strand, class_id, parent_id, current_status)
  SELECT
    id,
    full_name,
    lrn,
    gender,
    grade_level,
    strand,
    class_id,
    parent_id,
    'out'
  FROM named
  ON CONFLICT (lrn) DO UPDATE
  SET full_name = excluded.full_name,
      gender = excluded.gender,
      grade_level = excluded.grade_level,
      strand = excluded.strand,
      class_id = excluded.class_id,
      parent_id = excluded.parent_id;

  INSERT INTO public.student_ids (id, student_id, qr_code, is_active)
  SELECT
    public.uuid_from_text(seed_tag || '|student_ids|' || s.id::text),
    s.id,
    ('EDUCARE-' || s.lrn),
    true
  FROM public.students s
  WHERE s.lrn IS NOT NULL
  ON CONFLICT (student_id) DO UPDATE
  SET qr_code = excluded.qr_code,
      is_active = true;

  INSERT INTO public.school_calendar (id, type, title, start_date, end_date, notes, grade_scope, created_by)
  VALUES
    (public.uuid_from_text(seed_tag || '|cal|holiday|newyear'), 'holiday', 'New Year Holiday', make_date(extract(year FROM end_date)::int, 1, 1), make_date(extract(year FROM end_date)::int, 1, 1), 'No classes.', 'all', admin_id),
    (public.uuid_from_text(seed_tag || '|cal|holiday|foundation'), 'holiday', 'Foundation Day', start_date + 21, start_date + 21, 'School holiday.', 'all', admin_id),
    (public.uuid_from_text(seed_tag || '|cal|break|sem'), 'break', 'Semester Break', make_date(extract(year FROM end_date)::int, 12, 16), make_date(extract(year FROM end_date)::int, 12, 31), 'Semester break.', 'all', admin_id),
    (public.uuid_from_text(seed_tag || '|cal|suspension|storm'), 'emergency', 'Suspension (Weather)', start_date + 45, start_date + 45, 'Suspended due to weather.', 'all', admin_id)
  ON CONFLICT (id) DO UPDATE
  SET type = excluded.type,
      title = excluded.title,
      start_date = excluded.start_date,
      end_date = excluded.end_date,
      notes = excluded.notes,
      grade_scope = excluded.grade_scope,
      created_by = excluded.created_by;

  WITH days AS (
    SELECT d::date AS day
    FROM generate_series(start_date, end_date, interval '1 day') AS d
    WHERE extract(dow FROM d)::int BETWEEN 1 AND 5
  ),
  holidays AS (
    SELECT gs::date AS day
    FROM public.school_calendar sc
    JOIN LATERAL generate_series(sc.start_date, sc.end_date, interval '1 day') AS gs ON true
    WHERE sc.type IN ('holiday', 'break', 'emergency')
  ),
  school_days AS (
    SELECT day
    FROM days
    WHERE day NOT IN (SELECT day FROM holidays)
  ),
  rule AS (
    SELECT r.grade_level, r.entry_time, r.grace_until, r.late_until
    FROM public.attendance_rules r
  ),
  base AS (
    SELECT
      s.id AS student_id,
      s.class_id,
      s.parent_id,
      s.grade_level,
      sd.day,
      public.hash_int(seed_tag || '|att|' || s.id::text || '|' || sd.day::text) AS h
    FROM public.students s
    JOIN school_days sd ON true
  ),
  shaped AS (
    SELECT
      student_id,
      class_id,
      grade_level,
      day AS date,
      CASE
        WHEN (h % 100) < 85 THEN 'present'
        WHEN (h % 100) < 95 THEN 'late'
        ELSE 'absent'
      END AS status,
      h
    FROM base
  ),
  timed AS (
    SELECT
      sh.student_id,
      sh.class_id,
      sh.date,
      sh.status,
      CASE
        WHEN sh.status = 'absent' THEN NULL
        WHEN sh.status = 'present' THEN ((sh.date + r.entry_time) + ((sh.h % 11) - 5) * interval '1 minute')::timestamptz
        ELSE ((sh.date + r.grace_until) + (5 + (sh.h % 16)) * interval '1 minute')::timestamptz
      END AS tap_in_time,
      CASE
        WHEN sh.status = 'absent' THEN NULL
        ELSE ((sh.date + time '16:00') - (sh.h % 21) * interval '1 minute')::timestamptz
      END AS tap_out_time,
      CASE WHEN sh.status = 'late' THEN ((5 + (sh.h % 16)) * interval '1 minute') ELSE NULL END AS late_by
    FROM shaped sh
    JOIN rule r ON r.grade_level = sh.grade_level
  )
  INSERT INTO public.homeroom_attendance (student_id, class_id, date, tap_in_time, tap_out_time, status, late_by, remarks)
  SELECT
    student_id,
    class_id,
    date,
    tap_in_time,
    tap_out_time,
    status,
    late_by,
    NULL
  FROM timed
  ON CONFLICT (student_id, date) DO UPDATE
  SET class_id = excluded.class_id,
      tap_in_time = excluded.tap_in_time,
      tap_out_time = excluded.tap_out_time,
      status = excluded.status,
      late_by = excluded.late_by;

  WITH day_map AS (
    SELECT 'mon' AS key, 1 AS dow UNION ALL
    SELECT 'tue', 2 UNION ALL
    SELECT 'wed', 3 UNION ALL
    SELECT 'thu', 4 UNION ALL
    SELECT 'fri', 5
  ),
  school_days AS (
    SELECT d::date AS day
    FROM generate_series(start_date, end_date, interval '1 day') AS d
    WHERE extract(dow FROM d)::int BETWEEN 1 AND 5
  ),
  sched AS (
    SELECT cs.class_id, cs.subject_code, cs.day_of_week
    FROM public.class_schedules cs
  ),
  picks AS (
    SELECT
      st.id AS student_id,
      sd.day AS date,
      sc.subject_code
    FROM public.students st
    JOIN school_days sd ON true
    JOIN day_map dm ON dm.dow = extract(dow FROM sd.day)::int
    JOIN sched sc ON sc.class_id = st.class_id AND sc.day_of_week = dm.key
  ),
  home AS (
    SELECT ha.student_id, ha.date, ha.status
    FROM public.homeroom_attendance ha
    WHERE ha.date BETWEEN start_date AND end_date
  )
  INSERT INTO public.subject_attendance (student_id, subject_code, date, status, remarks)
  SELECT
    p.student_id,
    p.subject_code,
    p.date,
    CASE
      WHEN h.status = 'excused_absent' THEN 'excused_absent'
      WHEN h.status = 'absent' THEN 'absent'
      WHEN h.status = 'late' AND (public.hash_int(seed_tag || '|sub|' || p.student_id::text || '|' || p.subject_code || '|' || p.date::text) % 4) = 0 THEN 'late'
      ELSE 'present'
    END,
    NULL
  FROM picks p
  JOIN home h ON h.student_id = p.student_id AND h.date = p.date
  ON CONFLICT (student_id, subject_code, date) DO UPDATE
  SET status = excluded.status;

  WITH home AS (
    SELECT ha.student_id, ha.date, ha.status, ha.tap_in_time, ha.tap_out_time
    FROM public.homeroom_attendance ha
    WHERE ha.date BETWEEN start_date AND end_date
      AND ha.status IN ('present', 'late', 'partial')
  ),
  taps AS (
    SELECT
      public.uuid_from_text(seed_tag || '|tap|in|' || h.student_id::text || '|' || h.date::text) AS id,
      h.student_id,
      guard_id AS gatekeeper_id,
      'in'::text AS tap_type,
      h.tap_in_time AS timestamp,
      'ok'::text AS status,
      h.status AS remarks
    FROM home h
    WHERE h.tap_in_time IS NOT NULL

    UNION ALL

    SELECT
      public.uuid_from_text(seed_tag || '|tap|out|' || h.student_id::text || '|' || h.date::text) AS id,
      h.student_id,
      guard_id AS gatekeeper_id,
      'out'::text AS tap_type,
      h.tap_out_time AS timestamp,
      'ok'::text AS status,
      NULL::text AS remarks
    FROM home h
    WHERE h.tap_out_time IS NOT NULL
  )
  INSERT INTO public.tap_logs (id, student_id, gatekeeper_id, tap_type, timestamp, status, remarks)
  SELECT id, student_id, gatekeeper_id, tap_type, timestamp, status, remarks
  FROM taps
  ON CONFLICT (id) DO UPDATE
  SET gatekeeper_id = excluded.gatekeeper_id,
      timestamp = excluded.timestamp,
      status = excluded.status,
      remarks = excluded.remarks;

  WITH absences AS (
    SELECT ha.student_id, ha.date, st.parent_id, st.class_id
    FROM public.homeroom_attendance ha
    JOIN public.students st ON st.id = ha.student_id
    WHERE ha.date BETWEEN start_date AND end_date
      AND ha.status = 'absent'
      AND (public.hash_int(seed_tag || '|exc|' || ha.student_id::text || '|' || ha.date::text) % 20) = 0
  )
  INSERT INTO public.excuse_letters (id, student_id, parent_id, absent_date, reason, status, remarks, attachment_path, attachment_name, attachment_mime)
  SELECT
    public.uuid_from_text(seed_tag || '|excuse|' || student_id::text || '|' || date::text),
    student_id,
    parent_id,
    date,
    'Child was unwell and needed rest.',
    CASE WHEN (public.hash_int(seed_tag || '|excstat|' || student_id::text || '|' || date::text) % 3) = 0 THEN 'approved' ELSE 'pending' END,
    NULL,
    (parent_id::text || '/' || student_id::text || '/' || to_char(date, 'YYYYMMDD') || '_excuse.png'),
    'excuse.png',
    'image/png'
  FROM absences
  ON CONFLICT (id) DO UPDATE
  SET reason = excluded.reason,
      status = excluded.status,
      attachment_path = excluded.attachment_path,
      attachment_name = excluded.attachment_name,
      attachment_mime = excluded.attachment_mime;

  UPDATE public.homeroom_attendance ha
  SET status = 'excused_absent',
      remarks = 'Excuse approved'
  FROM public.excuse_letters e
  WHERE e.status = 'approved'
    AND e.student_id = ha.student_id
    AND e.absent_date = ha.date
    AND ha.date BETWEEN start_date AND end_date;

  WITH candidates AS (
    SELECT
      s.id AS student_id,
      s.class_id,
      c.homeroom_teacher_id AS issued_by,
      (end_date - (public.hash_int(seed_tag || '|clinic|' || s.id::text) % 45))::date AS d,
      public.hash_int(seed_tag || '|clinic|' || s.id::text) AS h
    FROM public.students s
    JOIN public.classes c ON c.id = s.class_id
    WHERE (public.hash_int(seed_tag || '|clinic_pick|' || s.id::text) % 25) = 0
  ),
  passes AS (
    SELECT
      public.uuid_from_text(seed_tag || '|pass|' || student_id::text || '|' || d::text) AS pass_id,
      public.uuid_from_text(seed_tag || '|visit|' || student_id::text || '|' || d::text) AS visit_id,
      student_id,
      issued_by,
      d,
      CASE WHEN (h % 2) = 0 THEN 'approved' ELSE 'pending' END AS pass_status
    FROM candidates
  )
  INSERT INTO public.clinic_visits (id, student_id, visit_time, reason, treated_by, notes, status)
  SELECT
    visit_id,
    student_id,
    (d + time '10:35')::timestamptz,
    'Headache / not feeling well',
    clinic_id,
    'Given rest and water.',
    'in_clinic'
  FROM passes
  WHERE pass_status = 'approved'
  ON CONFLICT (id) DO UPDATE
  SET treated_by = excluded.treated_by,
      notes = excluded.notes,
      status = excluded.status;

  WITH candidates AS (
    SELECT
      s.id AS student_id,
      s.class_id,
      c.homeroom_teacher_id AS issued_by,
      (end_date - (public.hash_int(seed_tag || '|clinic|' || s.id::text) % 45))::date AS d,
      public.hash_int(seed_tag || '|clinic|' || s.id::text) AS h
    FROM public.students s
    JOIN public.classes c ON c.id = s.class_id
    WHERE (public.hash_int(seed_tag || '|clinic_pick|' || s.id::text) % 25) = 0
  ),
  passes AS (
    SELECT
      public.uuid_from_text(seed_tag || '|pass|' || student_id::text || '|' || d::text) AS pass_id,
      public.uuid_from_text(seed_tag || '|visit|' || student_id::text || '|' || d::text) AS visit_id,
      student_id,
      issued_by,
      d,
      CASE WHEN (h % 2) = 0 THEN 'approved' ELSE 'pending' END AS pass_status
    FROM candidates
  )
  INSERT INTO public.clinic_passes (id, student_id, clinic_visit_id, issued_by, reason, status, issued_at)
  SELECT
    pass_id,
    student_id,
    CASE WHEN pass_status = 'approved' THEN visit_id ELSE NULL END,
    issued_by,
    'Headache / not feeling well',
    pass_status,
    (d + time '10:15')::timestamptz
  FROM passes
  ON CONFLICT (id) DO UPDATE
  SET status = excluded.status,
      clinic_visit_id = excluded.clinic_visit_id,
      issued_at = excluded.issued_at;

  WITH per_class AS (
    SELECT
      c.id AS class_id,
      c.homeroom_teacher_id AS teacher_id,
      ('Class Update - ' || c.room) AS title,
      ('Reminder: Please check the weekly tasks for ' || c.grade_level || coalesce(' (' || c.strand || ')', '') || '.') AS body
    FROM public.classes c
    WHERE c.is_active = true
  )
  INSERT INTO public.announcements (id, title, body, audience_teachers, audience_parents, audience_staff, created_by, class_id, created_at)
  SELECT
    public.uuid_from_text(seed_tag || '|ann|class|' || class_id::text),
    title,
    body,
    false,
    true,
    false,
    teacher_id,
    class_id,
    (end_date::timestamp - interval '3 days')::timestamptz
  FROM per_class
  ON CONFLICT (id) DO UPDATE
  SET title = excluded.title,
      body = excluded.body,
      created_by = excluded.created_by,
      class_id = excluded.class_id;

  INSERT INTO public.announcements (id, title, body, audience_teachers, audience_parents, audience_staff, created_by, class_id, created_at)
  VALUES
    (public.uuid_from_text(seed_tag || '|ann|global|1'), 'School Advisory', 'Classes resume as scheduled. Please monitor announcements.', false, true, true, admin_id, NULL, (end_date::timestamp - interval '5 days')::timestamptz),
    (public.uuid_from_text(seed_tag || '|ann|parent|1'), 'Parent Reminder', 'Please ensure students bring their IDs daily.', false, true, false, admin_id, NULL, (end_date::timestamp - interval '10 days')::timestamptz)
  ON CONFLICT (id) DO UPDATE
  SET title = excluded.title,
      body = excluded.body,
      created_by = excluded.created_by,
      class_id = excluded.class_id;

  WITH class_parents AS (
    SELECT DISTINCT s.class_id, s.parent_id
    FROM public.students s
    WHERE s.parent_id IS NOT NULL
  ),
  ann AS (
    SELECT a.id AS announcement_id, a.class_id, a.title, a.created_by
    FROM public.announcements a
    WHERE a.class_id IS NOT NULL
  )
  INSERT INTO public.notifications (id, recipient_id, actor_id, verb, object, read, created_at)
  SELECT
    public.uuid_from_text(seed_tag || '|notif|ann|' || cp.parent_id::text || '|' || a.announcement_id::text),
    cp.parent_id,
    a.created_by,
    'announcement',
    jsonb_build_object('announcement_id', a.announcement_id, 'class_id', a.class_id, 'title', a.title),
    false,
    (end_date::timestamp - interval '3 days')::timestamptz
  FROM class_parents cp
  JOIN ann a ON a.class_id = cp.class_id
  ON CONFLICT (id) DO UPDATE
  SET object = excluded.object,
      created_at = excluded.created_at;

  WITH recent_days AS (
    SELECT (end_date - i)::date AS day
    FROM generate_series(0, 6) AS i
  ),
  taps AS (
    SELECT
      s.parent_id,
      s.id AS student_id,
      d.day,
      public.hash_int(seed_tag || '|tapnotif|' || s.id::text || '|' || d.day::text) AS h
    FROM public.students s
    JOIN recent_days d ON true
  )
  INSERT INTO public.notifications (id, recipient_id, actor_id, verb, object, read, created_at)
  SELECT
    public.uuid_from_text(seed_tag || '|notif|tap|' || parent_id::text || '|' || student_id::text || '|' || day::text),
    parent_id,
    guard_id,
    CASE WHEN (h % 2) = 0 THEN 'tap_in' ELSE 'tap_out' END,
    jsonb_build_object('student_id', student_id, 'timestamp', (day + time '07:45')::timestamptz),
    false,
    (day + time '17:00')::timestamptz
  FROM taps
  WHERE parent_id IS NOT NULL
  ON CONFLICT (id) DO NOTHING;

END;
$$;
