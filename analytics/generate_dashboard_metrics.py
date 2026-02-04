import csv
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta
from pathlib import Path


def read_supabase_secrets():
    url = os.environ.get("SUPABASE_URL", "").strip()
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if url and key:
        return url, key

    info_path = Path(".trae") / "rules" / "Supabase information"
    raw = info_path.read_text(encoding="utf-8")

    url_match = re.search(r"public url\s*=\s*(https://\S+)", raw, flags=re.IGNORECASE)
    key_match = re.search(r"service role key\s*=\s*(\S+)", raw, flags=re.IGNORECASE)

    url = url or (url_match.group(1) if url_match else "")
    key = key or (key_match.group(1) if key_match else "")

    if not url or not key:
        raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.")
    return url, key


def request_json(url, service_key):
    req = urllib.request.Request(url)
    req.add_header("apikey", service_key)
    req.add_header("Authorization", f"Bearer {service_key}")
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def build_rest_url(base_url, table, params):
    query = urllib.parse.urlencode(params, doseq=True, safe=":,")
    return f"{base_url.rstrip('/')}/rest/v1/{table}?{query}"


def local_iso(d):
    return d.isoformat()


def main():
    base_url, service_key = read_supabase_secrets()

    today = date.today()
    start_7 = today - timedelta(days=6)
    start_30 = today - timedelta(days=29)

    attendance_url = build_rest_url(
        base_url,
        "homeroom_attendance",
        {
            "select": "date,status,student_id,class_id,tap_in_time,tap_out_time,remarks",
            "date": [f"gte.{local_iso(start_30)}", f"lte.{local_iso(today)}"],
        },
    )
    attendance_rows = request_json(attendance_url, service_key)

    trend = {}
    today_counts = {"present": 0, "late": 0, "absent": 0, "excused": 0}

    for r in attendance_rows:
        d = r.get("date")
        s = (r.get("status") or "").strip()
        if not d:
            continue

        if d >= local_iso(start_7):
            prev = trend.get(d) or {"presentish": 0, "total": 0}
            presentish = s in ("present", "late", "partial")
            prev["presentish"] += 1 if presentish else 0
            prev["total"] += 1
            trend[d] = prev

        if d == local_iso(today):
            if s == "present" or s == "partial":
                today_counts["present"] += 1
            elif s == "late":
                today_counts["late"] += 1
            elif s == "excused_absent":
                today_counts["excused"] += 1
            elif s == "absent":
                today_counts["absent"] += 1

    labels = sorted(trend.keys())
    values = []
    for d in labels:
        t = trend[d]
        if not t["total"]:
            values.append(None)
        else:
            values.append(round((t["presentish"] / t["total"]) * 100, 1))

    student_ids = sorted({r.get("student_id") for r in attendance_rows if r.get("student_id")})
    students = {}
    if student_ids:
        students_url = build_rest_url(
            base_url,
            "students",
            {
                "select": "id,full_name,grade_level,lrn",
                "id": [f"in.({','.join(student_ids)})"],
            },
        )
        for s in request_json(students_url, service_key):
            students[s["id"]] = s

    exports_dir = Path("exports")
    exports_dir.mkdir(parents=True, exist_ok=True)

    metrics = {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "today": local_iso(today),
        "today_counts": today_counts,
        "trend": {"labels": labels, "values": values},
    }
    (exports_dir / "dashboard_metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")

    csv_path = exports_dir / "attendance_export.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["date", "student_id", "student_name", "grade_level", "status", "tap_in_time", "tap_out_time", "remarks", "class_id"])
        for r in attendance_rows:
            sid = r.get("student_id")
            st = students.get(sid) or {}
            w.writerow(
                [
                    r.get("date") or "",
                    sid or "",
                    st.get("full_name") or "",
                    st.get("grade_level") or "",
                    r.get("status") or "",
                    r.get("tap_in_time") or "",
                    r.get("tap_out_time") or "",
                    r.get("remarks") or "",
                    r.get("class_id") or "",
                ]
            )

    print("Wrote exports/dashboard_metrics.json")
    print("Wrote exports/attendance_export.csv")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"Failed: {e}", file=sys.stderr)
        sys.exit(1)

