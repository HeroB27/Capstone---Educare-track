# Phase 9 Quick Reference - Dev AI Prompt

## MODE: PRODUCTION STABILIZATION (Capstone Level)

---

## ABSOLUTE RULES (NON-NEGOTIABLE)

1. DO NOT add new features
2. DO NOT modify business logic
3. DO NOT invent new tables or fields
4. DO NOT change UI flows
5. ONLY stabilize, optimize, and harden existing features
6. ALWAYS check the database schema before coding
7. If something breaks → fix it using existing structure

---

## CRITICAL REQUIREMENTS

### School Name: "Educare Colleges Inc"

- MUST BE FIXED CONSTANT in `core/config.js`
- NOT EDITABLE in admin settings
- NOT stored in database `system_settings`
- Display-only everywhere

### Student ID Format (STRICT)

```
EDU-YYYY-LAST4LRN-XXXX
```

Where:
- EDU: Fixed prefix
- YYYY: 4-digit year
- LAST4LRN: Last 4 characters of LRN
- XXXX: 4-digit sequence number

### QR Code Rules

- Single jsQR implementation shared across all roles
- Reference: `core/qr-camera.js`
- Validation: `core/scan-actions.js`
- Debounce: 2000ms (prevent duplicate scans)
- Format: `EDU-YYYY-LAST4LRN-XXXX`

### Scanner Roles (MUST use same logic)

| Role | File |
|------|------|
| Teacher (Gatekeeper) | `teacher/teacher-gatekeeper-scanner.js` |
| Guard | `guard/guard-scanner.js` |
| Clinic | `clinic/clinic-scanner.js` |

### Attendance Logic

- No duplicate scans per session
- Tap-in/tap-out enforcement
- Late logic from `attendance_rules` table
- Homeroom and subject attendance separate

### Clinic Logic

- Entry/exit logging mandatory
- No stuck `in_clinic` state
- Teacher notification on entry
- Parent notification on entry

---

## Role-Based Access (RLS)

| Role | Access |
|------|--------|
| Admin | Full access |
| Teacher | Assigned classes/students only |
| Parent | Own children only |
| Guard | Scan operations only |
| Clinic | Clinic operations only |

**NO ROLE LEAKAGE** - verify before marking complete

---

## Performance Targets

| Metric | Target |
|--------|--------|
| QR scan response | <1 second |
| UI blocking | None |
| Console errors | Zero |
| Page load | <3 seconds |

---

## Reference Files

### Core Files

| File | Purpose |
|------|---------|
| `core/config.js` | System constants (SCHOOL_NAME, STUDENT_ID_FORMAT) |
| `core/qr-camera.js` | jsQR scanner implementation |
| `core/scan-actions.js` | Scan validation and processing |
| `core/core.js` | Supabase client, authentication |
| `core/shell.js` | Dashboard shell/navigation |

### Dashboard Files

| Role | Pattern |
|------|---------|
| Admin | `admin/admin-*.html/js` |
| Teacher | `teacher/teacher-*.html/js` |
| Parent | `parent/parent-*.html/js` |
| Guard | `guard/guard-*.html/js` |
| Clinic | `clinic/clinic-*.html/js` |

### Database

- `supabase_migrations/` - Database schema

---

## Schema Reference

### Tables (DO NOT MODIFY)

- `students` (id TEXT PRIMARY KEY, lrn, full_name, grade_level, status)
- `attendance_records` (student_id, attendance_type, status, timestamp)
- `clinic_visits` (student_id, check_in, check_out, status)
- `profiles` (id, role, full_name, status)
- `system_settings` (key, value) - EXCEPT school_name (remove)

---

## Acceptance Criteria

Phase 9 complete when:

- [ ] School name is constant (not editable)
- [ ] Student ID format = EDU-YYYY-LAST4LRN-XXXX
- [ ] All scanners use unified jsQR logic
- [ ] All dashboards fully functional
- [ ] No role data leakage
- [ ] No console errors
- [ ] Performance targets met
- [ ] System matches documentation

---

## If Uncertain

1. Re-check `supabase_migrations/` for schema
2. Re-check `core/config.js` for constants
3. Re-check `core/scan-actions.js` for validation
4. **DO NOT invent solutions**
5. Use existing structure only

---

## Full Documentation

See: `progress/2026-02-04_1630_phase9_production_stabilization.md`
