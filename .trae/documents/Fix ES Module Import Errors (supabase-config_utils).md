## Root Cause
- Your UI page scripts are loaded as ES modules (type="module") and do `import supabase from '../js/supabase-config.js'`.
- But [supabase-config.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/supabase-config.js) is a plain browser script that sets `window.SUPABASE_URL`, `window.SUPABASE_ANON_KEY`, and `window.supabaseClient`—it does not export a default.
- Same issue applies to [utils.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/utils.js), which defines `window.utils` and has no ES exports.

## Fix Strategy (No exports, use global clients)
- Standardize all dashboard modules to use the already-existing global objects:
  - `const supabase = window.supabaseClient;`
  - `const utils = window.utils;`
- Ensure every role page loads `supabase-config.js` and `utils.js` as normal scripts before the page’s module script.

## Files To Update
- **JS modules (25 files)**: remove the two import lines and replace with global bindings (admin/teacher/clinic/guard/parent modules + js/auth.js).
  - Example affected file: [admin-dashboard.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/admin/admin-dashboard.js)
- **HTML pages**: add these two scripts in each affected role page (path `../js/...`):
  - `<script src="../js/supabase-config.js"></script>`
  - `<script src="../js/utils.js"></script>`
  - Place them after the Supabase CDN script and before `<script type="module" src="...">`.

## Verification
- Open these pages and confirm no console errors:
  - `/admin/admin-dashboard.html`
  - `/admin/admin-users.html`
  - `/teacher/teacher-dashboard.html`
  - `/guard/guard-dashboard.html`
  - `/clinic/clinic-dashboard.html`
  - `/parent/parent-dashboard.html`
- Confirm login → redirect works and each page can read `window.supabaseClient` and `window.utils`.

## Result
- Removes the `export default` error completely and prevents the next likely error (`utils.js does not provide an export`) by aligning everything to the global script architecture already used by index.html.