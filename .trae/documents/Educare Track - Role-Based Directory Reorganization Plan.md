# EDUCARE TRACK - Role-Based Directory Reorganization

I will restructure the codebase to group features into role-specific folders, making the project more organized and easier to maintain.

## 1. Directory Structure Changes
I will create the following folders in the project root:
-   `/admin/`: All administrator dashboards and logic.
-   `/teacher/`: All faculty management and classroom tools.
-   `/parent/`: Parent-facing status and alert views.
-   `/clinic/`: Medical records and clinic check-in features.
-   `/guard/`: Security scanner and arrival monitoring tools.

## 2. File Migration
I will move all files from `pages/` and the role-specific logic from `js/` into these new folders:
-   **Example**: `pages/admin-dashboard.html` and `js/admin-dashboard.js` will both move to `/admin/`.
-   **Shared Files**: `js/utils.js`, `js/supabase-config.js`, and `js/auth.js` will remain in the `/js/` folder as they are core shared utilities.

## 3. Link & Path Updates
After moving the files, I will update all internal references:
-   **Authentication**: Update `js/auth.js` to redirect users to the new folder paths (e.g., `admin/admin-dashboard.html` instead of `pages/admin-dashboard.html`).
-   **Navigation**: Update `js/utils.js` to ensure the sidebar links in each dashboard correctly point to other files within the same role folder.
-   **HTML Imports**: Update CSS and JS script paths in every HTML file to reflect their new relative positions (e.g., `../css/styles.css`).
-   **JS Imports**: Update ES module imports in all role-specific JS files to correctly find the shared `utils.js` and `supabase-config.js`.

## 4. Verification
I will verify that:
-   The login flow correctly redirects to the new folder structure.
-   All sidebar links function correctly within each role's module.
-   All assets (CSS, Icons) and database connections (Supabase) remain fully functional.

This reorganization will significantly improve the codebase's scalability as we add more role-specific features. Shall I begin the migration?