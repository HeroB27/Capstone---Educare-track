import os
import json
import urllib.request
from dotenv import load_dotenv

def http_json(method: str, url: str, headers: dict[str, str], body: dict | None = None) -> dict | list:
    data = None
    if body:
        data = json.dumps(body).encode("utf-8")
        headers = {**headers, "Content-Type": "application/json"}
    
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"Request failed: {e}")
        try:
            print(e.read().decode("utf-8"))
        except:
            pass
        return {}

def main():
    load_dotenv()
    url = os.getenv("SUPABASE_URL")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    target_password = os.getenv("EDUCARE_DEFAULT_PASSWORD", "Educare@2024")
    email_domain = os.getenv("EDUCARE_EMAIL_DOMAIN", "educare.edu").strip().lower()

    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
    }

    print(f"--- Updating Passwords to {target_password} ---")
    
    # 1. Get all users
    users_resp = http_json("GET", f"{url}/auth/v1/admin/users", headers)
    users = users_resp.get("users", [])
    
    target_emails = [
        f"admin1@{email_domain}",
        f"teacher1@{email_domain}",
        f"guard1@{email_domain}",
        f"nurse1@{email_domain}",
        f"parent1@{email_domain}",
    ]

    for u in users:
        email = u.get("email")
        if email in target_emails:
            print(f"Updating {email}...")
            uid = u["id"]
            res = http_json("PUT", f"{url}/auth/v1/admin/users/{uid}", headers, {
                "password": target_password,
                "email_confirm": True
            })
            if "id" in res:
                print(f"  > Success.")
            else:
                print(f"  > Failed: {res}")

    print("\n--- Verifying Login for Admin ---")
    anon_key = os.getenv("SUPABASE_ANON_KEY")
    if not anon_key:
         anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrd2p4bWhucm9xcHJtamZvYXVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5NzM1MzksImV4cCI6MjA4NDU0OTUzOX0.4kcq7jztHm_zvS1yMX1VjZAvMbxKgNHBqkiThotG3DM"
    
    login_resp = http_json("POST", f"{url}/auth/v1/token?grant_type=password", {
        "apikey": anon_key,
        "Authorization": f"Bearer {anon_key}",
    }, {
        "email": f"admin1@{email_domain}",
        "password": target_password
    })

    if "access_token" in login_resp:
        print("Login Verified! Token received.")
    else:
        print("Login Failed!")
        print(login_resp)

if __name__ == "__main__":
    main()
