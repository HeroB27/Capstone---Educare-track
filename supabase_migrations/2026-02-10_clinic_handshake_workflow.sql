-- Clinic Handshake Workflow Enhancement
-- Complete implementation of the Clinic-Teacher-Parent notification chain

-- ==================== CLINIC TABLE ENHANCEMENTS ====================

-- Add additional fields to clinic_visits for complete workflow tracking
ALTER TABLE public.clinic_visits 
ADD COLUMN IF NOT EXISTS entry_timestamp timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS exit_timestamp timestamptz,
ADD COLUMN IF NOT EXISTS symptoms text,
ADD COLUMN IF NOT EXISTS diagnosis text,
ADD COLUMN IF NOT EXISTS treatment_notes text,
ADD COLUMN IF NOT EXISTS follow_up_required boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS teacher_approved boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS teacher_approval_timestamp timestamptz,
ADD COLUMN IF NOT EXISTS parent_notified boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS parent_notification_timestamp timestamptz,
ADD COLUMN IF NOT EXISTS visit_type text DEFAULT 'regular' CHECK (visit_type IN ('regular', 'emergency', 'follow_up')),
ADD COLUMN IF NOT EXISTS severity text CHECK (severity IN ('mild', 'moderate', 'severe')),
ADD COLUMN IF NOT EXISTS action_taken text CHECK (action_taken IN ('rest', 'medication', 'sent_home', 'referred', 'hospitalized'));

-- Add additional fields to clinic_passes for better tracking
ALTER TABLE public.clinic_passes 
ADD COLUMN IF NOT EXISTS pass_type text DEFAULT 'regular' CHECK (pass_type IN ('regular', 'emergency')),
ADD COLUMN IF NOT EXISTS urgency text CHECK (urgency IN ('low', 'medium', 'high')),
ADD COLUMN IF NOT EXISTS teacher_notes text;

-- Update clinic_visits status to include complete workflow states
ALTER TABLE public.clinic_visits 
DROP CONSTRAINT IF EXISTS clinic_visits_status_check;

ALTER TABLE public.clinic_visits
ADD CONSTRAINT clinic_visits_status_check 
CHECK (status IN ('pending', 'in_clinic', 'treated', 'teacher_approval', 'parent_notified', 'completed', 'referred', 'sent_home'));

-- ==================== NOTIFICATION VERBS ENHANCEMENT ====================

-- Add comprehensive notification verbs for the handshake workflow
INSERT INTO public.system_settings (key, value) 
VALUES 
('notification_verbs', '{
  "CLINIC_PASS_CREATED": "CLINIC_PASS_CREATED",
  "CLINIC_PASS_APPROVED": "CLINIC_PASS_APPROVED", 
  "CLINIC_PASS_REJECTED": "CLINIC_PASS_REJECTED",
  "CLINIC_ARRIVAL": "CLINIC_ARRIVAL",
  "CLINIC_FINDINGS_READY": "CLINIC_FINDINGS_READY",
  "CLINIC_TEACHER_APPROVAL": "CLINIC_TEACHER_APPROVAL",
  "CLINIC_PARENT_NOTIFICATION": "CLINIC_PARENT_NOTIFICATION",
  "CLINIC_SENT_HOME": "CLINIC_SENT_HOME",
  "CLINIC_RETURNED_CLASS": "CLINIC_RETURNED_CLASS",
  "CLINIC_FOLLOW_UP": "CLINIC_FOLLOW_UP"
}'::jsonb)
ON CONFLICT (key) DO UPDATE 
SET value = EXCLUDED.value;

-- ==================== FUNCTIONS FOR HANDLING WORKFLOW ====================

-- Function to create clinic visit with complete workflow
CREATE OR REPLACE FUNCTION public.create_clinic_visit_with_workflow(
  p_student_id uuid,
  p_reason text,
  p_clinic_staff_id uuid,
  p_symptoms text DEFAULT NULL,
  p_severity text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_visit_id uuid;
  v_parent_id uuid;
  v_teacher_id uuid;
BEGIN
  -- Get student's parent and teacher info
  SELECT parent_id INTO v_parent_id FROM public.students WHERE id = p_student_id;
  SELECT homeroom_teacher_id INTO v_teacher_id 
  FROM public.students s 
  JOIN public.classes c ON s.class_id = c.id 
  WHERE s.id = p_student_id;

  -- Create clinic visit
  INSERT INTO public.clinic_visits (
    student_id, 
    reason, 
    treated_by, 
    symptoms, 
    severity,
    status,
    entry_timestamp
  )
  VALUES (
    p_student_id, 
    p_reason, 
    p_clinic_staff_id, 
    p_symptoms, 
    p_severity,
    'in_clinic',
    now()
  )
  RETURNING id INTO v_visit_id;

  -- Notify teacher about clinic arrival
  IF v_teacher_id IS NOT NULL THEN
    INSERT INTO public.notifications (
      recipient_id, 
      actor_id, 
      verb, 
      object
    )
    VALUES (
      v_teacher_id, 
      p_clinic_staff_id, 
      'CLINIC_ARRIVAL', 
      jsonb_build_object(
        'student_id', p_student_id,
        'clinic_visit_id', v_visit_id,
        'reason', p_reason,
        'timestamp', now()
      )
    );
  END IF;

  -- Notify parent about clinic arrival
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO public.notifications (
      recipient_id, 
      actor_id, 
      verb, 
      object
    )
    VALUES (
      v_parent_id, 
      p_clinic_staff_id, 
      'CLINIC_ARRIVAL', 
      jsonb_build_object(
        'student_id', p_student_id,
        'clinic_visit_id', v_visit_id,
        'reason', p_reason,
        'timestamp', now()
      )
    );
  END IF;

  RETURN v_visit_id;
END;
$$;

-- Function to update clinic findings and request teacher approval
CREATE OR REPLACE FUNCTION public.update_clinic_findings(
  p_visit_id uuid,
  p_clinic_staff_id uuid,
  p_diagnosis text,
  p_treatment_notes text,
  p_follow_up_required boolean,
  p_action_taken text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_student_id uuid;
  v_teacher_id uuid;
  v_parent_id uuid;
BEGIN
  -- Get student and teacher info
  SELECT student_id INTO v_student_id FROM public.clinic_visits WHERE id = p_visit_id;
  SELECT homeroom_teacher_id INTO v_teacher_id 
  FROM public.students s 
  JOIN public.classes c ON s.class_id = c.id 
  WHERE s.id = v_student_id;
  
  SELECT parent_id INTO v_parent_id FROM public.students WHERE id = v_student_id;

  -- Update clinic findings
  UPDATE public.clinic_visits
  SET 
    diagnosis = p_diagnosis,
    treatment_notes = p_treatment_notes,
    follow_up_required = p_follow_up_required,
    action_taken = p_action_taken,
    status = 'treated',
    treated_by = p_clinic_staff_id
  WHERE id = p_visit_id;

  -- Request teacher approval for action
  IF v_teacher_id IS NOT NULL THEN
    INSERT INTO public.notifications (
      recipient_id, 
      actor_id, 
      verb, 
      object
    )
    VALUES (
      v_teacher_id, 
      p_clinic_staff_id, 
      'CLINIC_TEACHER_APPROVAL', 
      jsonb_build_object(
        'student_id', v_student_id,
        'clinic_visit_id', p_visit_id,
        'diagnosis', p_diagnosis,
        'action_taken', p_action_taken,
        'timestamp', now()
      )
    );

    -- Update status to await teacher approval
    UPDATE public.clinic_visits
    SET status = 'teacher_approval'
    WHERE id = p_visit_id;
  END IF;

  -- If no teacher approval needed, notify parent directly
  IF v_teacher_id IS NULL AND v_parent_id IS NOT NULL THEN
    INSERT INTO public.notifications (
      recipient_id, 
      actor_id, 
      verb, 
      object
    )
    VALUES (
      v_parent_id, 
      p_clinic_staff_id, 
      'CLINIC_PARENT_NOTIFICATION', 
      jsonb_build_object(
        'student_id', v_student_id,
        'clinic_visit_id', p_visit_id,
        'diagnosis', p_diagnosis,
        'action_taken', p_action_taken,
        'timestamp', now()
      )
    );

    UPDATE public.clinic_visits
    SET 
      parent_notified = true,
      parent_notification_timestamp = now(),
      status = 'parent_notified'
    WHERE id = p_visit_id;
  END IF;
END;
$$;

-- Function for teacher to approve clinic action
CREATE OR REPLACE FUNCTION public.teacher_approve_clinic_action(
  p_visit_id uuid,
  p_teacher_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_student_id uuid;
  v_parent_id uuid;
  v_clinic_staff_id uuid;
  v_action_taken text;
  v_diagnosis text;
BEGIN
  -- Get visit information
  SELECT student_id, treated_by, action_taken, diagnosis 
  INTO v_student_id, v_clinic_staff_id, v_action_taken, v_diagnosis
  FROM public.clinic_visits 
  WHERE id = p_visit_id;
  
  SELECT parent_id INTO v_parent_id FROM public.students WHERE id = v_student_id;

  -- Update teacher approval
  UPDATE public.clinic_visits
  SET 
    teacher_approved = true,
    teacher_approval_timestamp = now()
  WHERE id = p_visit_id;

  -- Notify parent based on action taken
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO public.notifications (
      recipient_id, 
      actor_id, 
      verb, 
      object
    )
    VALUES (
      v_parent_id, 
      p_teacher_id, 
      'CLINIC_PARENT_NOTIFICATION', 
      jsonb_build_object(
        'student_id', v_student_id,
        'clinic_visit_id', p_visit_id,
        'diagnosis', v_diagnosis,
        'action_taken', v_action_taken,
        'approved_by_teacher', true,
        'timestamp', now()
      )
    );
  END IF;

  -- Notify clinic staff of approval
  IF v_clinic_staff_id IS NOT NULL THEN
    INSERT INTO public.notifications (
      recipient_id, 
      actor_id, 
      verb, 
      object
    )
    VALUES (
      v_clinic_staff_id, 
      p_teacher_id, 
      'CLINIC_TEACHER_APPROVAL_CONFIRMED', 
      jsonb_build_object(
        'student_id', v_student_id,
        'clinic_visit_id', p_visit_id,
        'timestamp', now()
      )
    );
  END IF;

  -- Update final status
  UPDATE public.clinic_visits
  SET status = 'parent_notified'
  WHERE id = p_visit_id;
END;
$$;

-- Function to complete clinic visit with final action
CREATE OR REPLACE FUNCTION public.complete_clinic_visit(
  p_visit_id uuid,
  p_clinic_staff_id uuid,
  p_final_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_student_id uuid;
  v_parent_id uuid;
  v_teacher_id uuid;
  v_action_taken text;
BEGIN
  -- Get visit information
  SELECT student_id, action_taken INTO v_student_id, v_action_taken
  FROM public.clinic_visits WHERE id = p_visit_id;
  
  SELECT parent_id INTO v_parent_id FROM public.students WHERE id = v_student_id;
  SELECT homeroom_teacher_id INTO v_teacher_id 
  FROM public.students s 
  JOIN public.classes c ON s.class_id = c.id 
  WHERE s.id = v_student_id;

  -- Update exit timestamp and final status
  UPDATE public.clinic_visits
  SET 
    exit_timestamp = now(),
    status = p_final_status
  WHERE id = p_visit_id;

  -- Send final notification based on action
  IF p_final_status = 'sent_home' THEN
    -- Notify parent student was sent home
    IF v_parent_id IS NOT NULL THEN
      INSERT INTO public.notifications (
        recipient_id, 
        actor_id, 
        verb, 
        object
      )
      VALUES (
        v_parent_id, 
        p_clinic_staff_id, 
        'CLINIC_SENT_HOME', 
        jsonb_build_object(
          'student_id', v_student_id,
          'clinic_visit_id', p_visit_id,
          'action_taken', v_action_taken,
          'timestamp', now()
        )
      );
    END IF;
    
    -- Notify teacher student was sent home
    IF v_teacher_id IS NOT NULL THEN
      INSERT INTO public.notifications (
        recipient_id, 
        actor_id, 
        verb, 
        object
      )
      VALUES (
        v_teacher_id, 
        p_clinic_staff_id, 
        'CLINIC_SENT_HOME', 
        jsonb_build_object(
          'student_id', v_student_id,
          'clinic_visit_id', p_visit_id,
          'action_taken', v_action_taken,
          'timestamp', now()
        )
      );
    END IF;
  
  ELSIF p_final_status = 'completed' THEN
    -- Notify parent student returned to class
    IF v_parent_id IS NOT NULL THEN
      INSERT INTO public.notifications (
        recipient_id, 
        actor_id, 
        verb, 
        object
      )
      VALUES (
        v_parent_id, 
        p_clinic_staff_id, 
        'CLINIC_RETURNED_CLASS', 
        jsonb_buildObject(
          'student_id', v_student_id,
          'clinic_visit_id', p_visit_id,
          'timestamp', now()
        )
      );
    END IF;
  END IF;

  -- Update student status
  UPDATE public.students
  SET current_status = CASE 
    WHEN p_final_status = 'sent_home' THEN 'out' 
    ELSE 'in' 
  END
  WHERE id = v_student_id;
END;
$$;

-- ==================== RLS POLICIES FOR CLINIC WORKFLOW ====================

-- Clinic staff can manage clinic visits
DROP POLICY IF EXISTS "clinic_staff_manage_visits" ON public.clinic_visits;
CREATE POLICY "clinic_staff_manage_visits" ON public.clinic_visits
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'clinic'
  )
);

-- Teachers can view their students' clinic visits
DROP POLICY IF EXISTS "teachers_view_student_clinic_visits" ON public.clinic_visits;
CREATE POLICY "teachers_view_student_clinic_visits" ON public.clinic_visits
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.students s
    JOIN public.classes c ON s.class_id = c.id
    WHERE s.id = clinic_visits.student_id
    AND c.homeroom_teacher_id = auth.uid()
  )
);

-- Parents can view their children's clinic visits
DROP POLICY IF EXISTS "parents_view_child_clinic_visits" ON public.clinic_visits;
CREATE POLICY "parents_view_child_clinic_visits" ON public.clinic_visits
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.students 
    WHERE id = clinic_visits.student_id
    AND parent_id = auth.uid()
  )
);

-- Grant execute permissions on workflow functions
GRANT EXECUTE ON FUNCTION public.create_clinic_visit_with_workflow TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_clinic_findings TO authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_approve_clinic_action TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_clinic_visit TO authenticated;

-- ==================== INDEXES FOR PERFORMANCE ====================

CREATE INDEX IF NOT EXISTS idx_clinic_visits_student_status ON public.clinic_visits(student_id, status);
CREATE INDEX IF NOT EXISTS idx_clinic_visits_entry_time ON public.clinic_visits(entry_timestamp);
CREATE INDEX IF NOT EXISTS idx_clinic_visits_teacher_approved ON public.clinic_visits(teacher_approved);
CREATE INDEX IF NOT EXISTS idx_clinic_visits_parent_notified ON public.clinic_visits(parent_notified);

-- Enable realtime for clinic visits (already enabled in previous migration)
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.clinic_visits;