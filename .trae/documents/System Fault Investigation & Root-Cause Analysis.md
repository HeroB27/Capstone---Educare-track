# Root-Cause Debugging Plan: EDUCARE TRACK

I will transition into the **System Fault Investigator** persona to perform a deep-dive analysis of why the architectural rules are technically "broken" at the database layer.

## 🕵️ Root-Cause Investigation Steps:
1.  **Vulnerability Mapping**: I will cross-reference the **GLOBAL CONSTRAINTS** (Append-only, Role Isolation, Teacher Authority) against the actual `Supabase Tables.txt` to identify where enforcement is missing at the DB level.
2.  **Failure Classification**: I will classify each finding into the user's requested categories (e.g., Application-only validation, Missing RLS policy).
3.  **Impact Assessment**: I will explain how an attacker or a forged API call could bypass the current JS-level "fixes" to corrupt data or leak student information.

## 📋 Deliverable: STRICT DEBUG REPORT
I will provide a report for each architectural failure following this exact format:
- **TEST ID** (e.g., 3.1)
- **FAILED RULE** (e.g., Append-Only History)
- **TABLE**
- **COLUMN(S)**
- **FAILURE TYPE**
- **ROOT CAUSE**
- **WHY IT WAS ALLOWED**
- **SYSTEM IMPACT**
- **SEVERITY**

## 🛑 Scope Enforcement
- I will **NOT** propose fixes.
- I will **NOT** suggest schema changes.
- I will **ONLY** identify the technical "why" behind the failure to enforce rules at the database layer.

This plan focuses strictly on **Fault Isolation** to reveal the gap between the application logic and database enforcement.
