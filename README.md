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

## 🐍 Python Analytics Module
The project includes a Python-based analytics engine for advanced data processing.

### Setup
1. Navigate to the scripts folder: `cd scripts`
2. Install dependencies: `pip install -r requirements.txt`
3. Create a `.env` file based on `.env.example` and add your Supabase credentials.
4. Run the analysis: `python analytics_engine.py`

### Features
- **Attendance Risk Detection**: Automatically identifies students with absence rates exceeding 15%.
- **CSV Export**: Generates `attendance_risk_report.csv` for school administration use.

## 🔑 Default Credentials
- **Admin**: `admin1@educare.edu` / `Educare@2024`
- **Teacher**: `teacher1@educare.edu` / `Educare@2024`
- **Guard**: `guard1@educare.edu` / `Educare@2024`
- **Nurse**: `nurse1@educare.edu` / `Educare@2024`
- **Parent**: `parent1@educare.edu` / `Educare@2024`

---
*This repository contains the latest logic, workflows, and UI behavior as of Jan 31, 2026.*
