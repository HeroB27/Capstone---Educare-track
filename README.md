# Educare Track - School Management System

A comprehensive web-based school management system with role-based access control, real-time attendance tracking, and integrated clinic/guard workflows.

---

## 🎯 Quick Start: How to Open the System

### Step 1: Navigate to the Project
Open the `Educare Track` folder in your file explorer (or VS Code):
```
C:\Users\Lenovo\Desktop\OFFICIAL EDUCARE TRACK
```

### Step 2: Open the Login Page

**Option 1: Direct File Open**
1. Go to the `auth` folder
2. Double-click on `login.html`
3. The system will open in your default browser

**Option 2: Using VS Code Live Server**
1. Open the project in VS Code
2. Install "Live Server" extension if not installed
3. Right-click on `auth/login.html` → "Open with Live Server"

**Option 3: Using Python HTTP Server**
1. Open terminal/command prompt
2. Navigate to the project folder
3. Run: `python -m http.server 8000`
4. Open browser: `http://localhost:8000/auth/login.html`

### Step 3: Login
Use the test credentials below (all use the same password):

| Role    | Email                     | Password    | Username          |
|---------|---------------------------|-------------|-------------------|
| Admin   | admin.test@educare.local  | Password123!| ADM-2026-0001-0001|
| Teacher | teacher.test@educare.local| Password123!| TCH-2026-0001-0001|
| Parent  | parent.test@educare.local | Password123!| PAR-2026-0001-0001|
| Guard   | guard.test@educare.local  | Password123!| GRD-2026-0001-0001|
| Clinic  | clinic.test@educare.local | Password123!| CLC-2026-0001-0001|

---


## 🚀 Features

- **Multi-role Dashboard**: Admin, Teacher, Parent, Guard, Clinic roles
- **Real-time Attendance**: QR code scanning for student check-in/out
- **Clinic Management**: Medical pass approval and tracking
- **Parent Portal**: Student progress monitoring and excuse submission
- **Admin Controls**: User management, announcements, and system configuration
- **PWA Support**: Installable as a mobile/desktop app
- **Supabase Backend**: Secure real-time database with Row Level Security

## 📋 Prerequisites

- Node.js 16+ 
- Modern web browser with camera access (for QR scanning)
- Supabase account (for database backend)

## 🛠️ Setup Instructions

### 1. Clone or Download the Repository

If you have the code as a folder (not from Git):
1. Extract the folder to your desired location
2. Open the folder in your code editor or file explorer

### 2. Open the Application

**Option A: Simple File Opening**
1. Navigate to the `auth` folder
2. Double-click `login.html` to open in your default browser
3. The application will load with the login interface

**Option B: Local Development Server**
1. Open terminal/command prompt in the project root
2. Run a local server:
   ```bash
   # Using Python (if installed)
   python -m http.server 8000
   
   # Using Node.js http-server (install with: npm install -g http-server)
   http-server -p 8000
   ```
3. Open `http://localhost:8000/auth/login.html` in your browser

### 3. Configure Supabase (Required for Full Functionality)

The application uses a pre-configured Supabase project. For development:

1. Create a Supabase account at [supabase.com](https://supabase.com)
2. Create a new project
3. Replace the credentials in `core/config.js`:
   ```javascript
   export const SUPABASE_URL = "your-supabase-url";
   export const SUPABASE_ANON_KEY = "your-anon-key";
   ```
4. Run the database migrations from `supabase_migrations/` folder

## 👥 Test Login Credentials

Use these pre-configured test accounts (all use the same password):

**Admin**:
- Email: `admin.test@educare.local`
- Password: `Password123!`
- Username: `ADM-2026-0001-0001`

**Teacher**: 
- Email: `teacher.test@educare.local`
- Password: `Password123!`
- Username: `TCH-2026-0001-0001`

**Parent**:
- Email: `parent.test@educare.local`
- Password: `Password123!`
- Username: `PAR-2026-0001-0001`
- **Linked Student**: Test Student (LRN: 123456789012, Grade 7 STEM)

**Guard**:
- Email: `guard.test@educare.local`
- Password: `Password123!`
- Username: `GRD-2026-0001-0001`

**Clinic**:
- Email: `clinic.test@educare.local`
- Password: `Password123!`
- Username: `CLC-2026-0001-0001`

## 📁 Project Structure

```
├── admin/           # Admin dashboard and management interfaces
├── auth/            # Authentication pages
├── clinic/          # Clinic management and medical passes
├── core/            # Core utilities and configuration
├── guard/           # Guard scanning and attendance
├── parent/          # Parent portal
├── teacher/         # Teacher dashboard and class management
├── supabase_migrations/ # Database schema migrations
├── scripts/         # User provisioning and seeding
└── progress/        # Development progress reports
```

## 🔧 Development

### User Provisioning

The system includes scripts to create test users:

```bash
# Seed test users with all roles (Admin, Teacher, Parent, Guard, Clinic)
node scripts/seed-test-users.mjs

# Seed sample users with roles (legacy)
npm run seed:users

# Provision users from JSON payload
npm run provision:users
```

### Database Migrations

Apply database changes using the SQL files in `supabase_migrations/`:

1. `2026-02-04_phase3_teachers_parents_v0.0.1.sql` - Teacher/parent functions
2. `2026-02-04_phase4_guard_clinic_v0.0.1.sql` - Guard/clinic workflows  
3. `2026-02-04_phase5_admin_policies_v1.0.0.sql` - Admin security policies

## 📱 PWA Installation

The app is a Progressive Web App (PWA). To install:

1. Open the app in Chrome/Edge
2. Click the install icon in the address bar
3. Or use browser menu: "Install Educare Track"

## 🚨 Important Notes

- **Camera Access**: Required for QR code scanning functionality
- **HTTPS**: Required for camera access in production
- **Browser Support**: Modern browsers with ES6 module support
- **Local Storage**: User sessions are stored in browser local storage

## ✅ Recent Updates & Bug Fixes

The system has been enhanced with critical bug fixes and new features:

### Fixed Issues:
- **Parent Excuse Upload**: Fixed HTML/JS element mismatch that prevented form submission
- **Guard Parent Notifications**: Added real-time notifications to parents when students tap in/out
- **Teacher Duplicate Clinic Passes**: Implemented prevention for issuing multiple passes to same student
- **Parent Today's Subject**: Added actual subject display instead of placeholder text
- **Admin Export Report**: Implemented comprehensive CSV export functionality

### New Testing Infrastructure:
- **Test Users**: Pre-configured accounts for all roles with consistent password
- **Testing Guide**: Comprehensive [TESTING_GUIDE.md](TESTING_GUIDE.md) with detailed scenarios
- **Seed Script**: Easy user provisioning with `scripts/seed-test-users.mjs`

## 🐛 Troubleshooting

**QR Scanner Not Working**:
- Ensure camera permissions are granted
- Use HTTPS in production environments
- Try a different browser if issues persist

**Login Issues**:
- Check Supabase project configuration
- Verify internet connection
- Clear browser cache and try again

**Database Errors**:
- Run all migration files in order
- Check Row Level Security policies

## 📄 License

This project is for educational purposes. Ensure proper licensing for production use.

## 🤝 Support

For technical issues or questions about the implementation, refer to the progress reports in the `progress/` folder or check the migration files for database schema details.