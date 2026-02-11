-- Password Reset Requests Table
-- Track password reset requests from users

CREATE TABLE IF NOT EXISTS password_resets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    user_type TEXT NOT NULL DEFAULT 'parent',
    reason TEXT,
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'pending',
    admin_note TEXT
);

-- Enable RLS for password_resets
ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;

-- Allow admin to manage password resets
GRANT ALL ON password_resets TO postgres, anon, authenticated, admin_role;

-- Create policy for admins
CREATE POLICY "Admins can manage password resets" ON password_resets
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Allow authenticated users to create reset requests
CREATE POLICY "Users can create reset requests" ON password_resets
    FOR INSERT
    WITH CHECK (auth.uid() = profile_id OR EXISTS (
        SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    ));

COMMENT ON TABLE password_resets IS 'Tracks password reset requests from users';
COMMENT ON COLUMN password_resets.profile_id IS 'The user requesting password reset';
COMMENT ON COLUMN password_resets.user_type IS 'Type of user: parent, student, teacher, etc.';
COMMENT ON COLUMN password_resets.status IS 'Request status: pending, completed, rejected';
