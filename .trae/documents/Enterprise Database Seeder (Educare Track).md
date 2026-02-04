## What I’ll Build
- A proper, idempotent “enterprise” seeding pipeline that creates users + full school data (classes, schedules, students, attendance, events, excuses, clinic, announcements, notifications, settings).
- Output will match your requested modules, with one master runner.

## Key Constraints I’m Designing Around
- **No hard-coded auth UIDs**: Auth users will be created (or reused) via Supabase Admin API, and their UUIDs are then used everywhere.
- **Transactions**: PostgREST inserts from JS can’t wrap many tables in a single DB transaction, so the “heavy” data seed will run inside **a single SQL function** (transactional), called via RPC.
- **RLS**: The SQL seeding function will be `SECURITY DEFINER` so it can seed even when RLS is enabled; relationships will still be built to satisfy your RLS rules (teachers see their classes; parents see their kids; gatekeeper rules work).
- **Idempotent**: Deterministic UUIDs + `ON CONFLICT DO NOTHING/UPDATE` + “find-or-create” patterns.

## Seeder Structure (Deliverable)
- `scripts/seed-enterprise/seed.mjs` (master runner)
- `scripts/seed-enterprise/users.mjs`
  - Creates/reuses auth users and upserts `profiles` for:
    - 30 teachers
    - N parents (enough to cover all students, with some parents having multiple children)
    - keeps existing base sample users intact
  - Sets **exactly 2 teacher gatekeepers** in `system_settings.key = 'teacher_gatekeepers'`.
- `supabase_migrations/<new>_enterprise_seed_functions.sql`
  - Adds helper `public.uuid_from_text(text)` (stable UUID from MD5)
  - Adds `public.run_enterprise_seed(seed_tag text)`
    - Seeds everything else in a transaction.

## Data Generation Rules (How the Seed Will Look)
### Users
- Teachers: usernames like `TCH-2026-0000-0002` … `TCH-2026-0000-0031`.
- Parents: usernames like `PAR-2026-0000-0002` … (count determined by student count; target 25–35 for realism).
- Emails derived the same way your login does: `{username}@educare.local`.

### Classes (Kinder → Grade 12)
- Create one class per:
  - `Kinder`, `Grade 1` … `Grade 10`
  - `Grade 11` and `Grade 12` for each strand: `ABM`, `TVL-ICT`, `HUMSS`, `STEM`
- Assign 1 homeroom teacher per class (unique where possible).

### Subjects
- **Basic Ed (Kinder–Grade 10)**: English, Math, Science, Filipino, AP, MAPEH, ESP, TLE.
  - Seed per grade level so admin schedule picker works (it filters by `grade_level` and optionally `strand`).
- **SHS**: A realistic set per strand per grade level (11/12), including core + applied + strand specialization.
  - Example (high-level):
    - ABM: Accounting, Business Math, Applied Econ, Business Finance, Entrep.
    - TVL-ICT: Programming, Computer Systems Servicing, Networks, Web Dev.
    - HUMSS: Disciplines & Ideas, Creative Writing, Trends/PhilPol.
    - STEM: Pre-Calc/Calc, Gen Bio/Chem/Phys, Research, Statistics.

### Class Schedules
- Multiple subjects per class, with realistic day/time blocks (Mon–Fri).
- Subject teachers assigned from the 30 teachers (teachers can teach multiple classes/subjects).

### Students + Parent Linking
- 5 students per class.
- Each student gets:
  - deterministic `lrn` (unique), grade_level/strand, class_id, parent_id
  - one `student_ids` row with deterministic QR code (unique) so scanners work.
- Parent distribution intentionally creates some parents with 2–4 children.

### Attendance (Nov 1 → Today)
- Seed school days only (Mon–Fri), and skip a few seeded holidays/break days.
- `homeroom_attendance`:
  - realistic status distribution: mostly present, some late/absent, rare partial.
  - tap_in_time/tap_out_time aligned with `attendance_rules`.
- `subject_attendance`:
  - generated from the class schedule subjects; several subject records per student per day.
- `tap_logs`:
  - in/out logs per student per day.
  - gatekeeper_id uses:
    - guard user for most taps
    - the 2 teacher gatekeepers for some taps

### Events
- `school_calendar`:
  - sample holidays
  - sample suspensions
  - sample semester breaks

### Excuse Letters
- Insert realistic excuse letters from parents for selected absences.
- Include:
  - `attachment_path`, `attachment_name`, `attachment_mime`
- Also upload a tiny real attachment (1x1 PNG) into the `excuse_letters` storage bucket so “Open attachment” works.

### Clinic
- Seed clinic passes issued by teachers.
- Seed clinic visits tied to passes; mix of pending/approved/closed statuses.

### Announcements
- Class-scoped announcements (class_id set)
- Global announcements (class_id null)
- Parent-only announcements (audience_parents = true)

### Notifications
- Seed realistic notifications for:
  - announcements
  - excuse workflow
  - tap in/out alerts
  - clinic events

### System Settings
- Upsert `system_settings` keys:
  - school_name
  - academic_year
  - semester start/end
  - attendance rules defaults (if not already)
  - gate rules + teacher_gatekeepers

## Idempotency Strategy (Important)
- Stable UUIDs for rows that otherwise would duplicate (`uuid_from_text(seed_tag || natural_key)`)
- Use `ON CONFLICT` on real unique keys:
  - `profiles.username` / `profiles.id`
  - `subjects.code`
  - `attendance_rules.grade_level`
  - `system_settings.key`
  - `students.lrn`
  - `student_ids.qr_code` / `student_ids.student_id`
  - `homeroom_attendance (student_id,date)`
  - `subject_attendance (student_id,subject_code,date)`
- For tables without unique constraints (e.g., schedules), the seed will use deterministic IDs or “exists-check then insert”.

## Verification (What I’ll Run After Implementation)
- Rerun the seeder twice to confirm **no duplicates** and consistent counts.
- Quick sanity queries (counts per table, last 30 days attendance coverage).
- App-level checks:
  - teacher sees homeroom + subject classes
  - parent sees multiple children
  - guard scanner can resolve QR codes
  - dashboards show non-empty metrics

## Workspace Rules I Will Follow While Implementing
- I will read and follow your seeding/logging rules (`dataseedlogs.md`) and create the required seed log entry after I change seed scripts.

If you confirm, I’ll implement the above (new seed runner + SQL seed function), wire it into `package.json` as `npm run seed:enterprise`, and validate the data end-to-end.