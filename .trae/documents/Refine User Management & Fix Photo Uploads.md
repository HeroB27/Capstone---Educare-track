# EDUCARETRACK - User Management Refinement Plan

I will refine the User Management module to match the professional specification and fix the photo upload errors.

## 1. Fix Storage & Permissions
- **Verify Storage Bucket**: Ensure the `photos` bucket exists in Supabase and has public access policies for `staff/` and `students/` folders.
- **Path Sanitization**: Ensure the `filePath` in `uploadPhoto` doesn't contain invalid characters.

## 2. Refined ID Generation ([utils.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/utils.js))
- Update `generateStudentID` and `generateStaffID` to strictly follow:
  - Students: `EDU-YYYY-LRN-XXXX` (where LRN is the last 4 digits).
  - Staff: `PREFIX-YYYY-PHONE4-XXXX`.
- **Real-time Auto-fill**: Add input listeners to the modals in [admin-users.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/admin-users.js) so the "Username" field updates as the admin types the contact number or LRN.

## 3. Polished Parent/Student Modal
- **Multi-child Support**: 
  - Ensure the "Add Student to List" button properly stores each student in the `tempStudents` array.
  - Fix the submission logic to iterate through the array and create both student records and `parent_students` links.
- **ID Preview**: Allow the admin to toggle between student IDs if multiple were added.
- **Account Activation**: Ensure the profile is created with `is_active: true` by default (auto-active upon first login logic).

## 4. Enhanced User Table & CRUD
- **Activate/Deactivate**: Ensure the status toggle in the Edit modal works reliably.
- **Gatekeeper Logic**: 
  - Verify the `teachers` table has the `is_gatekeeper` column.
  - Ensure the toggle in the table updates the database in real-time.
- **Password Reset**: Implement the reset logic where the admin can manually set a temporary password.

## 5. Password Reset Request System
- **Login Page**: Add a "Forgot Password" link that opens a modal for parents to submit a request.
- **Admin Notification**: Store these requests in a `notifications` table so they appear on the Admin Dashboard's bell icon.

Would you like me to start by fixing the photo upload and ID generation logic?
