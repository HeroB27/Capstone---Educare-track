# Modular Admin Refactoring & Feature Completion

I will refactor the current monolithic Admin dashboard into a modular structure by creating dedicated HTML and JS files for each feature. This improves maintainability and follows the "Educare Track" design specifications.

## 1. Modular Admin Structure
Each feature will have its own dedicated page while maintaining a consistent layout:
- **Dashboard Overview**: `admin-dashboard.html` / `js/admin-dashboard.js`
- **User Management**: `admin-users.html` / `js/admin-users.js`
- **Class Management**: `admin-classes.html` / `js/admin-classes.js`
- **Analytics & Reports**: `admin-analytics.html` / `js/admin-analytics.js`
- **Announcements**: `admin-announcements.html` / `js/admin-announcements.js`
- **ID Management**: `admin-ids.html` / `js/admin-ids.js`
- **School Calendar**: `admin-calendar.html` / `js/admin-calendar.js`
- **System Settings**: `admin-settings.html` / `js/admin-settings.js`

## 2. Shared Layout Strategy
To ensure a consistent UI across all pages:
- I will create a shared navigation component to keep the sidebar and header uniform.
- Navigation links will be updated to link directly to the new `.html` files instead of toggling sections.

## 3. Implementation of Remaining Features
- **ID Management**: A searchable interface to generate and re-print student/staff ID cards with QR codes.
- **User CRUD**: Adding "Edit Profile" and "Delete/Deactivate" capabilities to the User Management module.
- **Analytics Export**: Implementation of CSV/PDF export for attendance trends and clinic logs.
- **Subject-Based Attendance**: Backend logic and UI for teachers to track attendance per subject.
- **Admin Notifications**: Real-time alerts for "Forgot Password" requests and critical medical alerts from the clinic.

## 4. Technical Details
- **Real-time Updates**: Ensuring Supabase real-time subscriptions work across the modular pages.
- **State Management**: Using `utils.js` to share common state and authentication checks.
- **UI Consistency**: Strictly following the Tailwind CSS "Violet" theme for all Admin modules.

Would you like me to proceed with creating the first few modular files (Announcements and Users)?
