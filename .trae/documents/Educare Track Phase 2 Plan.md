# Phase 2: Complete Admin Module Implementation

I will complete the remaining features for the Admin module as outlined in the system requirements.

## 1. User Management Expansion
- **Staff Registration Modal**: Implement a modal for adding Teachers, Clinic, and Guard staff.
- **Backend Logic**: Update `admin-dashboard.js` to create profiles and insert data into role-specific tables (`teachers`, `clinic_staff`, `guards`).
- **Staff ID Generation**: Implement automated ID generation (e.g., `TCH-YYYY-PHONE-XXXX`).

## 2. Class & Schedule Management
- **Class Interface**: Replace the placeholder with a list of classes (Kinder to Grade 12).
- **Teacher Assignment**: Build a flow to assign Homeroom teachers and Subject teachers to specific classes.
- **Automatic Sync**: Ensure assignments are reflected in the teacher's dashboard.

## 3. School-wide Announcements
- **Creation Portal**: Add a form to create announcements with target audience checkboxes (Teachers, Parents, Clinic, Guard).
- **Notification Integration**: Trigger system notifications for the selected audience.

## 4. Tap In/Out Settings
- **Configurable Schedule**: Implement a settings page to edit dismissal times for different grade levels (Kinder, G1-3, G4-6, JHS, SHS).
- **Persistence**: Save these settings to the `system_settings` table in Supabase.

## 5. School Calendar & Suspensions
- **Calendar Management**: Add a dedicated page to manage school holidays and emergency class suspensions.
- **Global Impact**: Ensure suspensions automatically mark students as "Excused" for that day.

## 6. Data Analytics & Reporting
- **Real-time Charts**: Connect the Pie, Bar, and Line graphs to real database queries (attendance trends, clinic visit reasons).
- **Critical Alerts**: Implement logic to list students with frequent absences (reaching the 20-day limit).

---
**Please confirm to proceed with these Admin module enhancements.**