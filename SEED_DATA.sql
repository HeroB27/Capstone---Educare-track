-- ==========================================
-- EDUCARE TRACK - FINAL SAMPLE DATA SEED SCRIPT
-- ==========================================

DO $$
DECLARE
    -- Constants
    curr_year text := '2026';
    
    -- IDs for reference
    admin_id uuid := gen_random_uuid();
    guard1_id uuid := gen_random_uuid();
    guard2_id uuid := gen_random_uuid();
    clinic1_id uuid := gen_random_uuid();
    clinic2_id uuid := gen_random_uuid();
    
    -- Arrays for bulk generation
    first_names text[] := ARRAY['Juan', 'Maria', 'Jose', 'Elena', 'Ricardo', 'Liza', 'Antonio', 'Teresita', 'Gabriel', 'Carmelita', 'Mateo', 'Angelita', 'Dominador', 'Priscila', 'Ramon', 'Imelda', 'Felipe', 'Corazon', 'Emilio', 'Lourdes'];
    last_names text[] := ARRAY['Pascua', 'Bautista', 'Cariño', 'Domogan', 'Molintas', 'Fianza', 'Aliping', 'Cosalan', 'Vergara', 'Mauricio', 'Tabora', 'Bugnosen', 'Hamada', 'Okubo', 'Bello', 'Perez', 'Garcia', 'Dimalanta', 'Santos', 'Reyes'];
    
    teacher_ids uuid[] := '{}';
    parent_ids uuid[] := '{}';
    student_ids text[] := '{}';
    
    -- Grade Levels & Classes
    grade_levels text[] := ARRAY['Kinder', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
    strands text[] := ARRAY['ABM', 'STEM', 'HUMSS', 'ICT'];
    
    current_teacher_id uuid;
    current_parent_id uuid;
    current_student_id text;
    current_custom_id text;
    
    i int;
    j int;
    k int;
    s int;
    
    -- Attendance variables
    start_date date := '2025-11-01';
    end_date date := '2026-02-02';
    curr_date date;
    rand_status text;
    rand_val float;
    
    -- Rule variables
    rule_in time;
    rule_dismissal time;
BEGIN
    -- 1. ADMIN STAFF
    current_custom_id := 'ADM-' || curr_year || '-4321-' || upper(substring(md5(random()::text) from 1 for 4));
    INSERT INTO public.profiles (id, custom_id, full_name, email, role, username)
    VALUES (admin_id, current_custom_id, 'Super Admin', 'admin@educare.edu', 'admin', 'admin');
    
    INSERT INTO public.admin_staff (id, position)
    VALUES (admin_id, 'School Principal');

    -- 2. GUARDS & CLINIC STAFF
    -- Guards
    current_custom_id := 'GRD-' || curr_year || '-1111-' || upper(substring(md5(random()::text) from 1 for 4));
    INSERT INTO public.profiles (id, custom_id, full_name, email, role, username) 
    VALUES (guard1_id, current_custom_id, 'Guard Ricardo Dimalanta', 'guard1@educare.edu', 'guard', 'guard1');
    
    current_custom_id := 'GRD-' || curr_year || '-2222-' || upper(substring(md5(random()::text) from 1 for 4));
    INSERT INTO public.profiles (id, custom_id, full_name, email, role, username) 
    VALUES (guard2_id, current_custom_id, 'Guard Antonio Santos', 'guard2@educare.edu', 'guard', 'guard2');
    
    INSERT INTO public.guards (id, shift, assigned_gate) VALUES 
    (guard1_id, 'Day', 'Main Entrance'),
    (guard2_id, 'Night', 'South Gate');

    -- Clinic Staff
    current_custom_id := 'CLC-' || curr_year || '-3333-' || upper(substring(md5(random()::text) from 1 for 4));
    INSERT INTO public.profiles (id, custom_id, full_name, email, role, username) 
    VALUES (clinic1_id, current_custom_id, 'Nurse Teresita Garcia', 'nurse1@educare.edu', 'clinic', 'nurse1');
    
    current_custom_id := 'CLC-' || curr_year || '-4444-' || upper(substring(md5(random()::text) from 1 for 4));
    INSERT INTO public.profiles (id, custom_id, full_name, email, role, username) 
    VALUES (clinic2_id, current_custom_id, 'Nurse Maria Pascua', 'nurse2@educare.edu', 'clinic', 'nurse2');
    
    INSERT INTO public.clinic_staff (id, license_no, position) VALUES 
    (clinic1_id, 'RN-2026-001', 'Senior Nurse'),
    (clinic2_id, 'RN-2026-002', 'Junior Nurse');

    -- 3. TEACHERS (30)
    FOR i IN 1..30 LOOP
        current_teacher_id := gen_random_uuid();
        teacher_ids := array_append(teacher_ids, current_teacher_id);
        current_custom_id := 'TCH-' || curr_year || '-' || (5000 + i)::text || '-' || upper(substring(md5(random()::text) from 1 for 4));
        
        INSERT INTO public.profiles (id, custom_id, full_name, email, role, username)
        VALUES (
            current_teacher_id, 
            current_custom_id,
            first_names[(i % 20) + 1] || ' ' || last_names[(i % 20) + 1], 
            'teacher' || i || '@educare.edu', 
            'teacher', 
            'teacher' || i
        );
        
        INSERT INTO public.teachers (id, employee_no, is_homeroom, is_gatekeeper)
        VALUES (
            current_teacher_id, 
            'EMP-' || (2026000 + i), 
            CASE WHEN i <= 15 THEN true ELSE false END,
            CASE WHEN i > 27 THEN true ELSE false END
        );
    END LOOP;

    -- 4. ATTENDANCE RULES (Specific Times)
    INSERT INTO public.attendance_rules (grade_level, in_start, grace_until, late_until, dismissal_time) VALUES
    ('Kinder', '07:30:00', '08:00:00', '08:30:00', '11:30:00'),
    ('1', '07:30:00', '07:45:00', '08:15:00', '13:00:00'),
    ('2', '07:30:00', '07:45:00', '08:15:00', '13:00:00'),
    ('3', '07:30:00', '07:45:00', '08:15:00', '13:00:00'),
    ('4', '07:30:00', '07:45:00', '08:15:00', '15:00:00'),
    ('5', '07:30:00', '07:45:00', '08:15:00', '15:00:00'),
    ('6', '07:30:00', '07:45:00', '08:15:00', '15:00:00'),
    ('7', '07:30:00', '07:45:00', '08:15:00', '16:00:00'),
    ('8', '07:30:00', '07:45:00', '08:15:00', '16:00:00'),
    ('9', '07:30:00', '07:45:00', '08:15:00', '16:00:00'),
    ('10', '07:30:00', '07:45:00', '08:15:00', '16:00:00'),
    ('11', '07:30:00', '07:45:00', '08:15:00', '16:30:00'),
    ('12', '07:30:00', '07:45:00', '08:15:00', '16:30:00');

    -- 5. SUBJECTS
    -- Kinder
    INSERT INTO public.subjects (code, name, grade_level, type, description) VALUES
    ('K-LANG', 'Language & Literacy', 'Kinder', 'core', 'Basic communication skills'),
    ('K-MATH', 'Early Numeracy', 'Kinder', 'core', 'Numbers and shapes');
    
    -- Grade 1-10
    FOR i IN 1..10 LOOP
        INSERT INTO public.subjects (code, name, grade_level, type) VALUES
        ('MATH-' || i, 'Mathematics ' || i, i::text, 'core'),
        ('SCI-' || i, 'Science ' || i, i::text, 'core'),
        ('ENG-' || i, 'English ' || i, i::text, 'core');
    END LOOP;

    -- SHS (11-12)
    FOR i IN 11..12 LOOP
        FOREACH current_custom_id IN ARRAY strands LOOP
            INSERT INTO public.subjects (code, name, grade_level, strand, type) VALUES
            (current_custom_id || '-' || i || '-CORE', 'Core Subject ' || i, i::text, current_custom_id, 'core'),
            (current_custom_id || '-' || i || '-SPEC', 'Specialized ' || current_custom_id || ' ' || i, i::text, current_custom_id, 'specialization');
        END LOOP;
    END LOOP;

    -- 6. CLASSES (No sections, as per rule)
    FOR i IN 1..array_length(grade_levels, 1) LOOP
        IF grade_levels[i] IN ('11', '12') THEN
            FOREACH current_custom_id IN ARRAY strands LOOP
                INSERT INTO public.classes (id, grade, strand, adviser_id, level)
                VALUES (grade_levels[i] || '-' || current_custom_id, grade_levels[i], current_custom_id, teacher_ids[i], 'SHS');
            END LOOP;
        ELSE
            INSERT INTO public.classes (id, grade, adviser_id, level)
            VALUES (grade_levels[i], grade_levels[i], teacher_ids[i], CASE WHEN grade_levels[i] = 'Kinder' THEN 'Kinder' ELSE 'Elementary' END);
        END IF;
    END LOOP;

    -- 7. PARENTS & STUDENTS (EDU-YYYY-LLLL-XXXX)
    FOR i IN 1..30 LOOP
        current_parent_id := gen_random_uuid();
        parent_ids := array_append(parent_ids, current_parent_id);
        current_custom_id := 'PAR-' || curr_year || '-' || (9000 + i)::text || '-' || upper(substring(md5(random()::text) from 1 for 4));
        
        INSERT INTO public.profiles (id, custom_id, full_name, email, role, username)
        VALUES (current_parent_id, current_custom_id, 'Parent ' || first_names[i % 20 + 1], 'parent' || i || '@email.com', 'parent', 'parent' || i);
        
        INSERT INTO public.parents (id, address) VALUES (current_parent_id, 'Irisan, Baguio City');
        
        -- 2 Students per parent
        FOR j IN 1..2 LOOP
            current_student_id := 'EDU-' || curr_year || '-' || (1000 + i*2 + j)::text || '-' || upper(substring(md5(random()::text) from 1 for 4));
            student_ids := array_append(student_ids, current_student_id);
            
            INSERT INTO public.students (id, lrn, full_name, dob, gender, grade_level, class_id, address)
            VALUES (
                current_student_id,
                'LRN' || (1000000 + i*2 + j),
                first_names[(i+j) % 20 + 1] || ' ' || last_names[(i*j) % 20 + 1],
                '2015-01-01'::date + (i || ' days')::interval,
                CASE WHEN j = 1 THEN 'Male' ELSE 'Female' END,
                grade_levels[(i % 13) + 1],
                CASE 
                    WHEN grade_levels[(i % 13) + 1] IN ('11', '12') THEN grade_levels[(i % 13) + 1] || '-' || strands[(j % 4) + 1]
                    ELSE grade_levels[(i % 13) + 1]
                END,
                'Irisan, Baguio City'
            );
            
            INSERT INTO public.parent_students (parent_id, student_id, relationship)
            VALUES (current_parent_id, current_student_id, 'Parent');
            
            INSERT INTO public.qr_codes (student_id, qr_hash, created_by)
            VALUES (current_student_id, current_student_id, admin_id);
        END LOOP;
    END LOOP;

    -- 8. BULK ATTENDANCE (Complex Logic)
    curr_date := start_date;
    WHILE curr_date <= end_date LOOP
        IF extract(dow from curr_date) BETWEEN 1 AND 5 THEN
            FOREACH current_student_id IN ARRAY student_ids LOOP
                -- Get rules for this student
                SELECT in_start, dismissal_time INTO rule_in, rule_dismissal
                FROM public.attendance_rules r
                JOIN public.students s ON s.grade_level = r.grade_level
                WHERE s.id = current_student_id;
                
                rand_val := random();
                
                IF rand_val < 0.80 THEN -- Normal On-Time
                    INSERT INTO public.attendance (student_id, date, status, timestamp, method, entry_type, recorded_by, remarks)
                    VALUES (current_student_id, curr_date, 'present', (curr_date || ' ' || (rule_in - interval '10 minutes'))::timestamptz, 'qr', 'entry', guard1_id, 'On time');
                    
                    -- Tap out
                    INSERT INTO public.attendance (student_id, date, status, timestamp, method, entry_type, recorded_by, remarks)
                    VALUES (current_student_id, curr_date, 'present', (curr_date || ' ' || (rule_dismissal + interval '5 minutes'))::timestamptz, 'qr', 'exit', guard1_id, 'Normal exit');
                
                ELSIF rand_val < 0.90 THEN -- Late Entry
                    INSERT INTO public.attendance (student_id, date, status, timestamp, method, entry_type, recorded_by, remarks)
                    VALUES (current_student_id, curr_date, 'late', (curr_date || ' ' || (rule_in + interval '20 minutes'))::timestamptz, 'qr', 'entry', guard1_id, 'Late entry');
                
                ELSIF rand_val < 0.95 THEN -- Early Exit
                    INSERT INTO public.attendance (student_id, date, status, timestamp, method, entry_type, recorded_by, remarks)
                    VALUES (current_student_id, curr_date, 'present', (curr_date || ' ' || (rule_dismissal - interval '1 hour'))::timestamptz, 'qr', 'exit', guard1_id, 'Early dismissal');
                
                ELSE -- Absent
                    INSERT INTO public.attendance (student_id, date, status, timestamp, method, entry_type, recorded_by, remarks)
                    VALUES (current_student_id, curr_date, 'absent', (curr_date || ' 00:00:00')::timestamptz, 'none', 'none', admin_id, 'No scan');
                END IF;
            END LOOP;
        END IF;
        curr_date := curr_date + interval '1 day';
    END LOOP;

    -- 9. EXTRA DATA
    -- Announcements
    INSERT INTO public.announcements (title, content, audience, posted_by)
    VALUES ('School Reset', 'The system has been reset for the final version.', ARRAY['admin', 'teacher', 'parent'], admin_id);

    -- Sample Clinic Visits during the history period
    INSERT INTO public.clinic_visits (student_id, reason, treated_by, notes, status, visit_time)
    SELECT 
        id, 
        'Headache and Fever', 
        clinic1_id, 
        'Patient given paracetamol and advised to rest.', 
        'released',
        '2025-12-05 10:30:00'::timestamptz
    FROM public.students LIMIT 3;

    -- Sample Excuse Letters during the history period
    INSERT INTO public.excuse_letters (student_id, parent_id, absent_date, reason, status, remarks)
    SELECT 
        s.id, 
        ps.parent_id, 
        '2025-11-15'::date, 
        'Family emergency', 
        'approved', 
        'Valid reason'
    FROM public.students s
    JOIN public.parent_students ps ON ps.student_id = s.id
    LIMIT 5;

    INSERT INTO public.system_settings (key, value)
    VALUES ('school_info', '{"name": "Educare Colleges Inc", "address": "Purok 4 Irisan Baguio City"}'::jsonb);

END $$;
