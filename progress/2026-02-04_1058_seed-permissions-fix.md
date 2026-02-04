# Progress Report

Date/Time: 2026-02-04 10:58

## Seed Permissions Fix

- Updated SQL to grant `service_role` the needed table/sequences privileges so the seed script can upsert into `profiles`.
- Updated the seed guide with a copy/paste troubleshooting snippet.
- Added a guard in the seed script to fail fast if the provided key is not a service role key.
