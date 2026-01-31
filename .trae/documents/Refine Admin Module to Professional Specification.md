# EDUCARETRACK - Admin Module Enhancements

I will update the Admin Module to strictly align with the professional system specification.

## 1. Dashboard Enhancements
- **New Widgets**: Add "Total Teachers" and "Excused Absences" to the dashboard metrics.
- **Advanced Charts**: 
  - Add a **Line Graph** for "Performance Rate Over Time".
  - Add a **Bar Graph** for "Attendance Performance Per Class".
  - Refine existing Pie and Bar charts for consistent styling.

## 2. User & ID Management
- **Gatekeeper Role**: Add a toggle in the User Management table to assign/revoke the "Gatekeeper" role for Teachers.
- **Password Reset Flow**: 
  - Implement the "Reset Request" modal for parents.
  - Add real-time admin notifications for pending reset requests.
- **School ID (2x3 format)**:
  - Refine the front/back design with mandatory fields (School Name, Baguio address, Parent Name, Lost/Found Note).
  - Standardize the naming convention: `EDU-YYYY-LRNXXXX-RAND` and `PREFIX-YYYY-PHONELAST4-RAND`.

## 3. Class & Analytics Rules
- **Critical Absence Logic**:
  - **Critical**: 20 total absences.
  - **Warning**: 10 total absences.
- **Performance Ranking**: Add a ranking table in Class Management showing classes sorted by attendance percentage.
- **Extended Export**: Support for Excel and PDF exports in addition to CSV.

## 4. Calendar & Suspensions
- **Emergency Types**: Add "Earthquake", "Typhoon", and "Power outage" to the suspension event types.
- **Logic Update**: Ensure suspended days automatically disable attendance and mark logs as "No Class".

## 5. Technical Implementation
- Update [utils.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/utils.js) for standardized ID generation.
- Modify [admin-dashboard.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/admin-dashboard.js) and [admin-analytics.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/admin-analytics.js) for new chart logic.
- Enhance [admin-users.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/admin-users.js) for role toggles and reset requests.

Would you like me to begin with the Dashboard and Analytics updates?
