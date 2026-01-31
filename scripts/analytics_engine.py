import os
import pandas as pd
from supabase import create_client, Client
from dotenv import load_dotenv
from datetime import datetime, timedelta

# Load environment variables
load_dotenv()

# Configuration
URL: str = os.getenv("SUPABASE_URL")
KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not URL or not KEY:
    print("Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env")
    exit(1)

supabase: Client = create_client(URL, KEY)

def fetch_attendance_data(days_back=30):
    """Fetch attendance data for the last N days."""
    start_date = (datetime.now() - timedelta(days=days_back)).isoformat()
    
    response = supabase.table("attendance") \
        .select("student_id, status, timestamp, students(full_name, grade_level)") \
        .gte("timestamp", start_date) \
        .execute()
    
    return response.data

def analyze_risk(data):
    """Identify students with high absence rates."""
    if not data:
        print("No attendance data found for the given period.")
        return None

    # Flatten data
    flat_data = []
    for entry in data:
        flat_data.append({
            "student_id": entry["student_id"],
            "full_name": entry["students"]["full_name"],
            "grade_level": entry["students"]["grade_level"],
            "status": entry["status"],
            "date": entry["timestamp"][:10]
        })

    df = pd.DataFrame(flat_data)
    
    # Calculate absence rate
    total_days = df.groupby("student_id")["date"].nunique()
    absences = df[df["status"] == "absent"].groupby("student_id").size()
    
    risk_df = pd.DataFrame({
        "full_name": df.groupby("student_id")["full_name"].first(),
        "grade_level": df.groupby("student_id")["grade_level"].first(),
        "total_sessions": total_days,
        "absences": absences.reindex(total_days.index, fill_value=0)
    })
    
    risk_df["absence_rate"] = (risk_df["absences"] / risk_df["total_sessions"]) * 100
    
    # Filter for high risk (Absence rate > 15%)
    critical_risk = risk_df[risk_df["absence_rate"] > 15].sort_values("absence_rate", ascending=False)
    
    return critical_risk

def main():
    print(f"--- EDUCARE TRACK ANALYTICS ENGINE ---")
    print(f"Analyzing attendance patterns for the last 30 days...")
    
    data = fetch_attendance_data()
    results = analyze_risk(data)
    
    if results is not None and not results.empty:
        print(f"\n[CRITICAL ALERT] Found {len(results)} students with high-risk attendance patterns:")
        print(results[["full_name", "grade_level", "absence_rate"]].to_string())
        
        # Save to CSV
        output_file = "attendance_risk_report.csv"
        results.to_csv(output_file)
        print(f"\nDetailed report saved to: {output_file}")
    else:
        print("\nNo high-risk attendance patterns detected. All students are within safety thresholds.")

if __name__ == "__main__":
    main()
