# Refine Edit User Modal & Password Management

I will update the User Management module to use a professional modal for editing users, including the ability to change passwords directly within the same interface.

## 1. UI Enhancements ([admin-users.html](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/pages/admin-users.html))
- **Update Edit User Modal**:
    - Add a **Password** field with a "Show/Hide" toggle.
    - Add a **Confirm Password** field for validation.
    - Include a note that the password field can be left blank if no change is desired.
    - Improve the modal layout to match the "Add Staff" modal styling.

## 2. Logic Updates ([admin-users.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/admin-users.js))
- **Refactor `editUser`**: 
    - Populate the modal with the user's current data.
    - Reset the password fields to empty when the modal opens.
- **Update `submitEditUser`**:
    - Implement validation: Ensure the password and confirm password fields match if a new password is provided.
    - Update the Supabase `profiles` table with the new data.
    - Only update the `password` column if the password field is not empty.
- **Cleanup**: Remove the legacy `resetPassword` function that uses the browser's native `prompt` dialog, as it is now integrated into the professional edit modal.

## 3. Verification
- Test editing a user's name/phone/status without changing the password.
- Test changing only the password.
- Test validation errors (e.g., passwords not matching).

Would you like me to proceed with these changes?
