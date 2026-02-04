date: 2026-02-04
time: 16:30
updates or changes made:
- Added enterprise seeder runner and user creator scripts in data-seeder-files/enterprise
- Added transactional SQL seeding function migration for full school dataset generation
- Added npm script seed:enterprise to run the new seeder
- Added required seed/schema log entries for traceability
- Fixed SQL seeding function joins and timestamp construction for compatibility
- Fixed clinic_passes foreign key ordering by inserting clinic_visits first
- Added preflight schema checks to fail fast (missing columns)
- Improved JS seeder error messages to avoid “one-by-one” guessing

progress made:
- Seeder now provisions 30 teachers + 30 parents (idempotent) and marks exactly 2 teacher gatekeepers
- Seeder generates classes (Kinder–Grade 12 incl. SHS strands), subjects, schedules, students, QR IDs, attendance history, taps, events, excuses, clinic data, announcements, and notifications

next steps:
- Apply the new migration in Supabase, then run npm run seed:enterprise twice to confirm idempotency
- Validate dashboards and scanning flows using the seeded accounts
- If you see an error mentioning pick_gate, re-run the updated enterprise seed SQL so tap logs use one gatekeeper (guard)
- If seeding still throws pick_gate, your database function is outdated; re-run the SQL to replace it
- If you see a clinic_passes FK error, your database function is outdated; re-run the SQL to replace it
