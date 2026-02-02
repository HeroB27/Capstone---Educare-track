## Enhanced System Architecture & Feature Implementation Plan

I will upgrade the Educare Track system to match the "FINAL" feature set, focusing on the new naming conventions, refined user flows, and the comprehensive UI/UX requirements.

### 1. **Database Schema Upgrade (`MASTER_RESET.sql`)**
- **Custom Identifiers**: Add `custom_id` to `profiles` and `students` to support the `EDU-YYYY-LLLL-XXXX` and `ADM/TCH/CLC/GRD-YYYY-LLLL-XXXX` formats.
- **Granular Attendance Rules**: Update `attendance_rules` to include `dismissal_time` and grade-specific constraints (Kinder half-day, Grades 1-3, etc.).
- **Clinic Flow Support**: Refine `clinic_passes` and `clinic_visits` to support the "Pass Admission -> Approval -> Tap-in" workflow.

### 2. **Final Data Seeding (`SEED_DATA.sql`)**
- **Naming Convention Alignment**: Implement the specific ID generation logic using current year, phone/LRN digits, and random suffixes.
- **Academic Population**: 
    - **Kindergarten**: No sections, specialized subjects.
    - **Elementary & JHS**: Grade 1-10, no sections, full curriculum.
    - **Senior High**: Grades 11-12 with ABM, STEM, HUMSS, and TVL-ICT strands.
- **Historical Attendance**: Generate complex logs for the past 3 months following the new tap-in/out logic (late entry, early exit, afternoon-only entry, etc.).

### 3. **UI/UX & Module Development**
- **Core Design**:
    - Apply Tailwind-based color themes: **Admin (Violet)**, **Teacher (Blue)**, **Parent (Green)**, **Guard (Yellow)**, **Clinic (Red)**.
    - Implement a responsive, scrollable sidebar navigation.
- **Admin Modules**:
    - **User Management**: Modals for Parent/Student linking and Staff creation.
    - **Analytics**: Trend analysis charts (Trend, Pie, Bar, Line) and "Critical Absence" (20+ days) lists.
    - **ID Management**: 2x3 card layout (Front: Photo/Info, Back: QR/Parent Details).
    - **School Calendar**: Dedicated page for holidays and suspension management.
- **Guard & Clinic Flows**:
    - **Guard Scanner**: Mobile/PC modes with real-time parent notifications.
    - **Clinic Portal**: Complete admission flow with teacher notifications and parent findings.

### 4. **PWA & Final Polish**
- Ensure the app is PWA-ready for mobile scanning compatibility.
- Implement the "Forgot Password" admin notification request modal.

Would you like me to proceed with the schema and seeding updates first?
