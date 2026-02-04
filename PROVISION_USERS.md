# Provision Users (No Edge Functions)

The Admin UI can generate provisioning JSON files for:
- Parent + multiple students
- Staff accounts (teacher/guard/clinic/admin)

Passwords are never stored in Supabase tables. Instead, you download a JSON file and run a local script using the **service role key**.

## 1) Install dependencies

```bash
npm install
```

## 2) Generate a provisioning JSON

From the Admin Users page:
- Use **Add Profile** (staff) or **Link Student** (parent + students)
- Download the JSON

## 3) Run provisioning script

```bash
npm run provision:users -- path/to/your_export.json
```

Environment variables (recommended):

```bash
SUPABASE_URL="https://YOUR_PROJECT.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY" \
npm run provision:users -- path/to/your_export.json
```

If env vars are not set, the script falls back to `.trae/rules/Supabase information`.
