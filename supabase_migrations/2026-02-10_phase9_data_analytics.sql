-- =============================================
-- PHASE 9: Data Analytics & Dashboard Enhancements
-- =============================================

-- 1. Create analytics views for dashboard metrics

-- View for attendance trend analysis (7-day rolling)
CREATE OR REPLACE VIEW public.attendance_trend_7day AS
SELECT 
    date,
    COUNT(*) as total_students,
    COUNT(*) FILTER (WHERE status IN ('present', 'partial')) as present_count,
    COUNT(*) FILTER (WHERE status = 'late') as late_count,
    COUNT(*) FILTER (WHERE status = 'absent') as absent_count,
    COUNT(*) FILTER (WHERE status = 'excused_absent') as excused_count,
    ROUND((COUNT(*) FILTER (WHERE status IN ('present', 'partial', 'late')) * 100.0 / COUNT(*)), 1) as attendance_rate
FROM public.homeroom_attendance
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY date
ORDER BY date DESC;

-- View for class performance analytics
CREATE OR REPLACE VIEW public.class_performance_analytics AS
SELECT 
    c.id as class_id,
    c.grade_level,
    c.strand,
    c.room,
    COUNT(DISTINCT s.id) as total_students,
    COUNT(DISTINCT ha.student_id) FILTER (WHERE ha.date >= CURRENT_DATE - INTERVAL '30 days') as active_students,
    ROUND(AVG(CASE 
        WHEN ha.status IN ('present', 'partial') THEN 100
        WHEN ha.status = 'late' THEN 85
        WHEN ha.status = 'excused_absent' THEN 90
        ELSE 0 
    END), 1) as avg_attendance_score,
    COUNT(DISTINCT ha.student_id) FILTER (WHERE ha.status = 'late' AND ha.date >= CURRENT_DATE - INTERVAL '30 days') as frequent_late_count,
    COUNT(DISTINCT ha.student_id) FILTER (WHERE ha.status = 'absent' AND ha.date >= CURRENT_DATE - INTERVAL '30 days') as frequent_absent_count
FROM public.classes c
LEFT JOIN public.students s ON s.class_id = c.id
LEFT JOIN public.homeroom_attendance ha ON ha.student_id = s.id AND ha.date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY c.id, c.grade_level, c.strand, c.room
ORDER BY avg_attendance_score DESC;

-- View for critical absences (20+ absences)
CREATE OR REPLACE VIEW public.critical_absences AS
SELECT 
    s.id,
    s.full_name,
    s.grade_level,
    c.room as class_room,
    COUNT(*) FILTER (WHERE ha.status = 'absent') as total_absences,
    COUNT(*) FILTER (WHERE ha.status = 'late') as total_lates,
    MIN(ha.date) as first_absence,
    MAX(ha.date) as last_absence
FROM public.students s
JOIN public.classes c ON s.class_id = c.id
JOIN public.homeroom_attendance ha ON ha.student_id = s.id
WHERE ha.status = 'absent'
GROUP BY s.id, s.full_name, s.grade_level, c.room
HAVING COUNT(*) FILTER (WHERE ha.status = 'absent') >= 10 -- Critical when reached half of 20
ORDER BY total_absences DESC;

-- View for frequent late students (5+ lates in 30 days)
CREATE OR REPLACE VIEW public.frequent_late_students AS
SELECT 
    s.id,
    s.full_name,
    s.grade_level,
    c.room as class_room,
    COUNT(*) FILTER (WHERE ha.status = 'late') as total_lates,
    COUNT(*) FILTER (WHERE ha.status = 'absent') as total_absences,
    MIN(ha.date) as first_late,
    MAX(ha.date) as last_late
FROM public.students s
JOIN public.classes c ON s.class_id = c.id
JOIN public.homeroom_attendance ha ON ha.student_id = s.id
WHERE ha.status = 'late' AND ha.date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY s.id, s.full_name, s.grade_level, c.room
HAVING COUNT(*) FILTER (WHERE ha.status = 'late') >= 5
ORDER BY total_lates DESC;

-- View for clinic visit reasons analysis
CREATE OR REPLACE VIEW public.clinic_visit_analytics AS
SELECT 
    cv.id,
    cv.student_id,
    s.full_name,
    s.grade_level,
    s.strand,
    cv.created_at as visit_time,
    cv.reason,
    cv.notes,
    cv.status,
    cv.created_at
FROM public.clinic_visits cv
LEFT JOIN public.students s ON cv.student_id = s.id
WHERE cv.status = 'treated';

-- 2. Create RPC functions for detailed analytics

-- Function to get attendance trend for specific date range
CREATE OR REPLACE FUNCTION public.get_attendance_trend(p_start_date date, p_end_date date)
RETURNS TABLE (
    attendance_date date,
    total_students bigint,
    present_count bigint,
    late_count bigint,
    absent_count bigint,
    excused_count bigint,
    attendance_rate numeric
)
LANGUAGE sql
AS $$
    SELECT 
        date,
        COUNT(*),
        COUNT(*) FILTER (WHERE status IN ('present', 'partial')),
        COUNT(*) FILTER (WHERE status = 'late'),
        COUNT(*) FILTER (WHERE status = 'absent'),
        COUNT(*) FILTER (WHERE status = 'excused_absent'),
        ROUND((COUNT(*) FILTER (WHERE status IN ('present', 'partial', 'late')) * 100.0 / COUNT(*)), 1)
    FROM public.homeroom_attendance
    WHERE date BETWEEN p_start_date AND p_end_date
    GROUP BY date
    ORDER BY date;
$$;

-- Function to get class performance for specific grade level
CREATE OR REPLACE FUNCTION public.get_class_performance(p_grade_level text)
RETURNS TABLE (
    class_id uuid,
    grade_level text,
    strand text,
    room text,
    total_students bigint,
    active_students bigint,
    avg_attendance_score numeric,
    frequent_late_count bigint,
    frequent_absent_count bigint
)
LANGUAGE sql
AS $$
    SELECT * FROM public.class_performance_analytics
    WHERE grade_level = p_grade_level
    ORDER BY avg_attendance_score DESC;
$$;

-- 3. RLS policies removed for simplicity - views will be accessible to all database users

-- 4. Create indexes for better analytics performance

CREATE INDEX IF NOT EXISTS homeroom_attendance_date_status_idx 
    ON public.homeroom_attendance (date, status);

CREATE INDEX IF NOT EXISTS homeroom_attendance_student_date_idx 
    ON public.homeroom_attendance (student_id, date);

CREATE INDEX IF NOT EXISTS clinic_visits_reason_status_idx 
    ON public.clinic_visits (reason, status);

-- Index removed - check_in column does not exist in clinic_visits table

-- 5. Add comments for documentation

COMMENT ON VIEW public.attendance_trend_7day IS '7-day rolling attendance trend analysis for dashboard';
COMMENT ON VIEW public.class_performance_analytics IS 'Class performance metrics including attendance scores';
COMMENT ON VIEW public.critical_absences IS 'Students with critical absence levels (10+ absences)';
COMMENT ON VIEW public.frequent_late_students IS 'Students with frequent late arrivals (5+ in 30 days)';
COMMENT ON VIEW public.clinic_visit_analytics IS 'Analysis of clinic visit reasons and patterns';

COMMENT ON FUNCTION public.get_attendance_trend IS 'Get attendance trend for specific date range';
COMMENT ON FUNCTION public.get_class_performance IS 'Get class performance filtered by grade level';

-- =============================================
-- END OF PHASE 9: Data Analytics Enhancements
-- =============================================