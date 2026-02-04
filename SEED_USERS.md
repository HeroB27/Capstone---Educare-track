# Seed Sample Users (Phase 1)

This creates 5 sample accounts (admin/teacher/parent/guard/clinic) in Supabase Auth and inserts matching rows in `public.profiles`.

## 1) Install dependencies

```bash
npm install
```

## 2) Run the seed script

Option A (recommended): set env vars

```bash
SUPABASE_URL="https://YOUR_PROJECT.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY" \
npm run seed:users
```

Option B: no env vars

If your project has `.trae/rules/Supabase information`, the script will read the public url + service role key from there automatically.

## Troubleshooting

If you get:

`permission denied for table profiles`

Run this in Supabase SQL editor (it gives the service role privileges to insert/update during seeding):

```sql
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
```

## 3) Test login

Open:
- `/auth/login.html`

Use these credentials:
- Password (all): `Password123!`
- user_id values:
  - `ADM-2026-0000-0001`
  - `TCH-2026-0000-0001`
  - `PAR-2026-0000-0001`
  - `GRD-2026-0000-0001`
  - `CLC-2026-0000-0001`
