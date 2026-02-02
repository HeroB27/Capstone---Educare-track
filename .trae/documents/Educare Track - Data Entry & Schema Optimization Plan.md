# EDUCARE TRACK - Data Entry & Schema Optimization Plan

## 1. Database Schema Alignment
I will update the Supabase schema to ensure all requested features are supported by the underlying data structure:
- **Announcements**: 
    - Add `audience` (text array) to support multi-role targeting.
    - Add `is_pinned` (boolean) for priority notices.
    - Rename/ensure `content` and `created_at` consistency with the frontend.
- **User Profiles & Students**:
    - Standardize personal fields (`gender`, `birthdate`, `nickname`) across `profiles` and `students` tables.
    - Ensure `students` table correctly handles `dob` and `gender` during registration.

## 2. Enhanced User Management (UI & Logic)
I will revamp the registration modals in [admin-users.html](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/pages/admin-users.html) and [admin-users.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/admin-users.js) to include missing essential fields:
- **Staff Registration**: Add fields for `Nickname`, `Gender`, and `Birthdate`.
- **Student Registration**: Add `Gender` and `Date of Birth` to the step-by-step modal.
- **Data Persistence**: Update the submission logic to ensure these fields are correctly saved to Supabase.
- **Profile Editing**: Ensure the "Edit User" modal allows updating these new fields.

## 3. Robust Announcement System
I will fix the announcement publishing flow to ensure it works as intended:
- **Audience Filtering**: Update [admin-announcements.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/admin-announcements.js) to correctly save the selected target roles (Teachers, Parents, etc.).
- **Logic Correction**: Fix field name mismatches (e.g., `message` vs `content`) between the frontend and database.
- **Pinned Feature**: Implement the pinning logic to keep important notices at the top of the feed.

## 4. Verification & Testing
- Perform a test registration for each role to verify all data entries are saved.
- Verify that announcements only appear for the selected audience roles.
- Generate a progress report confirming the schema and data entry fixes.

Shall I proceed with these updates?