## What’s Actually Causing the Error
- The message means the browser is **not reading the updated file** [supabase-config.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/supabase-config.js) that exports `SUPABASE_ANON_KEY`.
- This is almost always due to an **old Service Worker still controlling the site** and serving a cached, older copy of `/js/supabase-config.js`.
- Your admin pages (e.g. [admin-users.html](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/admin/admin-users.html#L562-L563)) currently load the module directly but **do not run any SW-unregister logic first**, so the cached module can keep “winning”.

## Immediate Manual Relief (No Code)
- Open [fix_sw.html](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/fix_sw.html) in the browser once, let it unregister service workers, then hard refresh the admin page.
- Or DevTools → Application → Service Workers → Unregister + Clear site data.

## Repo-Wide Fixes To Implement
1) **Kill stale Service Workers for every page**
- Add an early, shared “SW cleanup” snippet to all top-level entry pages (login + each role dashboard + admin pages) that:
  - unregisters all registrations,
  - clears CacheStorage,
  - then reloads once.
- Place this snippet **before** any `<script type=module>` so cached modules can’t load first.

2) **Make Supabase config exports bulletproof**
- Ensure both config copies export named constants consistently:
  - [js/supabase-config.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/supabase-config.js)
  - [Capstone---Educare-track/js/supabase-config.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/Capstone---Educare-track/js/supabase-config.js)
- If any page imports named exports, guarantee the file uses `export const SUPABASE_URL = ...` style (not only `export { ... }`) to avoid edge parsing/caching issues.

3) **Cache-bust critical module imports (one-time)**
- Update the few module imports that are sensitive (starting with [admin/admin-users.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/admin/admin-users.js#L1)) to import `../js/supabase-config.js?v=<buildStamp>` to bypass any remaining cached module.

4) **Systemwide "Find All Errors" smoke test**
- Add a lightweight in-browser smoke test page that:
  - attempts dynamic `import()` of every JS module entrypoint used by your pages,
  - reports missing exports / syntax errors clearly.
- Run it once locally to confirm “no module load errors” across Admin/Teacher/Guard/Clinic/Parent.

## Verification
- Open admin page and confirm no `SUPABASE_ANON_KEY export` error.
- Confirm login works.
- Confirm Admin → User Management loads and Add Staff opens without JS crash.
- Confirm other dashboards load without module errors.

If you confirm this plan, I will implement the fixes across all pages, run the smoke test, and report the remaining runtime issues (if any).