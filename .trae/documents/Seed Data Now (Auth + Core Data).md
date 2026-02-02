## Goal
Seed Supabase with working dummy data (Auth users + roles + minimal school data) using the existing service-role Python seeder.

## What Will Be Seeded
- **Auth users (email/password)**: admin, teacher, guard, clinic, parent
- **Role profiles**: `public.profiles` row for each Auth user (id matches `auth.users.id`)
- **Role sub-tables**: `admin_staff`, `teachers`, `guards`, `clinic_staff`, `parents`
- **Core academic data**: `attendance_rules` (grade 11), 1 class, 2 subjects, 2 schedules
- **Student + parent link**: 1 student, 1 `parent_students` link, 1 QR code

## Preconditions
- You have **SUPABASE_SERVICE_ROLE_KEY** (from Supabase Dashboard → Settings → API)
- Python environment is available
- DB schema is applied (tables exist) and the `profiles` table uses `uuid` ids

## Steps To Seed (No Manual DB Editing)
### 1) Create scripts/.env
- Copy [scripts/.env.example](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/scripts/.env.example) → `scripts/.env`
- Fill:
  - `SUPABASE_URL=...`
  - `SUPABASE_SERVICE_ROLE_KEY=...`
- Optional:
  - `EDUCARE_DEFAULT_PASSWORD=password123` (or your choice)

### 2) Install Python deps
- From repo root, install:
  - `pip install -r scripts/requirements.txt`

### 3) Run the seeder
- Run:
  - `python scripts/seed_auth_and_data.py`
- Expected output prints the seeded emails and password.

## Verification After Seeding
### 1) Quick DB checks (SQL Editor)
- Verify users:
  - `select role, count(*) from profiles group by role;`
- Verify student + link:
  - `select * from students limit 5;`
  - `select * from parent_students limit 5;`
- Verify schedules:
  - `select * from class_schedules limit 10;`

### 2) UI smoke login
- Login with seeded emails on [index.html](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/index.html)
- Confirm redirects into correct dashboards.

## If Anything Fails (Built-in Recovery)
- The seeder uses **upserts**, so re-running it is safe.
- If you want a clean reseed, we’ll add a separate cleanup script (optional) that deletes only seeded rows by known IDs.
