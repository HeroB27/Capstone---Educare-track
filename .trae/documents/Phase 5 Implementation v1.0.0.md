## What’s Broken / Risky Right Now (From Audit)
- **Migration order bug**: Phase 3 references `public.is_admin()` before it exists (Phase 4 defines it). Fix by moving `is_admin()` earlier or introducing a base helpers migration.
- **Admin under RLS will break**: admin pages query many tables but there are no clear admin allow policies for key tables (students/classes/attendance/clinic/etc.).
- **Attendance semantics inconsistent**: “missing row” means absent for teachers but “no record” for parents; admin counts depend on rows that exist.
- **Tap-out edge case**: tap-out can create a present row even without tap-in.
- **ID lifecycle incomplete**: reissue overwrites QR in-place; no explicit deactivation/history; no uniqueness constraints visible.
- **Some logic duplication**: clinic logic exists in multiple pages; admin pages re-implement UI helpers.

## Phase 5 Goal (v1.0.0)
Make the system feel like **one real school product**: unified dashboards + consistent UX + correct end-to-end flows + pro user management + pro ID lifecycle — while staying simple (direct Supabase calls, minimal shared helpers).

## 1) Mandatory Global System Audit + Auto-Fixes
- Create a single “audit checklist” doc and a small JS sanity harness (in-browser) to quickly validate:
  - every page loads, no orphan buttons, every action writes to a real table
  - every role only sees allowed data under RLS
  - every dashboard card/table has real data or an empty state
- Fix confirmed breaks first:
  - migration ordering (`is_admin`)
  - missing `ENABLE ROW LEVEL SECURITY` on tables that have policies
  - missing admin policies on admin-facing tables

## 2) Role-Based Dashboard Unification (Same Layout, Different Power)
- Standardize all dashboards to the same layout:
  - scrollable sidebar + top header (name, role badge, notif icon) + main cards/tables
  - cap main menu items to ≤6 per role (move secondary actions into subpages/modals)
- Use strict role theme colors:
  - Admin violet, Teacher blue, Parent green, Guard yellow, Clinic red
- Ensure active nav highlighting is consistent across all pages.

## 3) End-to-End Flow Completion (Auto-fix any broken link)
### Attendance flow
- Standardize a single “attendance truth model”:
  - Decide whether to materialize daily rows for all students or treat missing rows as unmarked.
  - Make Teacher/Parent/Admin use the same meaning.
- Fix tap logic:
  - prevent misleading tap-out-only “present” rows (mark as special or require prior tap-in)
  - prevent double scans in same minute (keep current debounce + server-side duplicate check where possible)
- Ensure dashboards/analytics reflect the same status mapping (present/late/absent/excused/partial).

### Clinic flow
- Enforce status transitions (pending → approved → in_clinic → done).
- Ensure teacher + parent notifications are emitted at each key step.
- Deduplicate clinic helper logic into one shared module used by:
  - clinic dashboard
  - clinic approval page
  - clinic scanner

### Excuse letter flow
- Validate parent upload → teacher decision → attendance updated → notifications → admin metrics.
- Fix any fragile joins (ensure `class_id` is reliably available for attendance updates).

## 4) Enhanced Admin User Management (Pro-level)
- Upgrade Admin Users page to fully support:
  - CRUD for Admin/Teacher/Parent/Guard/Clinic
  - search by name/role/status
  - flags for “pending issues” (no class, no linked child, password reset request)
- Keep provisioning secure:
  - no passwords stored in tables
  - optional export JSON for local provisioning script (service key stays local)

## 5) Pro ID Generation + Lifecycle
- Implement student ID rules:
  - `EDU-YYYY-LAST4LRN-XXXX` for QR + ID card
- Implement lifecycle:
  - issue on student creation
  - reissue creates a new `student_ids` row and deactivates old
  - enforce only one active ID per student (partial unique index)
  - enforce QR uniqueness (unique index)
- Update ID card print layout to match the required **front/back** professional design.

## 6) UX Polish (System-wide)
- Add:
  - consistent empty states
  - confirmation modals for destructive actions
  - toast notifications for success/error/warn
  - tooltips for icon-only buttons
- Ensure no orphan UI and no dev-terms shown to end users.

## 7) Error Handling + Safety Nets
- Make all network actions show:
  - clear user-friendly error messages
  - retry option for scanner/network failures
- Prevent:
  - duplicate attendance
  - double clinic entries
  - multiple scans within a short window

## 8) Final System Checklist (Automated Smoke Tests)
- Run through a real scenario with seeded users:
  - guard scans → parent notified → teacher sees status → admin metrics update
  - teacher issues clinic pass → clinic approves → student scans → notes → teacher+parent notified → admin sees report
  - parent excuse upload → teacher approves/rejects → attendance updated → parent notified → admin metrics update

## Deliverables Produced By The End Of Phase 5
- Unified dashboards and navigation across all roles
- Correct, consistent attendance/clinic/excuse flows end-to-end
- Enhanced Admin User Management + secure provisioning workflow
- Pro student ID lifecycle + professional 2x3 print cards
- Hardened RLS so every role sees only what it should

If approved, I will start by fixing the DB/RLS blockers (migration order + admin policies), then unify dashboards, then implement the pro user/ID lifecycle, and finish with the UX polish + final smoke tests.