-- Migration: Implement Attendance Engine (Trigger-based)
-- 1. Create function to process raw events
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
    -- 1. Get Event Details
    today_date := NEW.timestamp::date;
    event_time := NEW.timestamp::time;

    -- 2. Get Student Info (Grade, Name, Parent)
    SELECT s.grade_level, s.full_name, ps.parent_id
    INTO student_grade, student_name, parent_uid
    FROM public.students s
    LEFT JOIN public.parent_students ps ON ps.student_id = s.id
    WHERE s.id = NEW.student_id;

    -- 3. Get Attendance Rules (Default to 7:30 AM if no rule found)
    SELECT grace_until, late_until INTO rule_grace_time, rule_late_time
    FROM public.attendance_rules
    WHERE grade_level = student_grade;

    IF rule_grace_time IS NULL THEN rule_grace_time := '07:30:00'; END IF;
    IF rule_late_time IS NULL THEN rule_late_time := '08:30:00'; END IF;

    -- 4. Determine Status based on Event Type
    IF NEW.event_type = 'IN' THEN
        -- Check if there is already an attendance record for today
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

        -- Upsert into attendance
        IF existing_status IS NULL THEN
            INSERT INTO public.attendance (
                student_id, status, timestamp, method, entry_type, recorded_by, remarks
            ) VALUES (
                NEW.student_id, new_status, NEW.timestamp, 'qr', 'entry', NEW.recorded_by, new_remarks
            );
        END IF;

        notif_verb := 'attendance_entry';
        notif_object := jsonb_build_object('student_name', student_name, 'time', NEW.timestamp, 'status', new_status);

        -- Update Student Status
        UPDATE public.students SET current_status = 'in' WHERE id = NEW.student_id;

    ELSIF NEW.event_type = 'OUT' THEN
        -- Handle OUT scan
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

        -- Update Student Status
        UPDATE public.students SET current_status = 'out' WHERE id = NEW.student_id;
    END IF;

    -- 6. Insert Notification if parent exists
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

-- 2. Create Trigger
DROP TRIGGER IF EXISTS trg_process_attendance_event ON public.attendance_events;

CREATE TRIGGER trg_process_attendance_event
AFTER INSERT ON public.attendance_events
FOR EACH ROW
EXECUTE FUNCTION public.process_attendance_event();

-- 3. Add Dummy Data for Testing
INSERT INTO public.attendance_rules (grade_level, in_start, grace_until, late_until)
VALUES 
    ('11', '06:00:00', '07:30:00', '08:30:00'),
    ('12', '06:00:00', '07:30:00', '08:30:00')
ON CONFLICT (grade_level) DO NOTHING;
