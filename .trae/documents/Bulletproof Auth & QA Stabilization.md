# Bulletproof Authentication & QA Stabilization Plan

I will act as a Senior Full-Stack Developer and QA Engineer to stabilize the login system, implement inactive account blocking, and add comprehensive audit logging.

## Phase 1: Instrumentation & Deep Debugging
- **Detailed Logging**: Inject `console.group` instrumentation into [auth.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/auth.js) to track:
    1.  **Request Payload**: Validate sanitized input before sending to Supabase.
    2.  **Auth Response**: Log Supabase Auth metadata (excluding sensitive tokens).
    3.  **Profile Retrieval**: Verify role, `is_active` status, and RLS permissions.
    4.  **Redirection Trace**: Log the calculated destination path.

## Phase 2: Logic Fixes & Security Hardening
- **Inactive Account Blocking**:
    - Update [auth.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/auth.js) to explicitly check the `is_active` flag in the `profiles` table.
    - If `is_active` is false, immediately sign out the user and display a "Your account has been deactivated" error.
- **Audit Logging Implementation**:
    - Record all login attempts (success and failure) to the `audit_logs` table.
    - Log failure reasons (e.g., "invalid_credentials", "inactive_account") for administrative review.
- **Robust Redirection**:
    - Standardize all role-based redirects to use absolute paths (e.g., `/admin/admin-dashboard.html`) to prevent routing failures from different entry points.

## Phase 3: UI/UX Improvements
- **Loading States**:
    - Update the login form in [index.html](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/index.html) to show a loading spinner and disable the submit button during authentication.
- **Clear Error Messaging**:
    - Map Supabase error codes to user-friendly messages (e.g., "Too many failed attempts. Please try again later" for rate-limiting).
- **Session Stability**:
    - Ensure the `DOMContentLoaded` session check also validates account activity status.

## Phase 4: QA Verification Suite
I will verify the following scenarios after implementation:
1.  **Correct Credentials**: Success and redirect to role-specific dashboard.
2.  **Wrong Password**: Clear error message and logged failure.
3.  **Inactive User**: Login blocked with "Account Deactivated" message.
4.  **Non-existent User**: Standard "Invalid credentials" error.
5.  **Role Verification**: Admin redirected to `/admin/`, Teacher to `/teacher/`, etc.

## Key Deliverables
- **Instrumented `auth.js`**: Now includes audit logging and activity checks.
- **Enhanced `index.html`**: Now features a loading state for better feedback.
- **Audit Log Trail**: Verified entries in the database for login events.
