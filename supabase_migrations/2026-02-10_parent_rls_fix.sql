-- Parent RLS Policies - Simplified and Secure
-- Adds essential RLS policies for parent access without over-engineering

-- ==================== MISSING TABLES ====================

-- Scanners table for gatekeeper scanning locations (optional)
CREATE TABLE IF NOT EXISTS public.scanners (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    location text NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Enable RLS on scanners table
ALTER TABLE public.scanners ENABLE ROW LEVEL SECURITY;

-- ==================== ESSENTIAL RLS POLICIES ====================

-- Classes RLS - Parents can view their child's class information
DROP POLICY IF EXISTS "classes_parent_select" ON public.classes;
CREATE POLICY "classes_parent_select" ON public.classes
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.students s 
            WHERE s.class_id = classes.id 
            AND s.parent_id = auth.uid()
        )
    );

-- Student IDs RLS - Parents can view their child's ID information
DROP POLICY IF EXISTS "student_ids_parent_select" ON public.student_ids;
CREATE POLICY "student_ids_parent_select" ON public.student_ids
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.students s 
            WHERE s.id = student_ids.student_id 
            AND s.parent_id = auth.uid()
        )
    );

-- Tap Logs RLS - Parents can view their child's tap logs
DROP POLICY IF EXISTS "tap_logs_parent_select" ON public.tap_logs;
CREATE POLICY "tap_logs_parent_select" ON public.tap_logs
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.students s 
            WHERE s.id = tap_logs.student_id 
            AND s.parent_id = auth.uid()
        )
    );

-- Clinic Visits RLS - Parents can view their child's clinic visits
DROP POLICY IF EXISTS "clinic_visits_parent_select" ON public.clinic_visits;
CREATE POLICY "clinic_visits_parent_select" ON public.clinic_visits
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.students s 
            WHERE s.id = clinic_visits.student_id 
            AND s.parent_id = auth.uid()
        )
    );

-- Homeroom Attendance RLS - Parents can view their child's attendance
DROP POLICY IF EXISTS "homeroom_attendance_parent_select" ON public.homeroom_attendance;
CREATE POLICY "homeroom_attendance_parent_select" ON public.homeroom_attendance
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.students s 
            WHERE s.id = homeroom_attendance.student_id 
            AND s.parent_id = auth.uid()
        )
    );

-- Subject Attendance RLS - Parents can view their child's subject attendance
DROP POLICY IF EXISTS "subject_attendance_parent_select" ON public.subject_attendance;
CREATE POLICY "subject_attendance_parent_select" ON public.subject_attendance
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.students s 
            WHERE s.id = subject_attendance.student_id 
            AND s.parent_id = auth.uid()
        )
    );

-- Scanners RLS - Parents can view scanner information (read-only)
DROP POLICY IF EXISTS "scanners_parent_select" ON public.scanners;
CREATE POLICY "scanners_parent_select" ON public.scanners
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.students s 
            WHERE s.parent_id = auth.uid()
        )
    );

-- ==================== COMPLETION ====================

-- Log the migration (safe for multiple runs)
INSERT INTO public.system_settings (key, value) 
VALUES ('parent_rls_fix_applied', jsonb_build_object('timestamp', now(), 'version', '1.0.0'))
ON CONFLICT (key) 
DO UPDATE SET value = EXCLUDED.value;

-- [Date Checked: 2026-02-10] | [Remarks: Simplified RLS policies - removed over-engineered triggers and complex workflows. Kept essential parent access controls only.]