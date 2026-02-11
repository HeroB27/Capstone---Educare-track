-- Create user_passwords table for XAMPP-style password storage
-- This replaces localStorage for persistent passwords across devices

CREATE TABLE IF NOT EXISTS user_passwords (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_passwords_user_id ON user_passwords(user_id);

-- Allow public read access for login validation (no RLS for simplicity)
ALTER TABLE user_passwords ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Allow public read for login" ON user_passwords
    FOR SELECT USING (true);

-- Allow authenticated users to manage their own passwords
CREATE POLICY IF NOT EXISTS "Users can insert their own password" ON user_passwords
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can update their own password" ON user_passwords
    FOR UPDATE USING (auth.uid() = user_id);

-- For demo mode, allow admins to manage all passwords
CREATE POLICY IF NOT EXISTS "Admins can manage all passwords" ON user_passwords
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
