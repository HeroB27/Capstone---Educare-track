## Current State (What I Found)
- App is a static multi-page HTML/JS system per role (admin/teacher/parent/guard/clinic) served via a simple static server.
- Admin navigation routes cover Dashboard, People, Academics, Attendance, Communications, Settings via [shell.js](file:///c:/Users/Lenovo/Desktop/OFFICIAL%20EDUCARE%20TRACK/core/shell.js).
- Announcements are implemented in [admin-announcements.js](file:///c:/Users/Lenovo/Desktop/OFFICIAL%20EDUCARE%20TRACK/admin/admin-announcements.js) and [teacher-announcements.js](file:///c:/Users/Lenovo/Desktop/OFFICIAL%20EDUCARE%20TRACK/teacher/teacher-announcements.js).
- Announcements RLS exists for teacher insert/delete and parent select-by-class in [phase3 SQL](file:///c:/Users/Lenovo/Desktop/OFFICIAL%20EDUCARE%20TRACK/supabase_migrations/2026-02-04_phase3_teachers_parents_v0.0.1.sql) and broad admin ALL policy in [phase5 SQL](file:///c:/Users/Lenovo/Desktop/OFFICIAL%20EDUCARE%20TRACK/supabase_migrations/2026-02-04_phase5_admin_policies_v1.0.0.sql).
- There are many occurrences of console logging / TODO-like markers across the codebase that must be eliminated per your mandate.

## 1) Functional Audit (Every Page / Every Button)
- Build a role-by-role “smoke run” path and execute it across:
  - Admin: Dashboard, People, Academics, Attendance, Communications, Settings (+ Announcements/Calendar subpages)
  - Teacher: Dashboard, Excuse Letters, Announcements, Gatekeeper Scanner
  - Parent: Dashboard, Excuse Upload
  - Guard: Dashboard, Scanner
  - Clinic: Dashboard, Pass Approval, Scanner
- For each page, I’ll:
  - Trigger every button and ensure it has a visible effect (navigation, modal, mutation, download, etc.)
  - Submit every form with valid + invalid inputs (validation + error surfacing)
  - Open/close every modal (keyboard escape, overlay click, focus handling)
  - Force failure paths (no session, RLS denied, empty result sets) to ensure UI shows useful errors
- Deliverable: remove dead buttons/handlers, fix broken event wiring, fix state refresh after mutations, eliminate silent failures.

## 2) Data Integrity Audit (RLS + Queries Match UI)
- Verify each role’s real data access matches requirements:
  - Teacher: only own classes + own students + class-scoped data
  - Parent: only their children + class announcements for their children
  - Guard/Clinic: only gate/clinic features
  - Admin: all
- Approach:
  - Review RLS policies for each core table used by each page.
  - Cross-check each page’s Supabase queries against those policies.
  - Fix mismatches by adjusting either (a) the query to match existing policy intent, or (b) the policy to match product intent (minimal changes, role-gated).
- Deliverable: no “0 counts” when data exists and no empty dashboards caused by RLS mismatch.

## 3) UI/UX Overhaul (Admin UI Redesign)
- Keep the system simple (no framework rewrite), but make the UI feel like a real SIS:
  - Replace inconsistent Tailwind “template look” usage with a cohesive design system using existing [theme.css](file:///c:/Users/Lenovo/Desktop/OFFICIAL%20EDUCARE%20TRACK/core/theme.css) primitives.
  - Standardize page layout: header, toolbars, cards, tables, filters, and section hierarchy.
  - Normalize typography scale, spacing rhythm, and button styling.
  - Reduce inline styles and one-off classes; move toward shared UI helpers.
- Deliverable: every admin page looks consistent, modern, and “production-ready”.

## 4) Dashboards Must Feel Real (No Fake Numbers)
- Admin dashboard:
  - Ensure cards/metrics are sourced from real Supabase queries only.
  - Add proper loading skeletons, empty states, and error states.
  - Ensure charts never render “null”/broken; show meaningful “no data yet” messages.
- Teacher/Parent/Guard/Clinic dashboards:
  - Apply the same quality bar: loading, empty, error, and correct counts.

## 5) Form Quality (Validation + UX)
- Standardize all forms to have:
  - Input validation (required, min length, date sanity)
  - Inline error messages (not alerts)
  - Disabled submit + loading state
  - Success state (toast/banner + state refresh)
- Implementation approach (simple): extend and reuse [core/ui.js](file:///c:/Users/Lenovo/Desktop/OFFICIAL%20EDUCARE%20TRACK/core/ui.js) primitives rather than duplicating per page.

## 6) Announcement System (Must Be Bulletproof)
- Admin announcements:
  - Confirm Create/Edit/Delete works end-to-end.
  - Ensure UI surfaces RLS errors clearly when misconfigured.
- Teacher announcements:
  - Add Edit support (currently teacher has create/delete; edit policy/UI is incomplete).
  - Ensure class-scoped announcements enforce teacher access to class.
- Parent visibility:
  - Stop relying only on notifications for announcements; also read class announcements directly using the existing parent RLS policy (so parents always see relevant announcements).
- RLS compliance:
  - Add/update announcements policies only where needed (teacher update own; parent read scoped; admin all).

## 7) Navigation Sanity (No Dead Links)
- Validate every sidebar route exists and loads.
- Add a root entry page so opening http://localhost:5173/ lands on the system (login) instead of a directory listing.

## 8) Developer Quality Rules
- Remove TODOs / commented-out logic / “coming soon”.
- Remove console logging in app pages (keep errors user-visible through UI banners/toasts).
- Remove hard-coded IDs where they exist in UI logic (derive from session/profile, queries, or settings).

## 9) Verification (Acceptance Criteria)
- Manual QA pass with seeded enterprise data for each role.
- Confirm:
  - Every visible button does something correct.
  - Every page renders real data (no fake placeholders).
  - Each role sees only allowed content.
  - No runtime errors in console.

## 10) Required Output (Screenshots)
- After the overhaul, I’ll provide a small capture checklist and produce the requested screenshots for:
  - Dashboard
  - Announcements
  - Attendance
  - People
  - Settings
  (If automated screenshot capture isn’t feasible in this environment, I’ll guide an exact 1-minute manual capture flow and validate the pages match the acceptance UI.)

If you confirm, I’ll start by fixing the announcements system first (since it’s explicitly “must be perfect”), then do the admin UI redesign pass page-by-page while continuously running role-based QA.