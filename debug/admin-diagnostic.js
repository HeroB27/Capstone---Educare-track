/**
 * EDUCARE TRACK - Admin Panel Diagnostic Tool
 * 
 * This script tests the admin panel functionality by:
 * 1. Checking database schema and table availability
 * 2. Verifying RLS policies
 * 3. Testing data retrieval for each admin module
 * 4. Identifying missing columns or data issues
 */

import { supabase } from "../core/core.js";

const DIAGNOSTIC_TESTS = {
  SCHEMA_CHECKS: [
    { table: "profiles", columns: ["id", "full_name", "username", "role", "is_active"] },
    { table: "students", columns: ["id", "full_name", "grade_level", "class_id", "current_status", "absences", "lates"] },
    { table: "classes", columns: ["id", "grade_level", "strand", "room", "homeroom_teacher_id"] },
    { table: "homeroom_attendance", columns: ["id", "student_id", "class_id", "date", "status"] },
    { table: "announcements", columns: ["id", "title", "body", "audience_teachers", "audience_parents", "audience_staff"] },
    { table: "school_calendar", columns: ["id", "type", "title", "start_date", "end_date"] },
    { table: "attendance_rules", columns: ["id", "grade_level", "entry_time", "grace_until", "late_until"] },
    { table: "system_settings", columns: ["id", "key", "value"] },
    { table: "subjects", columns: ["code", "name", "grade_level", "strand"] },
    { table: "class_schedules", columns: ["id", "class_id", "subject_code", "teacher_id", "day_of_week"] },
  ],
  DATA_CHECKS: [
    { name: "Admin Users", query: () => supabase.from("profiles").select("id", { count: "exact" }) },
    { name: "Students", query: () => supabase.from("students").select("id", { count: "exact" }) },
    { name: "Classes", query: () => supabase.from("classes").select("id", { count: "exact" }) },
    { name: "Attendance Records", query: () => supabase.from("homeroom_attendance").select("id", { count: "exact" }) },
    { name: "Announcements", query: () => supabase.from("announcements").select("id", { count: "exact" }) },
    { name: "Calendar Events", query: () => supabase.from("school_calendar").select("id", { count: "exact" }) },
    { name: "Attendance Rules", query: () => supabase.from("attendance_rules").select("id", { count: "exact" }) },
    { name: "Subjects", query: () => supabase.from("subjects").select("code", { count: "exact" }) },
    { name: "Schedules", query: () => supabase.from("class_schedules").select("id", { count: "exact" }) },
  ]
};

export async function runAdminDiagnostics() {
  console.log("=== EDUCARE TRACK Admin Panel Diagnostic ===\n");
  
  const results = {
    schemaIssues: [],
    dataIssues: [],
    moduleStatus: {}
  };

  // Test 1: Check if user is authenticated
  console.log("1. Authentication Check");
  console.log("   ".repeat(2) + "Testing Supabase connection...");
  try {
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError) {
      console.log("   ❌ Authentication Error:", authError.message);
      results.dataIssues.push({ issue: "Not authenticated", solution: "Login first" });
    } else if (!session) {
      console.log("   ⚠️  No active session - some data may be hidden due to RLS");
    } else {
      console.log("   ✅ Authenticated as:", session.user?.email || "User ID: " + session.user?.id);
    }
  } catch (e) {
    console.log("   ❌ Connection Error:", e.message);
    results.dataIssues.push({ issue: "Cannot connect to Supabase", solution: "Check internet connection and Supabase URL" });
  }

  // Test 2: Schema validation
  console.log("\n2. Database Schema Validation");
  console.log("   ".repeat(2) + "Checking tables and columns...");
  
  for (const check of DIAGNOSTIC_TESTS.SCHEMA_CHECKS) {
    try {
      const { data, error } = await supabase
        .from(check.table)
        .select(check.columns.slice(0, 1).join(","))
        .limit(1);
      
      if (error) {
        console.log(`   ❌ Table '${check.table}': ${error.message}`);
        results.schemaIssues.push({ table: check.table, error: error.message });
      } else {
        // Check if all required columns exist
        if (data && data.length > 0) {
          const existingColumns = Object.keys(data[0]);
          const missingColumns = check.columns.filter(col => !existingColumns.includes(col));
          if (missingColumns.length > 0) {
            console.log(`   ⚠️  Table '${check.table}': Missing columns: ${missingColumns.join(", ")}`);
            results.schemaIssues.push({ table: check.table, missing: missingColumns });
          } else {
            console.log(`   ✅ Table '${check.table}': All columns present`);
          }
        } else {
          console.log(`   ✅ Table '${check.table}': Exists (empty)`);
        }
      }
    } catch (e) {
      console.log(`   ❌ Table '${check.table}': ${e.message}`);
      results.schemaIssues.push({ table: check.table, error: e.message });
    }
  }

  // Test 3: Data availability
  console.log("\n3. Data Availability Check");
  console.log("   ".repeat(2) + "Querying data counts...");
  
  for (const check of DIAGNOSTIC_TESTS.DATA_CHECKS) {
    try {
      const { count, error } = await check.query();
      if (error) {
        console.log(`   ❌ ${check.name}: ${error.message}`);
        results.dataIssues.push({ module: check.name, error: error.message });
      } else {
        console.log(`   ✅ ${check.name}: ${count || 0} records`);
        results.moduleStatus[check.name] = { count, status: count > 0 ? "ok" : "empty" };
      }
    } catch (e) {
      console.log(`   ❌ ${check.name}: ${e.message}`);
      results.dataIssues.push({ module: check.name, error: e.message });
    }
  }

  // Test 4: Admin-specific data checks
  console.log("\n4. Admin Dashboard Specific Checks");
  
  // Check students with attendance issues
  try {
    const { data: poorAttendance, error: poorError } = await supabase
      .from("students")
      .select("id,full_name,grade_level")
      .eq("status", "active")
      .order("absences", { ascending: false })
      .limit(5);
    
    if (poorError) {
      console.log(`   ⚠️  Cannot check absence alerts: ${poorError.message}`);
    } else {
      const alerts = (poorAttendance || []).filter(s => (s.absences || 0) >= 10);
      console.log(`   ${alerts.length > 0 ? "✅" : "ℹ️"} Absence Alerts (>10 absences): ${alerts.length} students`);
    }
  } catch (e) {
    console.log(`   ❌ Alert check error: ${e.message}`);
  }

  // Check late students
  try {
    const { data: lateStudents, error: lateError } = await supabase
      .from("students")
      .select("id,full_name,grade_level")
      .eq("status", "active")
      .order("lates", { ascending: false })
      .limit(5);
    
    if (lateError) {
      console.log(`   ⚠️  Cannot check late alerts: ${lateError.message}`);
    } else {
      const alerts = (lateStudents || []).filter(s => (s.lates || 0) >= 5);
      console.log(`   ${alerts.length > 0 ? "✅" : "ℹ️"} Late Alerts (>5 lates): ${alerts.length} students`);
    }
  } catch (e) {
    console.log(`   ❌ Late alert check error: ${e.message}`);
  }

  // Summary
  console.log("\n=== DIAGNOSTIC SUMMARY ===");
  const totalIssues = results.schemaIssues.length + results.dataIssues.length;
  
  if (totalIssues === 0) {
    console.log("✅ All checks passed! Admin panel should be fully functional.");
  } else {
    console.log(`❌ Found ${totalIssues} issues:`);
    
    if (results.schemaIssues.length > 0) {
      console.log("\nSchema Issues:");
      for (const issue of results.schemaIssues) {
        if (issue.missing) {
          console.log(`  - Table '${issue.table}' missing columns: ${issue.missing.join(", ")}`);
        } else {
          console.log(`  - Table '${issue.table}': ${issue.error || "Unknown error"}`);
        }
      }
    }
    
    if (results.dataIssues.length > 0) {
      console.log("\nData Issues:");
      for (const issue of results.dataIssues) {
        if (issue.module) {
          console.log(`  - ${issue.module}: ${issue.error}`);
        } else {
          console.log(`  - ${issue.issue} → ${issue.solution}`);
        }
      }
    }
    
    console.log("\nRecommended Actions:");
    if (results.schemaIssues.some(s => s.error?.includes("relation") || s.error?.includes("does not exist"))) {
      console.log("  1. Apply database migrations from supabase_migrations/");
      console.log("  2. Run: npm run seed:enterprise");
    }
    if (results.dataIssues.some(d => d.issue?.includes("authenticated"))) {
      console.log("  1. Login with admin credentials");
    }
  }
  
  return results;
}

// Export for use in browser console
window.runAdminDiagnostics = runAdminDiagnostics;
