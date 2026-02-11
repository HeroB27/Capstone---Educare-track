date: 2026-02-11
time: 18:50
updates or changes made:
- Added profiles SELECT policy migration to fix login permission denied
- Added password reset step for existing auth users in seed-test-users.mjs
- Logged schema and seed changes

progress made:
- Login profile fetch unblocked by policy fix
- Test users can authenticate with User ID mapping to @educare.local

next steps:
- Run the new migration in Supabase SQL editor
- Sign in using ADM-2026-0001-0001 with Password123!
