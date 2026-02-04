# Progress Report

Date/Time: 2026-02-04 12:15

## Admin Panel UI Upgrade

- Added a minimal Supabase migration for `profiles.address` and updated the reset SQL accordingly.
- Upgraded Admin Users with a modern searchable/filterable/sortable table and edit modal.
- Implemented multi-step wizards for parent+students and staff provisioning with JSON export (no passwords stored in Supabase tables).
- Added a local provisioning script to create Supabase Auth users safely (service role key) from exported JSON.
- Replaced the Calendar list with an interactive calendar (date tap, edit/delete, optional announcement creation).
