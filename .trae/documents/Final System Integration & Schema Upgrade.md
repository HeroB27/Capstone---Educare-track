# Final System Integration & Schema Upgrade Plan

I will integrate the **Final Master System Prompt** requirements, ensuring strict adherence to the schema-locked architecture and implementing the approved upgrades.

## 1. Schema Upgrade (Mandatory)
I will update [Supabase Tables.txt](file:///c:/Users/Lenovo%20Track%20-%20FINAL/Supabase%20Tables.txt) to include the required implementation tables:
- **`attendance_validations`**: To handle teacher-validated roll call locks (replacing imaginary session tables).
- **`audit_logs`**: To track all administrative overrides, ID reissues, and corrective actions.
- **`subjects`**: To provide a standardized reference for subject codes and grade levels.

## 2. Refine Teacher Module (Canvas-Style Logic)
I will update the Teacher module to follow the "Process Authority" rule:
- **[teacher-attendance.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/teacher-attendance.js)**: 
    - Implement the logic where the UI becomes read-only after an entry is created in `attendance_validations`.
    - Ensure manual marks are inserted as new rows in the `attendance` table with `method = 'manual'`.
- **Audit Integration**: Every manual override or validation lock will trigger an entry in the `audit_logs` table.

## 3. Refine Admin Module (Governance & History)
I will align the Admin tools with the "History-Based" model:
- **[admin-users.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/admin-users.js)**: Ensure ID reissues and profile changes are logged to `audit_logs`.
- **[admin-analytics.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/admin-analytics.js)**: Update queries to calculate attendance rates based on the append-only history in the `attendance` table, prioritizing `excused` statuses.

## 4. Data Integrity & Cleanup
- **[data-initializer.html](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/data-initializer.html)**: Update the "Clear All Data" function to include the new tables (`attendance_validations`, `audit_logs`, `subjects`) in the correct deletion order.

**Does this final integration plan align with your architectural vision?**