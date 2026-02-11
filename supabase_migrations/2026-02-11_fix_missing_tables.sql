-- Migration: Fix missing tables and columns
-- Date: 2026-02-11
-- Issues: system_settings table missing, subjects.type column missing

-- Create system_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add type column to subjects table if it doesn't exist
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

-- Enable RLS on system_settings
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all authenticated users to read system_settings
CREATE POLICY IF NOT EXISTS "Allow read access to system_settings"
ON system_settings FOR SELECT
TO authenticated
USING (true);

-- Create policy to allow admins to modify system_settings
CREATE POLICY IF NOT EXISTS "Allow admin modify system_settings"
ON system_settings FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role = 'admin'
    )
);

-- Grant permissions
GRANT ALL ON system_settings TO authenticated;

-- Insert default settings
INSERT INTO system_settings (key, value) VALUES
    ('teacher_gatekeepers', '{"teacher_ids": []}')
ON CONFLICT (key) DO NOTHING;

-- Add comment
COMMENT ON TABLE system_settings IS 'Stores system-wide configuration settings';
COMMENT ON COLUMN subjects.type IS 'Subject type: regular, elective, enrichment';
