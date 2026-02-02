import os
import json
import urllib.request
from dotenv import load_dotenv

def http_json(method: str, url: str, headers: dict[str, str]) -> list:
    req = urllib.request.Request(url, headers=headers, method=method)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))

def main():
    load_dotenv()
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
    }

    print("--- Verifying Profiles ---")
    profiles = http_json("GET", f"{url}/rest/v1/profiles?select=email,role,full_name&limit=5", headers)
    for p in profiles:
        print(f"Found: {p['full_name']} ({p['role']}) - {p['email']}")

    print("\n--- Verifying Classes ---")
    classes = http_json("GET", f"{url}/rest/v1/classes?select=id,grade,strand,room&limit=5", headers)
    for c in classes:
        print(f"Class: {c['id']} ({c['grade']} {c['strand']}) Room: {c['room']}")

if __name__ == "__main__":
    main()
