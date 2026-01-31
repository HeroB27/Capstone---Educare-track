# Database Cleanup & Data Re-Initialization Plan

To resolve the duplicate data issue and ensure a clean environment for Admin refinement, I will perform the following steps:

## 1. Implement "Reset Database" Feature
I will update [data-initializer.html](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/data-initializer.html) to include a powerful cleanup function.
- **Ordered Deletion**: Implement a script to delete all records from all tables in the correct sequence to avoid foreign key constraint violations (starting from `attendance` and `clinic_visits` down to the `profiles` table).
- **Cleanup Button**: Add a "Clear All Data" button to the UI that performs this full reset before starting a fresh initialization.

## 2. Fresh Data Initialization
Once the database is cleared, I will run the initialization logic again to create a perfectly clean set of dummy data:
- **Unique Records**: 2 Admins, 20 Teachers, 2 Guards, 2 Clinic Staff.
- **Structured Classes**: Kinder to Grade 12 (13 classes total).
- **Enrolled Students**: 65 unique students (5 per class) with their associated parents.
- **Clean Attendance Logs**: Fresh, non-duplicated logs from November 2025 to January 2026.

## 3. Update Schema Documentation
I will then update [Supabase Tables.txt](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/Supabase%20Tables.txt) to match the final, refined structure we've built, including the updated `attendance_status_check` and storage bucket details.

## 4. Admin Feature Refinements
With a clean dataset, I will finalize the Admin features:
- **Unified Staff Editing**: Ensure the "Edit User" modal in [admin-users.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/admin-users.js) handles all staff roles (Teachers, Guards, Clinic) and their specific fields correctly.
- **Analytics Verification**: Verify that charts correctly display the newly generated, clean data.

**Does this "Clean & Reset" approach work for you?**