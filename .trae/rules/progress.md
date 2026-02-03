create progress reports every after an update in the system

2026-02-03
- Stabilized role-based redirects across all roles via index.html
- Aligned Admin features to canonical schema (classes.grade, deterministic class IDs)
- Added FINAL_DATABASE_SCHEMA.sql/.md as the baseline schema
- Synced supabase/functions/seed/index.ts with new schema fields
- Resolved rebase conflicts and pushed main to origin

2026-02-03
- Rewrote SEED_DATA.sql to seed Kinder–Grade10 only (no sections) using existing users
- Added seeding for subjects, class schedules, 5 students per class, QR codes, attendance events/logs, announcements, clinic passes/visits, excuse letters, school calendar, system settings, and audit logs
