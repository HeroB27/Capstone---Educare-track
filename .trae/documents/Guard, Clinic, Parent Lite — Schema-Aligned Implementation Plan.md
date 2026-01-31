## Objectives
- Align Guard and Clinic features to the existing schema and notifications model.
- Keep Parent features as-is (excuse letters, live status) since they already match schema.

## Changes To Implement
- Guard
  - Update guard-dashboard.js notification inserts to use notifications fields: recipient_id, actor_id, verb, object.
  - Keep attendance insert and students.current_status update as-is.
- Clinic
  - Remove usage of clinic_visits.status and custom fields (medical_findings, treatment_given, recommendations).
  - Treat "pending" as treated_by IS NULL; filter and list pending using treated_by IS NULL.
  - On save, write to notes and set treated_by to current user.
  - Insert parent notifications using notifications fields.

## Validation
- Guard: scan flow inserts attendance, updates current_status, sends parent notification; history renders last 10 scans.
- Clinic: pending list loads from treated_by IS NULL; saving findings updates notes and treated_by, sends parent notification.
- Parent: live status and excuse uploads continue to work.

## Deliverables
- Updated js/guard-dashboard.js and js/clinic-dashboard.js aligned to schema and notification format.
- Quick preview links for guard-scanner and dashboards.

Confirm and I will apply the updates immediately and provide preview URLs.