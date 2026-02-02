## Scope
- Execute the QA validation you defined for Admin/Teacher/Guard + cross-role + attendance engine integration.
- Produce a concrete pass/fail report with evidence (SQL outputs + UI observations).

## What I will do first (DB-side verification)
1) Generate a single SQL bundle you can run in Supabase SQL Editor to:
   - List RLS enabled state per table
   - Dump all RLS policies (table/command/roles/using/with_check)
   - List triggers/functions related to attendance derivation
   - List indexes relevant to hot-path queries
2) Generate role-simulation SQL snippets using `set_config('request.jwt.claims', ...)` (or the best available alternative) to validate:
   - Guard INSERT-only into `attendance_events`
   - Teacher scope-limited reads
   - Admin read-only constraints on derived tables (if required)

## What I will do next (UI workflow simulation)
3) Create an execution checklist (Admin → class setup → assignments → announcements) with exact “expected DB rows after each click”.
4) Create Teacher workflow checklist:
   - excuse letters decision + override + audit log + parent notification
   - clinic pass issuance + updates
5) Create Guard workflow checklist:
   - IN/OUT scans, duplicate scan handling, non-school day scan behavior
   - confirm guard cannot access non-guard pages

## Evidence capture + final QA report
6) Add a QA report template that forces strict output:
   - ✅ WORKING AS EXPECTED
   - ⚠️ ROLE MISALIGNMENTS
   - ❌ BROKEN OR MISSING
   - 🔐 SECURITY RISKS
   - 🧪 REQUIRED TEST CASES
7) After you run the provided SQL bundle in Supabase and paste results back (or screenshots), I will:
   - Map each requirement → proof
   - Identify exact blockers and the specific policies/queries causing them

## Important constraint (so the run is meaningful)
- DB/RLS verification requires access to your Supabase project’s live schema/policies. I’ll generate runnable SQL and interpret results, but I can’t fetch live Supabase state from this IDE without credentials.

If you approve, I will start by creating the SQL bundle + QA report template in the repo and then we’ll run through the Admin/Teacher/Guard simulations in order.