## Implement Comprehensive Seed Data for Educare Track
I will create a SQL script that populates the database with realistic sample data, covering all 25+ tables mentioned in your schema.

### 1. **Core Staff & Roles**
- **Admin**: Create 1 Super Admin account.
- **Support Staff**: Create 2 Campus Guards and 2 Clinic Nurses.
- **Teachers (30)**: 
    - 12 Teachers assigned as Homeroom Advisers for Grades 7-12 (Sections A & B).
    - 18 Subject Teachers with no homeroom.
    - 3 Teachers designated as Gatekeepers.
    - Randomly assigned subjects (Math, Science, English, ICT, etc.) and employee numbers.

### 2. **Academic Structure**
- **Classes (12)**: Grade 7 to Grade 12, each with two sections (e.g., `7-A`, `7-B`).
- **Subjects**: Full curriculum for Junior and Senior High (Core, Applied, and Specialized).
- **Schedules**: Weekly class schedules mapping subjects, teachers, and time slots for every class.

### 3. **Students & Parents**
- **Students (60)**: 5 students per class, each with unique LRNs, bio-data, and profile photos.
- **Parents (30)**: Linked to students; some parents will have multiple children across different grade levels.
- **QR Codes**: Active QR hashes generated for every student.

### 4. **Attendance History (Nov 2025 - Feb 2026)**
- **Bulk Logs**: Automated generation of daily attendance for the past 3 months.
- **Status Distribution**: Realistic mix of 'Present' (85%), 'Late' (10%), and 'Absent' (5%).
- **Rules**: Grade-specific attendance rules (Entry starts at 6:00 AM, Grace until 7:30 AM).

### 5. **Support Modules**
- **Excuse Letters**: Sample letters for 'Absent' records with statuses like 'Approved' or 'Pending'.
- **Clinic Module**: Logs of student visits, treatment notes, and issued clinic passes.
- **Communications**: 
    - **Announcements**: School-wide and grade-specific posts.
    - **Notifications**: Alerts for parents regarding student entry/exit.
    - **Calendar**: Upcoming school events, holidays, and exams.
- **System Logs**: Initial settings and audit trail entries.

### **Technical Approach**
- I will provide a single, idempotent SQL script.
- I will use a PL/pgSQL loop to handle the high volume of attendance data efficiently.
- All foreign key relationships will be strictly maintained to ensure database integrity.

Would you like me to proceed with generating and applying this data?
