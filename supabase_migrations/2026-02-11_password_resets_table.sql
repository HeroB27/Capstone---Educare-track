-- Password Reset Requests Table (XAMPP Style - No RLS)
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

-- Grant permissions (XAMPP style - no RLS)
GRANT ALL ON password_resets TO postgres, anon, authenticated;

COMMENT ON TABLE password_resets IS 'Tracks password reset requests from users';
COMMENT ON COLUMN password_resets.profile_id IS 'The user requesting password reset';
COMMENT ON COLUMN password_resets.user_type IS 'Type of user: parent, student, teacher, etc.';
COMMENT ON COLUMN password_resets.status IS 'Request status: pending, completed, rejected';
