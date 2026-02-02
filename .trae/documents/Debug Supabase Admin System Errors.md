## **Supabase Admin System Debugging Plan**

I will act as a debug engineer to resolve the listed runtime errors by aligning the frontend queries and payloads with the provided database schema.

### **1. Notifications - Fix 400 Bad Request**
- **Issue**: Filtering on `read` column causes 400, and `auth.js` attempts to insert into non-existent columns (`title`, `message`, `type`, `user_id`).
- **Fix**:
    - Update `admin-dashboard.js` and `parent-dashboard.js` to ensure `user.id` is a valid UUID before querying `recipient_id`.
    - Update `auth.js` notification insertion to use schema-compliant columns: `recipient_id`, `actor_id`, `verb`, and `object`.
    - Verify if the `read` column is actually `is_read` in the live DB (though the text file says `read`).

### **2. Add Staff & Invalid UUID - Fix 400 Bad Request**
- **Issue**: `profiles.id` is a UUID, but the system might be trying to use a custom string like `TCH-2026-5566-AK5N` as the primary key.
- **Fix**:
    - In `admin-users.js`, ensure `profiles.id` is always populated with a generated UUID (`crypto.randomUUID()`).
    - Store the custom `staffID` (e.g., `TCH-...`) in the `employee_no` column of the `teachers` table instead of the `id` column.
    - Ensure all role-specific tables (`teachers`, `guards`, `clinic_staff`) use the UUID as their primary key.

### **3. User Not Showing - Fix 400/401**
- **Issue**: `fetchUsers` join query `teachers(is_gatekeeper)` fails or is blocked by RLS.
- **Fix**:
    - Simplify the `select` query in `admin-users.js` to ensure it fetches correctly even if role records are missing.
    - Add error handling to `fetchUsers` to identify specific RLS or join failures.

### **4. QR Code - Fix 401 Unauthorized**
- **Issue**: `qr_codes` table insertion fails due to missing `created_by` or RLS permissions.
- **Fix**:
    - Add `created_by: (utils.getCurrentUser()).id` to the insert payload in `admin-users.js` and `admin-ids.js`.
    - Ensure the current admin user's UUID is correctly passed.

### **5. Data Analytics - Fix Empty UI**
- **Issue**: Tables have data, but UI is empty due to column name mismatch (`grade_level` vs `grade`).
- **Fix**:
    - Update `admin-analytics.js` to use `grade_level` consistently as defined in the `students` table schema.
    - Fix the join between `attendance` and `students` to ensure data mapping works.

### **6. ID Management - Fix 406 & 401**
- **Issue**: 406 Not Acceptable due to invalid direct join `parents` on `students`.
- **Fix**:
    - Correct the join in `admin-ids.js` to go through the junction table: `parent_students(parents(profiles(full_name, phone)))`.
    - Resolve the 401 error by ensuring the query is allowed for the admin role.

### **7. Announcements - Fix Mismatched Columns**
- **Issue**: `message` and `created_by` columns do not exist in the `announcements` table.
- **Fix**:
    - Update `admin-announcements.js` to use `content` instead of `message` and `posted_by` instead of `created_by`.

I will implement these fixes sequentially and verify each one to ensure no more console errors occur.
