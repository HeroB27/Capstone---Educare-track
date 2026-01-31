# Comprehensive Admin & Class Management Fixes

I will address the UI issues, database errors, and implement the advanced User and Class Management features as requested.

## 1. UI & Analytics Fixes
- **Dashboard Chart**: Resize the attendance trend chart in [admin-dashboard.html](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/pages/admin-dashboard.html) by wrapping it in a constrained container and adjusting Chart.js options for better responsiveness.
- **Analytics Error**: Fix the `grade_level` error in [admin-analytics.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/admin-analytics.js) by correctly joining the `classes` table to retrieve student grades.
- **Supabase Queries**: Resolve the 400 errors in [admin-users.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/admin-users.js) by cleaning up the select parameters.

## 2. Advanced User Management (CRUD)
- **Multi-step Parent/Student Modal**:
  - **Step 1**: Parent Info (Name, Phone, Address, Role).
  - **Step 2**: Account Creation (Username/Password).
  - **Step 3**: Student Info (Name, full LRN, Grade, Strand) with **Photo Upload** support.
  - **Step 4**: ID Generation & Printing with the updated naming convention: `EDU-(year)-LRN-XXXX`.
  - **Multi-student Support**: Add an "Add another student" option to link multiple children to a single parent account.
- **Staff Modals**: Dedicated modals for adding Teacher, Clinic, and Guard staff with ID generation: `[Role]-year-phone-XXXX`.
- **Forgot Password**: Implement a "Request Reset" modal that sends a real-time notification to the Admin.

## 3. Class & Scheduling System (CRUD)
- **Full CRUD for Classes**: Create, Update, and Delete grade levels.
- **Scheduling System**:
  - Assign Homeroom teachers (1st period).
  - Assign Subject teachers for subsequent periods (Math, English, Science, etc.).
  - Implement predefined K-12 subjects (Kinder-10 and SHS strands like STEM, ABM).
- **Attendance Integration**: Ensure the scheduling system supports the new per-subject attendance tracking for teachers.

## 4. Calendar & Settings
- **Calendar Integration**: Add a calendar view to [admin-settings.html](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/pages/admin-settings.html) for managing school-wide events and holidays.

Would you like me to start with the UI fixes and the Parent/Student modal overhaul?
