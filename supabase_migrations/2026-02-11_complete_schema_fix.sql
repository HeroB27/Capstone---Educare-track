-- Migration: Create all missing tables and fix schema
-- Date: 2026-02-11
-- Run this in Supabase SQL Editor as admin/service_role

-- ============================================
-- ATTENDANCE_RULES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS attendance_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grade_level TEXT NOT NULL,
    entry_time TIME NOT NULL,
    grace_until TIME NOT NULL,
    late_until TIME NOT NULL,
    min_subject_minutes INTEGER DEFAULT 60,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE attendance_rules ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read
CREATE POLICY IF NOT EXISTS "Anyone can read attendance_rules"
ON attendance_rules FOR SELECT TO authenticated USING (true);

-- Policy: Only admins can modify
CREATE POLICY IF NOT EXISTS "Admins can modify attendance_rules"
ON attendance_rules FOR ALL TO authenticated
USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Insert default rules
INSERT INTO attendance_rules (grade_level, entry_time, grace_until, late_until)
VALUES 
    ('Kinder', '07:30', '07:45', '08:00'),
    ('Grade 1', '07:30', '07:45', '08:00'),
    ('Grade 2', '07:30', '07:45', '08:00'),
    ('Grade 3', '07:30', '07:45', '08:00'),
    ('Grade 4', '07:30', '07:45', '08:00'),
    ('Grade 5', '07:30', '07:45', '08:00'),
    ('Grade 6', '07:30', '07:45', '08:00'),
    ('Grade 7', '07:30', '07:45', '08:00'),
    ('Grade 8', '07:30', '07:45', '08:00'),
    ('Grade 9', '07:30', '07:45', '08:00'),
    ('Grade 10', '07:30', '07:45', '08:00'),
    ('Grade 11', '07:30', '07:45', '08:00'),
    ('Grade 12', '07:30', '07:45', '08:00')
ON CONFLICT DO NOTHING;

-- ============================================
-- SYSTEM_SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read
CREATE POLICY IF NOT EXISTS "Anyone can read system_settings"
ON system_settings FOR SELECT TO authenticated USING (true);

-- Policy: Only admins can modify
CREATE POLICY IF NOT EXISTS "Admins can modify system_settings"
ON system_settings FOR ALL TO authenticated
USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Insert default settings
INSERT INTO system_settings (key, value) VALUES
    ('teacher_gatekeepers', '{"teacher_ids": []}'),
    ('clinic_handshake_enabled', '{"enabled": false}'),
    ('parent_notifications', '{"enabled": true, "methods": ["email"]}')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- ADD MISSING COLUMNS TO EXISTING TABLES
-- ============================================

-- Add type column to subjects if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'subjects'
        AND column_name = 'type'
    ) THEN
        ALTER TABLE subjects ADD COLUMN type TEXT DEFAULT 'regular';
    END IF;
END $$;

-- Add photo_url column to profiles if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'profiles'
        AND column_name = 'photo_url'
    ) THEN
        ALTER TABLE profiles ADD COLUMN photo_url TEXT;
    END IF;
END $$;

-- ============================================
-- GRANT PERMISSIONS
-- ============================================
GRANT ALL ON attendance_rules TO authenticated, anon, service_role;
GRANT ALL ON system_settings TO authenticated, anon, service_role;

-- ============================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_attendance_rules_grade ON attendance_rules(grade_level);
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(key);

COMMENT ON TABLE attendance_rules IS 'Attendance rules per grade level (entry time, grace period, etc.)';
COMMENT ON TABLE system_settings IS 'System-wide configuration settings';
COMMENT ON COLUMN subjects.type IS 'Subject type: regular, elective, enrichment';
