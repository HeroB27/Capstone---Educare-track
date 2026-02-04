## What’s Already In Your Files
- Supabase project connection details are in [Supabase information](file:///c:/Users/Lenovo/Desktop/OFFICIAL%20EDUCARE%20TRACK/.trae/rules/Supabase%20information). I will only use the public URL + anon key in the frontend (never the service role key).
- Current database schema SQL is in [database schema](file:///c:/Users/Lenovo/Desktop/OFFICIAL%20EDUCARE%20TRACK/.trae/rules/database%20schema).

## Phase 1 Target (Minimal + Defensible)
- Login page: user_id + password → Supabase Auth sign-in.
- After sign-in: fetch user profile (role, name) from `profiles`.
- Cache session + profile in `localStorage`.
- Redirect to role-specific dashboard and show role color/theme.
- Simple route-guard: if no session/profile → redirect to login.

## Database Fixes Needed (Small but Important)
- Align `profiles` with Supabase Auth so we can securely fetch “my profile”:
  - Change `profiles.id` to use the Supabase auth user id (auth.uid) instead of `gen_random_uuid()`.
  - Add minimal RLS policies:
    - Authenticated users can `select` their own profile row.
    - Admin can manage profiles (CRUD) later; for Phase 1, only required policy is “select own profile”.
- Fix table creation order in the reset script (right now `students` references `classes` before `classes` exists).

## Frontend Structure (Simple Static Pages)
- Create folders:
  - `/core/` shared JS (Supabase client + auth helpers)
  - `/auth/` login page
  - `/admin/`, `/teacher/`, `/parent/`, `/guard/`, `/clinic/` dashboards
  - `/styles/` optional shared CSS overrides
- Use Tailwind via CDN for quick, mobile-first UI.
- Use Supabase JS via CDN and a single `core.js` wrapper:
  - `initSupabase()`
  - `signInWithUserIdPassword(userId, password)`
  - `requireAuthAndProfile()`
  - `signOut()`

## Login ID Strategy (No Email Requirement)
- Keep the UI as “user_id + password”.
- Implementation: treat `user_id` as an email if it contains `@`; otherwise convert to a safe placeholder email format like `USERID@educare.local`.
- This avoids any pre-login lookup (no anonymous profile reads) and stays simple/secure.

## Verification (Before Handoff)
- Confirm flows:
  - Correct redirect per role.
  - Refreshing a dashboard keeps you logged in.
  - Sign out returns to login.
- Add a minimal “profile badge” on each dashboard showing full_name + role.

## Progress Report Requirement
- After implementation, add a short progress note file in a `/progress/` folder with date/time and what Phase 1 delivered.

If you confirm this plan, I’ll implement Phase 1 end-to-end (DB script corrections + minimal RLS + static pages + core Supabase auth/profile flow).