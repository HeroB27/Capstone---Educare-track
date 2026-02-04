# Python Analytics (Phase 2)

This uses real Supabase data and generates:

- `exports/dashboard_metrics.json` (trend data for the dashboard)
- `exports/attendance_export.csv` (CSV export)

## Run

```bash
python ./analytics/generate_dashboard_metrics.py
```

## Auth

The script reads:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

If those env vars are not set, it will fall back to `.trae/rules/Supabase information`.
