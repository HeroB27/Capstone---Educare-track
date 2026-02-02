## What’s Not Yet Fully Implemented (Before Auth)

### Authentication / Security
- **Not Supabase Auth yet**: login uses plaintext `profiles.username + profiles.password` and stores the entire row in `localStorage` ([auth.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/auth.js#L10-L55), [utils.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/utils.js#L38-L98)).
- **Forgot password is not real**: current flow inserts a notification to the same user (not admin) and does not reset credentials ([auth.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/auth.js#L66-L100)).

### Guard Offline Queue / Sync
- **Offline scan queue + sync is not implemented**: the service worker has a `sync` listener but no persistence (no IndexedDB/local queue). It only posts a message to clients ([service-worker.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/service-worker.js#L61-L73)).
- **Cache asset paths look mismatched** (`/pages/...` paths are not the real HTML locations in this repo), so offline caching likely won’t work as intended ([service-worker.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/service-worker.js#L2-L22)).

### Attendance Logic Gaps
- **Session detection bug in teacher roll-call**: `start_time` is a SQL `time`, but code checks `.includes('AM')` which will not behave correctly; this affects attendance reads/writes ([teacher-attendance.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/teacher/teacher-attendance.js#L95-L106)).
- **Seeding logic doesn’t match event-driven design**: the current seeder writes directly to `attendance` and mutates rows (and even uses statuses like `pending/approved/in_clinic`), rather than inserting immutable events then deriving ([data-initializer.html](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/data-initializer.html#L330-L449)).

## Goal

Implement Supabase Auth now (email/password sessions) while preserving an easy way to seed:
- Auth users (admin/teacher/guard/parent/clinic)
- Core data (classes, students, schedules, QR codes, attendance rules)
- Optional sample workflows

## Auth Implementation Plan

### 1) Switch login to Supabase Auth
- Update the login flow in [index.html](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/index.html) + [auth.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/auth.js) to use:
  - `supabase.auth.signInWithPassword({ email, password })`
  - `supabase.auth.getSession()` on load
- Keep `profiles` as the role/metadata table and fetch it after login using `auth.uid()`.

### 2) Replace localStorage role checks with session-based checks
- Refactor [utils.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/utils.js) so that:
  - `checkAccess` becomes async: ensures session exists, loads `profiles` for the user, then enforces role.
  - `logout` calls `supabase.auth.signOut()` and clears cached local user.
- Update each page’s JS entry to `await utils.checkAccess([...])` before doing any DB queries.

### 3) Admin creates users via secure server-side path (no service key in browser)
- Add a Supabase **Edge Function** (admin-only) to:
  - create an Auth user (email/password)
  - insert/update `public.profiles` row with role + metadata
  - optionally create `parents/teachers/clinic_staff` rows if your schema requires them
- Update [admin-users.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/admin/admin-users.js) to call the Edge Function instead of writing plaintext passwords into `profiles`.

### 4) Minimal DB alignment for Auth
- Ensure `public.profiles.id` is the same UUID as `auth.users.id`.
- Add `profiles.email` (unique) if it doesn’t exist; stop storing plaintext passwords in `profiles`.
- Confirm RLS policies that rely on `auth.uid()` now work with the browser session.

## Seeding Plan (Must Work With Auth)

### Option A (Recommended): One seed script using Service Role locally
- Create a single seed script (Python, reusing the existing `scripts/` setup) to:
  - create Auth users via Admin API (service role key from `.env` only)
  - insert `profiles` rows with matching UUIDs + roles
  - seed classes/subjects/schedules/students/qr_codes/rules
- This keeps secrets out of the browser and avoids weakening RLS.

### Option B: SQL-only data seed (no Auth users)
- Provide a SQL seed for public tables only (students/classes/etc).
- Admin creates Auth users manually in Supabase dashboard.

## Verification (After Implementation)
- Login/logout persists across refresh (session restored).
- Role routing works using `profiles.role`.
- Existing pages can query the DB under RLS (no more “localStorage auth” mismatch).
- Seeder can recreate the environment from scratch without manual steps.

## Deliverables After You Confirm
- Updated login + utils + all page entrypoints for async session-based access.
- Edge Function for admin user provisioning.
- Seed script (service-role based) + instructions (no secrets committed).
- Quick smoke tests checklist for Admin/Teacher/Guard.
