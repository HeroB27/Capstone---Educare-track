/**
 * DEBUG: Cleanup Test Students Script
 * 
 * Run this in browser console or as a Node.js script to remove test students.
 * 
 * USAGE:
 * 1. Open admin/admin-people.html in browser
 * 2. Open Developer Console (F12)
 * 3. Paste this script and run
 */

import { supabase } from "../core/core.js";

const TEST_NAMES = [
  "Test Student",
  "Test Parent",
  "QA Test",
  "Debug User",
  "TEMP_",
  "temp_",
  "test_",
  "DELETE_ME"
];

async function cleanupTestStudents() {
  console.log("🔍 Searching for test students to remove...");
  
  // Fetch all students
  const { data: students, error } = await supabase
    .from("students")
    .select("id, full_name, created_at")
    .order("created_at", { ascending: false });
  
  if (error) {
    console.error("❌ Error fetching students:", error);
    return;
  }
  
  // Find test students
  const testStudents = students.filter(s => {
    const name = (s.full_name || "").toLowerCase();
    return TEST_NAMES.some(test => name.includes(test.toLowerCase()));
  });
  
  if (testStudents.length === 0) {
    console.log("✅ No test students found.");
    return;
  }
  
  console.log(`Found ${testStudents.length} test students:`);
  testStudents.forEach(s => console.log(`  - ${s.full_name} (${s.id})`));
  
  // Ask for confirmation
  const confirmed = confirm(`Delete ${testStudents.length} test students?`);
  if (!confirmed) {
    console.log("❌ Cancelled.");
    return;
  }
  
  // Deactivate test students
  const ids = testStudents.map(s => s.id);
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ is_active: false })
    .in("id", ids);
  
  if (updateError) {
    console.error("❌ Error deactivating profiles:", updateError);
    return;
  }
  
  console.log(`✅ Deactivated ${ids.length} test profiles.`);
  console.log("📝 Note: Data is preserved but marked inactive.");
  console.log("🔄 Refresh the page to see changes.");
}

// Export for use
window.cleanupTestStudents = cleanupTestStudents;

// Auto-run if in debug mode
if (window.DEBUG_MODE || new URLSearchParams(window.location.search).has("cleanup")) {
  cleanupTestStudents();
}
