-- Fix login: ensure authenticated users can read their profile
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON TABLE public.profiles TO authenticated;

DROP POLICY IF EXISTS profiles_select_authenticated ON public.profiles;
CREATE POLICY profiles_select_authenticated
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- [Date Checked: 2026-02-11] | [Remarks: Enabled profiles SELECT policy for authenticated users to fix login permission denied.]
