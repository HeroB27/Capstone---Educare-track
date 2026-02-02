# System-Wide Cleanup and Login Stabilization Plan

I will stabilize the login flow and clean up redundant configurations to ensure smooth system operation.

## 1. Stabilization of Login & Session Management
- **Centralize Redirects**: Update [auth.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/auth.js) to ensure all role-based redirects use absolute-style paths (e.g., `/admin/admin-dashboard.html`) to prevent 404s when navigating from subdirectories.
- **Fix RLS Handling**: Ensure that if a profile fetch fails (common after a migration or RLS change), the user is gracefully signed out and given a clear instruction to contact the admin or run the SQL fix.
- **Normalize Domain Check**: Soften the email domain check in [auth.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/auth.js) to allow any valid email but still warn about the seeded `.edu` domain for new users.

## 2. Config & Directory Cleanup
- **Remove Redundant Codebase**: Delete the [Capstone---Educare-track](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/Capstone---Educare-track) directory. This directory contains outdated authentication logic (plain-text password queries) and conflicting configurations that cause developer confusion and potential runtime imports of stale files.
- **Single Source of Truth**: Standardize all imports to point to the root [js/supabase-config.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/supabase-config.js).

## 3. Fix Admin System Consistency
- **User Management Refinement**:
    - Update [admin-users.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/admin/admin-users.js) to use `crypto.randomUUID()` consistently for new profiles.
    - Fix the Edge Function calls (`admin-create-user`) to ensure they correctly receive the Supabase Service Role or proper Admin tokens.
- **ID Management Fix**:
    - Correct the join in [admin-ids.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/admin/admin-ids.js) to use the junction table: `parent_students(parents(profiles(full_name, phone)))`.
- **Analytics Date Normalization**:
    - Ensure [admin-analytics.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/admin/admin-analytics.js) uses the unified date filtering (midnight start) implemented in previous steps.

## 4. Verification
- Verify login flow for all 5 roles (Admin, Teacher, Parent, Clinic, Guard).
- Verify that deleting the redundant folder doesn't break any relative path imports in the main `admin/`, `teacher/`, etc. folders.
- Ensure the "Forgot Password" modal correctly sends reset emails via Supabase Auth.
