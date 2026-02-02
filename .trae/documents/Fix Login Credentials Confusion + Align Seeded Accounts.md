## Findings
- The error `400 Invalid login credentials` is a Supabase Auth rejection (email not found / wrong password / unconfirmed user), not a `Supabase tables.txt` schema issue.
- The app signs in via Supabase Auth (`auth.users`) and does not use `public.profiles.password`.
- Current seeded emails are `*@educare.edu`, but the attempted login used `admin1@educare.com`, which will always fail.

## Fixes To Implement
- Update the login UI copy to clearly show the correct seeded test emails (admin/teacher/guard/clinic/parent) and the default password.
- Normalize login input in `js/auth.js` (trim + lowercase email) and show a clearer message when Supabase returns `Invalid login credentials`.
- Align seed scripts and any legacy docs/handovers that still reference old credentials (e.g., `password123`, `.edu.ph`, or usernames) to the actual seeded Auth accounts.

## Verification
- Confirm sign-in works for `admin1@educare.edu` with `Educare@2024`.
- Confirm role redirect works after login.
- Confirm the `profiles` row is fetched (or the fallback path is used only when profile fetch fails).

## Optional (If You Prefer .com)
- Switch the seed emails from `*@educare.edu` to `*@educare.com` everywhere (seed + password-fix list + UI hints) and re-run seeding so the credentials match what you’re typing.