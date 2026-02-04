# Phase 9 Acceptance Checklist

## Critical Fixes Required

### School Name (Must be Fixed)

| Check | Item | Status |
|-------|------|--------|
| [ ] | School name removed from `system_settings` table | ⏳ |
| [ ] | `SCHOOL_NAME` constant added to `core/config.js` | ⏳ |
| [ ] | School name removed from admin settings UI | ⏳ |
| [ ] | All HTML pages use constant for title | ⏳ |
| [ ] | No editable school name fields exist | ⏳ |

### Student ID Format (Must be EDU-YYYY-LAST4LRN-XXXX)

| Check | Item | Status |
|-------|------|--------|
| [ ] | `parseStudentID()` updated to new format | ⏳ |
| [ ] | Student ID generation uses LAST4LRN | ⏳ |
| [ ] | QR code generation uses new format | ⏳ |
| [ ] | ID card printing uses new format | ⏳ |
| [ ] | Scanner validates new format | ⏳ |

### QR Scanner Unification

| Check | Item | Status |
|-------|------|--------|
| [ ] | `teacher-gatekeeper-scanner.js` uses `core/qr-camera.js` | ⏳ |
| [ ] | `guard-scanner.js` uses `core/qr-camera.js` | ⏳ |
| [ ] | `clinic-scanner.js` uses `core/qr-camera.js` | ⏳ |
| [ ] | All scanners use `core/scan-actions.js` validation | ⏳ |
| [ ] | Debounce logic consistent (2000ms) | ⏳ |

---

## Dashboard Functionality

### Admin Dashboard

| Check | Feature | Status |
|-------|---------|--------|
| [ ] | User management works | ⏳ |
| [ ] | Role assignment works | ⏳ |
| [ ] | Student enrollment works | ⏳ |
| [ ] | Attendance analytics works | ⏳ |
| [ ] | Clinic overview works | ⏳ |
| [ ] | Guard activity overview works | ⏳ |
| [ ] | No editable school name | ⏳ |

### Teacher Dashboard

| Check | Feature | Status |
|-------|---------|--------|
| [ ] | Only assigned classes visible | ⏳ |
| [ ] | Homeroom attendance works | ⏳ |
| [ ] | Subject attendance works | ⏳ |
| [ ] | QR scanning works | ⏳ |
| [ ] | Clinic notifications received | ⏳ |
| [ ] | Parent communication works | ⏳ |

### Parent Dashboard

| Check | Feature | Status |
|-------|---------|--------|
| [ ] | Only own children visible | ⏳ |
| [ ] | Attendance history visible | ⏳ |
| [ ] | Clinic visit records visible | ⏳ |
| [ ] | Guard scan timestamps visible | ⏳ |
| [ ] | Notifications readable | ⏳ |
| [ ] | No other students accessible | ⏳ |

### Guard Dashboard

| Check | Feature | Status |
|-------|---------|--------|
| [ ] | QR scanning fast (<1s) | ⏳ |
| [ ] | Entry logging works | ⏳ |
| [ ] | Exit logging works | ⏳ |
| [ ] | Real-time validation works | ⏳ |
| [ ] | Student identity confirmed | ⏳ |
| [ ] | No academic data accessible | ⏳ |

### Clinic Dashboard

| Check | Feature | Status |
|-------|---------|--------|
| [ ] | QR scanning works | ⏳ |
| [ ] | Pass approval works | ⏳ |
| [ ] | Visit logging (time-in) works | ⏳ |
| [ ] | Visit logging (time-out) works | ⏳ |
| [ ] | Teacher notification sent | ⏳ |
| [ ] | Parent notification sent | ⏳ |
| [ ] | No stuck in_clinic states | ⏳ |

---

## Technical Requirements

### No Console Errors

| Check | Page | Status |
|-------|------|--------|
| [ ] | Admin dashboards | ⏳ |
| [ ] | Teacher dashboards | ⏳ |
| [ ] | Parent dashboards | ⏳ |
| [ ] | Guard dashboards | ⏳ |
| [ ] | Clinic dashboards | ⏳ |
| [ ] | Login page | ⏳ |

### Performance

| Check | Metric | Target | Status |
|-------|--------|--------|--------|
| [ ] | QR scan response | <1s | ⏳ |
| [ ] | Page load time | <3s | ⏳ |
| [ ] | No UI blocking | N/A | ⏳ |

### Security

| Check | Item | Status |
|-------|------|--------|
| [ ] | Admin RLS verified | ⏳ |
| [ ] | Teacher RLS verified | ⏳ |
| [ ] | Parent RLS verified | ⏳ |
| [ ] | Guard RLS verified | ⏳ |
| [ ] | Clinic RLS verified | ⏳ |
| [ ] | No cross-role data access | ⏳ |

---

## Feature Chains (End-to-End)

| Chain | Components | Status |
|-------|------------|--------|
| Scan → Attendance | Scanner → Record → Dashboard | ⏳ |
| Clinic Entry → Notify | Entry → Teacher Notify → Parent Notify | ⏳ |
| Clinic Exit → Log | Exit → Check-out → Report | ⏳ |
| Parent Upload → Review | Upload → Teacher Review → Update | ⏳ |

---

## Final Sign-Off

| Sign-Off | Name | Date |
|----------|------|------|
| Technical Review | | |
| Security Review | | |
| User Acceptance | | |
| Phase Complete | | |

---

**Created:** 2026-02-04  
**Phase:** 9 Production Stabilization
