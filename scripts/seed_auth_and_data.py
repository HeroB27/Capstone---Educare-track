import os
import json
import requests
from dotenv import load_dotenv

# Load credentials
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SERVICE_KEY:
    print("❌ ERROR: SUPABASE_URL or SERVICE_KEY missing in .env")
    exit(1)

# API Endpoints
AUTH_URL = f"{SUPABASE_URL}/auth/v1/admin/users"
PROFILES_URL = f"{SUPABASE_URL}/rest/v1/profiles"
SUBJECTS_URL = f"{SUPABASE_URL}/rest/v1/subjects"

HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates"
}

TEST_USERS = [
    {"email": "admin1@educare.edu", "role": "admin", "name": "System Administrator"},
    {"email": "teacher1@educare.edu", "role": "teacher", "name": "Senior Teacher"},
    {"email": "guard1@educare.edu", "role": "guard", "name": "Campus Guard"},
    {"email": "parent1@educare.edu", "role": "parent", "name": "Student Parent"},
]

# K-12 SUBJECT DATA
K12_SUBJECTS = [
    # Kindergarten
    {"code": "K-LLC", "name": "Language, Literacy & Communication", "grade_level": "Kindergarten", "type": "core"},
    {"code": "K-MATH", "name": "Mathematics", "grade_level": "Kindergarten", "type": "core"},
    {"code": "K-PHMD", "name": "Physical Health & Motor Development", "grade_level": "Kindergarten", "type": "core"},
    {"code": "K-SED", "name": "Social & Emotional Development", "grade_level": "Kindergarten", "type": "core"},
    {"code": "K-VD", "name": "Values Development", "grade_level": "Kindergarten", "type": "core"},
    {"code": "K-ACD", "name": "Aesthetic & Creative Development", "grade_level": "Kindergarten", "type": "core"},
    
    # Elementary Grades 1-3
    {"code": "E1-MT", "name": "Mother Tongue", "grade_level": "1", "type": "core"},
    {"code": "E1-FIL", "name": "Filipino", "grade_level": "1", "type": "core"},
    {"code": "E1-ENG", "name": "English", "grade_level": "1", "type": "core"},
    {"code": "E1-MATH", "name": "Mathematics", "grade_level": "1", "type": "core"},
    {"code": "E1-SCI", "name": "Science", "grade_level": "1", "type": "core"},
    {"code": "E1-AP", "name": "Araling Panlipunan", "grade_level": "1", "type": "core"},
    {"code": "E1-MAPEH", "name": "MAPEH", "grade_level": "1", "type": "core"},
    {"code": "E1-ESP", "name": "Edukasyon sa Pagpapakatao (EsP)", "grade_level": "1", "type": "core"},
    
    # Elementary Grades 4-6
    {"code": "E4-EPP", "name": "EPP (HE + ICT + IA)", "grade_level": "4", "type": "core"},
    {"code": "E4-FIL", "name": "Filipino", "grade_level": "4", "type": "core"},
    {"code": "E4-ENG", "name": "English", "grade_level": "4", "type": "core"},
    
    # Junior High (7-10)
    {"code": "J7-TLE", "name": "TLE (ICT/HE/AFA/IA)", "grade_level": "7", "type": "core"},
    {"code": "J7-FIL", "name": "Filipino", "grade_level": "7", "type": "core"},
    
    # SHS Grade 11 - Semester 1 (Core & Applied)
    {"code": "S11-S1-ORAL", "name": "Oral Communication", "grade_level": "11", "semester": "1", "type": "core"},
    {"code": "S11-S1-KOM", "name": "Komunikasyon at Pananaliksik", "grade_level": "11", "semester": "1", "type": "core"},
    {"code": "S11-S1-GMATH", "name": "General Mathematics", "grade_level": "11", "semester": "1", "type": "core"},
    {"code": "S11-S1-ELS", "name": "Earth and Life Science", "grade_level": "11", "semester": "1", "type": "core"},
    {"code": "S11-S1-PERDEV", "name": "Personal Development", "grade_level": "11", "semester": "1", "type": "core"},
    {"code": "S11-S1-PE1", "name": "PE & Health 1", "grade_level": "11", "semester": "1", "type": "core"},
    {"code": "S11-S1-EMPTECH", "name": "Empowerment Technologies", "grade_level": "11", "semester": "1", "type": "applied"},
    
    # STEM Specialization
    {"code": "STEM-11-S1-PRECAL", "name": "Pre-Calculus", "grade_level": "11", "semester": "1", "strand": "STEM", "type": "specialization"},
    {"code": "STEM-11-S1-BIO1", "name": "General Biology 1", "grade_level": "11", "semester": "1", "strand": "STEM", "type": "specialization"},
    {"code": "STEM-11-S1-CHEM1", "name": "General Chemistry 1", "grade_level": "11", "semester": "1", "strand": "STEM", "type": "specialization"},
    
    # ABM Specialization
    {"code": "ABM-11-S1-FABM1", "name": "FABM 1", "grade_level": "11", "semester": "1", "strand": "ABM", "type": "specialization"},
    {"code": "ABM-11-S1-BMATH", "name": "Business Math", "grade_level": "11", "semester": "1", "strand": "ABM", "type": "specialization"},
    {"code": "ABM-11-S1-ECON", "name": "Applied Economics", "grade_level": "11", "semester": "1", "strand": "ABM", "type": "specialization"},
]

def seed():
    print("🚀 NUCLEAR SEEDER STARTING...")
    
    # 1. Seed Users
    for user in TEST_USERS:
        print(f"--- User: {user['email']} ---")
        auth_payload = {"email": user["email"], "password": "Educare@2024", "email_confirm": True, "user_metadata": {"full_name": user["name"], "role": user["role"]}}
        res = requests.post(AUTH_URL, headers=HEADERS, json=auth_payload)
        user_id = res.json().get("id") if res.status_code in [200, 201] else None
        
        if not user_id:
            search_res = requests.get(AUTH_URL, headers=HEADERS)
            if search_res.status_code == 200:
                existing = [u for u in search_res.json() if u["email"] == user["email"]]
                if existing: user_id = existing[0]["id"]
        
        if user_id:
            profile_payload = {"id": user_id, "email": user["email"], "full_name": user["name"], "role": user["role"], "is_active": True}
            requests.post(PROFILES_URL, headers=HEADERS, json=profile_payload)
            print(f"✅ User & Profile Ready")

    # 2. Seed Subjects
    print("\n--- Seeding K-12 Subjects ---")
    for sub in K12_SUBJECTS:
        res = requests.post(SUBJECTS_URL, headers=HEADERS, json=sub)
        if res.status_code in [200, 201, 204]:
            print(f"✅ Subject: {sub['name']} ({sub['code']})")
        else:
            print(f"❌ Failed {sub['code']}: {res.text}")

    print("\n🏁 NUCLEAR SEED COMPLETE!")

if __name__ == "__main__":
    seed()
