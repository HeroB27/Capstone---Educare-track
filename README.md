# 🎓 EDUCARE TRACK - Smart School Monitoring System

This is the **new and final repository** for the Educare Track project. It is a production-grade school information system designed for real-world school environments.

## 🚀 Getting Started

### 1. Repository Access
- **URL**: `https://github.com/HeroB27/Capstone---Educare-track`
- **Clone Command**: 
  ```bash
  git clone https://github.com/HeroB27/Capstone---Educare-track.git
  ```

### 2. Running the Project
The project is built as a web-based PWA (Progressive Web App). To run it locally:
- Open your terminal in the project folder.
- Run a local server: `python -m http.server 8000`
- Access via: `http://localhost:8000`

### 3. Database Initialization
This project uses Supabase as its backend. To seed the database with sample data:
- Open `data-initializer.html` in your browser.
- Click **"Wipe & Seed Production Data"**.
- This will create Admins, Teachers, Guards, Nurses, and Students for testing.

## 🛠 Features Implemented
- **Admin**: System operator with full user and class management.
- **Teacher**: Class manager with roll call, excuse letters, and clinic passes.
- **Guard**: Gatekeeper with QR scanning and real-time tap-in/out logic.
- **Clinic**: Medical workflow with teacher-issued passes and nurse assessments.
- **Parent**: Monitoring app for real-time child status tracking.
- **PWA/Offline**: Service worker support and local CSS fallback for offline resilience.

## 🔑 Default Credentials
- **Admin**: `admin1` / `password123`
- **Teacher**: `teacher1` / `password123`
- **Guard**: `guard1` / `password123`
- **Nurse**: `nurse1` / `password123`
- **Parent**: `parent1` / `password123`

---
*This repository contains the latest logic, workflows, and UI behavior as of Jan 31, 2026.*
