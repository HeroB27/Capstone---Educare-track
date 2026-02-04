# Phase 9: Production-Level Stabilization (Capstone Standard)

## 🔒 MODE: PRODUCTION STABILIZATION

**Phase 9 Objective:** Stabilize both backend and frontend so that the system behaves predictably, no critical feature fails under normal school usage, data integrity is preserved, and UX is clean and consistent. This is capstone-level production, not experimental development.

---

## 📋 ABSOLUTE RULES (NON-NEGOTIABLE)

- ❌ DO NOT add new features
- ❌ DO NOT modify business logic
- ❌ DO NOT invent new tables or fields
- ❌ DO NOT change UI flows
- ✅ ONLY stabilize, optimize, and harden existing features
- ✅ ALWAYS check the database schema before coding
- ✅ If something breaks → fix it using existing structure

---

## 🚨 CRITICAL ISSUES IDENTIFIED

### Issue 1: School Name Editable vs Fixed (REQUIRED FIX)

**Status:** ❌ CURRENTLY EDITABLE (in database `system_settings`)

**Required State:** ✅ FIXED, NOT EDITABLE

**Evidence:**
- `supabase_migrations/2026-02-04_enterprise_seed_v1.0.0.sql` line 143 stores school_name in `system_settings`
- Admin settings can modify this value

**Phase 9 Fix:**
1. Remove school_name from `system_settings` table
2. Define as constant in `core/config.js`:
   ```javascript
   export const SCHOOL_NAME = "Educare Colleges Inc";
   ```
3. Remove any editable school name fields from admin settings UI
4. Update all HTML pages to use constant instead of database value
5. Update title tags to use constant (currently hardcoded in `admin/admin-settings.html`)

### Issue 2: QR Code Format Discrepancy

**Current Implementation** (`core/scan-actions.js`):
```
EDU-YYYY-LLLL-XXXX
```
- YYYY: 4-digit year
- LLLL: 2-6 character location code (GATE, CLIN, 7A, etc.)
- XXXX: 4-digit student ID

**Required Format** (per spec):
```
EDU-YYYY-LAST4LRN-XXXX
```
- YYYY: 4-digit year
- LAST4LRN: Last 4 characters of LRN
- XXXX: 4-digit sequence number

**Phase 9 Fix:**
1. Update `parseStudentID()` in `core/scan-actions.js` to use LAST4LRN format
2. Update all student ID generation logic
3. Update QR code generation for ID cards
4. Ensure scanner validates new format
5. Create migration script if database needs update

---

## 1️⃣ BACKEND STABILIZATION REQUIREMENTS

### Database & Schema Discipline

**Treat the schema as source of truth. Validate:**

- [ ] Foreign keys are properly linked
- [ ] Constraints are enforced
- [ ] Required fields are NOT nullable
- [ ] Status enums are consistent
- [ ] No silent inserts that bypass validation
- [ ] No nullable critical fields causing unexpected behavior

### Row Level Security (RLS) Re-verification

| Role | Access Level | Verification |
|------|--------------|--------------|
| Admin | Full access | ✅ Verify complete system access |
| Teacher | Assigned scope only | ✅ Verify access to assigned classes/students |
| Parent | Own children only | ✅ Verify no cross-child data access |
| Guard | Operational access only | ✅ Verify scan-only capabilities |
| Clinic | Operational access only | ✅ Verify clinic-specific data only |

**Critical:** No role leakage. No cross-user data exposure.

---

## 2️⃣ FRONTEND STABILIZATION REQUIREMENTS

### UI Consistency Checklist

- [ ] No dead buttons (every button triggers valid action)
- [ ] No placeholder text left in production
- [ ] No unused components cluttering the codebase
- [ ] No console errors on any dashboard
- [ ] All dashboards fully wired to real data (no mocks)

### UX Reliability Standards

- [ ] Predictable navigation flow
- [ ] Clear success/error messages for every action
- [ ] Loading states handled for all async operations
- [ ] Empty states have explanatory messages
- [ ] Responsive design works on all target devices

---

## 3️⃣ CRITICAL FEATURE REMINDERS (DO NOT BREAK)

### 🆔 STUDENT ID FORMAT (STRICT)

```
EDU-YYYY-LAST4LRN-XXXX
```

**Where:**
- EDU: Fixed prefix
- YYYY: 4-digit year of enrollment
- LAST4LRN: Last 4 characters of student's LRN
- XXXX: 4-digit sequence number

**Used in:**
- Student records
- ID card generation
- QR code content
- Scanner validation

**Format must NEVER change under any circumstances.**

### 📷 QR CODE RULES

**QR contains:**
- Student ID (full format EDU-YYYY-LAST4LRN-XXXX)
- Encrypted or validated payload
- No alternate QR formats
- One QR per active student

**Critical:** QR format is uniform across all scanning points.

### 🔍 SCANNER RULES (VERY IMPORTANT)

**Single scanner logic using jsQR**

Shared across:
- Teacher (Gatekeeper) → `teacher/teacher-gatekeeper-scanner.js`
- Guard → `guard/guard-scanner.js`
- Clinic → `clinic/clinic-scanner.js`

**Must share:**
- Same validation logic (`core/scan-actions.js`)
- Same debounce rules (1200ms default, prevents duplicate scans)
- Same duplicate-scan prevention
- Same error handling

**Reference implementation:** `core/qr-camera.js`

**Scanner Configuration:**
```javascript
const SCANNER_CONFIG = {
    fps: 10,
    qrbox: { width: 250, height: 250 },
    aspectRatio: 1.0,
    flipHorizontal: false,
    disableVerbose: false
};
const SCAN_DEBOUNCE_MS = 2000; // Prevent duplicate scans
```

### 🕒 ATTENDANCE LOGIC

- [ ] No duplicate scans per session
- [ ] Proper tap-in/tap-out enforcement
- [ ] Late logic derived from attendance rules
- [ ] Homeroom and subject attendance remain separate
- [ ] Attendance records linked to correct student IDs

### 🏥 CLINIC LOGIC

- [ ] No visit without valid pass (if required by policy)
- [ ] Entry and exit must both be logged
- [ ] No stuck `in_clinic` state
- [ ] Teacher notification triggered on clinic entry
- [ ] Parent notification triggered on clinic entry
- [ ] Status updates reflect in real-time

---

## 4️⃣ SYSTEM INTEGRATION CHECKS

### End-to-End Verification Required

| Chain | Components | Verification |
|-------|------------|--------------|
| Scan → Attendance | Scanner → Attendance Record → Dashboard | ✅ Verify completion |
| Clinic Pass → Visit | Pass Approval → Visit Log → Exit → Report | ✅ Verify completion |
| Parent Upload → Teacher | Upload → Teacher Review → Attendance Update | ✅ Verify completion |
| Notification Flow | Trigger → Notification → User Dashboard | ✅ Verify completion |

**Every chain must complete without manual fixes.**

---

## 5️⃣ PERFORMANCE & SAFETY (CAPSTONE SCALE)

### Performance Targets

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| QR scan response | <1 second | TBD | ⏳ |
| UI responsiveness | No blocking | TBD | ⏳ |
| Page load time | <3 seconds | TBD | ⏳ |
| Database queries | Optimized | TBD | ⏳ |

### Safety Requirements

- [ ] Retry-safe actions (network failures don't corrupt data)
- [ ] Graceful error handling (no crashes on bad input)
- [ ] Input validation on all user entries
- [ ] No system crashes on edge cases
- [ ] Data backup verification

---

## 6️⃣ DASHBOARD VERIFICATION CHECKLIST

### Admin Dashboard

| Feature | Status | Notes |
|---------|--------|-------|
| User management (create, activate, deactivate) | ⏳ | Verify |
| Role assignment (Admin, Teacher, Parent, Guard, Clinic) | ⏳ | Verify |
| Student enrollment & class assignment | ⏳ | Verify |
| Attendance analytics (daily, weekly, monthly) | ⏳ | Verify |
| Clinic & guard activity overview | ⏳ | Verify |
| System health indicators | ⏳ | Verify |
| **School Name Display** | ❌ NOT EDITABLE | Must be display-only constant |

### Teacher Dashboard

| Feature | Status | Notes |
|---------|--------|-------|
| Assigned classes only | ⏳ | Verify scope |
| Homeroom attendance | ⏳ | Verify |
| Subject attendance | ⏳ | Verify |
| QR scanning (gatekeeper) | ⏳ | Verify jsQR integration |
| Clinic notifications | ⏳ | Verify |
| Parent communication | ⏳ | Verify |

### Parent Dashboard

| Feature | Status | Notes |
|---------|--------|-------|
| View ONLY own children | ⏳ | Verify scope |
| Attendance history | ⏳ | Verify |
| Clinic visit records | ⏳ | Verify |
| Guard scan timestamps | ⏳ | Verify |
| Notifications (read-only) | ⏳ | Verify |

### Guard Dashboard

| Feature | Status | Notes |
|---------|--------|-------|
| Fast QR scanning (jsQR) | ⏳ | Verify performance |
| Entry logging | ⏳ | Verify |
| Exit logging | ⏳ | Verify |
| Real-time validation | ⏳ | Verify |
| Student identity confirmation | ⏳ | Verify |
| No access to academic data | ⏳ | Verify restriction |

### Clinic Dashboard

| Feature | Status | Notes |
|---------|--------|-------|
| QR scanning (jsQR) | ⏳ | Verify same logic |
| Clinic pass approval | ⏳ | Verify |
| Visit logging (time-in/time-out) | ⏳ | Verify |
| Teacher notifications | ⏳ | Verify trigger |
| Parent notifications | ⏳ | Verify trigger |
| Status enforcement | ⏳ | Verify no stuck states |

---

## 7️⃣ SCHEMA REFERENCE

### Core Tables (Do Not Modify)

```sql
-- Students table (ID format: EDU-YYYY-LAST4LRN-XXXX)
CREATE TABLE students (
    id TEXT PRIMARY KEY CHECK (id ~ 'EDU-[0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}'),
    user_id UUID REFERENCES auth.users(id),
    lrn TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    grade_level INTEGER NOT NULL,
    section_id UUID REFERENCES sections(id),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'graduated', 'transferred')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Attendance records
CREATE TABLE attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id TEXT REFERENCES students(id),
    attendance_type TEXT NOT NULL CHECK (attendance_type IN ('homeroom', 'subject', 'clinic', 'guard_entry', 'guard_exit')),
    status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    scanned_by UUID REFERENCES auth.users(id),
    notes TEXT
);

-- Clinic visits
CREATE TABLE clinic_visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id TEXT REFERENCES students(id),
    check_in TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    check_out TIMESTAMP WITH TIME ZONE,
    reason TEXT NOT NULL,
    notes TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'referred'))
);

-- Users (role-based)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    role TEXT NOT NULL CHECK (role IN ('admin', 'teacher', 'parent', 'guard', 'clinic')),
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive'))
);

-- System Settings (REMOVE school_name - make it constant)
CREATE TABLE system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value JSONB
);
```

---

## 8️⃣ UNIFYING SCANNER LOGIC

### Single jsQR Implementation

All three roles must use the exact same scanner logic:

**File:** `core/qr-camera.js`

```javascript
// Scanner configuration (MUST be identical across all roles)
const SCANNER_CONFIG = {
    fps: 10,
    qrbox: { width: 250, height: 250 },
    aspectRatio: 1.0,
    flipHorizontal: false,
    disableVerbose: false
};

// Debounce settings (prevent duplicate scans)
const SCAN_DEBOUNCE_MS = 2000;

// Student ID regex validation (NEW FORMAT)
const STUDENT_ID_PATTERN = /^EDU-\d{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
```

**Scanner Files Using This:**
- `teacher/teacher-gatekeeper-scanner.js`
- `guard/guard-scanner.js`
- `clinic/clinic-scanner.js`

**Action Handler:** `core/scan-actions.js` (shared processing logic)

**Key Functions in scan-actions.js:**
- `parseStudentID(qrCode)` - Parse and validate QR format
- `lookupStudentByQr(qrCode)` - Database lookup
- `computeArrivalStatus(rule, now)` - Determine present/late
- `recordAttendance(data)` - Save attendance record

---

## 9️⃣ NOTIFICATION WORKFLOW

### Automatic Notifications Matrix

| Event | Teacher | Parent | Admin |
|-------|---------|--------|-------|
| Student enters clinic | ✅ | ✅ | ✅ |
| Student exits clinic | ✅ | ✅ | ✅ |
| Student absent (no excuse) | ✅ | ✅ | - |
| Student late (homeroom) | ✅ | ✅ | - |
| Excuse submitted | ✅ | - | - |
| Guard scan (entry/exit) | - | ✅ | - |
| Low attendance alert | - | - | ✅ |
| System alert | - | - | ✅ |

---

## 🔧 SCHOOL NAME CONSTANT DEFINITION

### New in `core/config.js`:

```javascript
// School Name - FIXED, NOT EDITABLE
export const SCHOOL_NAME = "Educare Colleges Inc";

// Student ID Format Configuration
export const STUDENT_ID_FORMAT = {
    PREFIX: "EDU",
    YEAR_LENGTH: 4,
    LRN_LENGTH: 4,
    SEQ_LENGTH: 4,
    PATTERN: /^EDU-\d{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/
};

// Scanner Configuration
export const SCANNER_CONFIG = {
    FPS: 10,
    QRBOX_WIDTH: 250,
    QRBOX_HEIGHT: 250,
    DEBOUNCE_MS: 2000
};
```

### Files to Update for School Name Constant:

1. `admin/admin-settings.html` - Remove editable school name, use constant
2. `index.html` - Update title
3. `auth/login.html` - Update title
4. All dashboard HTML files - Update titles
5. Remove school_name from `system_settings` table migration

---

## 📋 PHASE 9 IMPLEMENTATION CHECKLIST

### Week 1: Critical Fixes

- [ ] Move school_name from database to constant in `core/config.js`
- [ ] Remove editable school name from admin settings UI
- [ ] Update all HTML pages to use SCHOOL_NAME constant
- [ ] Update QR format from EDU-YYYY-LLLL-XXXX to EDU-YYYY-LAST4LRN-XXXX
- [ ] Update parseStudentID() in scan-actions.js
- [ ] Update student ID generation logic
- [ ] Update QR code generation for ID cards

### Week 2: Stabilization

- [ ] Verify all scanner implementations use shared jsQR logic
- [ ] Verify RLS policies for all roles
- [ ] Test attendance tracking end-to-end
- [ ] Test clinic workflow end-to-end
- [ ] Test notification system
- [ ] Fix any console errors
- [ ] Add loading states where missing

### Week 3: Testing & Validation

- [ ] End-to-end testing of all dashboards
- [ ] Performance testing (QR scan <1 second)
- [ ] Security testing (role leakage check)
- [ ] User acceptance testing
- [ ] Document any issues found
- [ ] Fix critical issues

### Week 4: Final Polish

- [ ] Empty state messaging
- [ ] Error message improvements
- [ ] Final documentation update
- [ ] Demo preparation
- [ ] Phase 9 completion sign-off

---

## 🏁 SUCCESS DEFINITION

**Phase 9 is complete when:**

1. ✅ School name is fixed constant (not editable)
2. ✅ Student ID format is EDU-YYYY-LAST4LRN-XXXX
3. ✅ QR scanner unified across all roles
4. ✅ All dashboards fully functional
5. ✅ No role data leakage
6. ✅ No console errors
7. ✅ Performance targets met
8. ✅ System matches documentation exactly
9. ✅ No scope creep introduced
10. ✅ Capstone-ready for demonstration

### Final Stability Checklist

- [ ] Schema verified against source of truth
- [ ] RLS policies verified for all roles
- [ ] All dashboards fully functional
- [ ] Student ID format strictly enforced
- [ ] QR and scanner logic unified
- [ ] Attendance tracking accurate
- [ ] Clinic workflow stable
- [ ] No scope creep detected
- [ ] No extra features added
- [ ] System is capstone-ready

---

## 📞 IF UNCERTAIN

**Always:**

1. Re-check the schema in `supabase_migrations/`
2. Re-check this Phase 9 documentation
3. Refer to `core/config.js` for system constants
4. Check `core/scan-actions.js` for scan processing logic
5. **DO NOT invent solutions** — use existing structure

---

**Document Version:** 1.0.0  
**Created:** Phase 9 Production Stabilization  
**Status:** READY FOR IMPLEMENTATION  
**Last Updated:** 2026-02-04

---

## 🎯 PROMPT FOR DEV AI (Copy-Paste Ready)

```
You are operating in Phase 9: Production-Level Stabilization (Capstone Level).

ABSOLUTE RULES (NON-NEGOTIABLE):
- DO NOT add new features
- DO NOT modify business logic
- DO NOT invent new tables or fields
- DO NOT change UI flows
- ONLY stabilize, optimize, and harden existing features
- ALWAYS check the database schema before coding
- If something breaks → fix it using existing structure

CRITICAL REQUIREMENTS:
1. School Name "Educare Colleges Inc" must be FIXED CONSTANT in core/config.js - NOT EDITABLE
2. Student ID Format: EDU-YYYY-LAST4LRN-XXXX (NOT EDU-YYYY-LLLL-XXXX)
3. QR Scanner must use unified jsQR logic from core/qr-camera.js
4. All scanner files must use same validation: core/scan-actions.js
5. No role data leakage - verify RLS policies

REFERENCE FILES:
- core/config.js - System constants
- core/qr-camera.js - Scanner implementation
- core/scan-actions.js - Scan validation
- supabase_migrations/ - Database schema
- progress/2026-02-04_1630_phase9_production_stabilization.md - Full spec
```
