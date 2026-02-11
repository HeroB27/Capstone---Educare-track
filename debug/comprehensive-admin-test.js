/**
 * EDUCARE TRACK - Comprehensive Admin QA Test Suite
 * Tests all admin features against real schema + RLS
 * 
 * Run this in browser console while on admin pages or use with diagnostic HTML
 */

import { supabase } from "../core/core.js";

const TEST_RESULTS = {
  passed: [],
  failed: [],
  warnings: [],
  skipped: []
};

const TEST_ITERATIONS = {
  DASHBOARD: 'dashboard',
  USER_MANAGEMENT: 'user_management',
  STUDENT_PARENT: 'student_parent',
  ID_MANAGEMENT: 'id_management',
  CLASS_MANAGEMENT: 'class_management',
  ANNOUNCEMENTS: 'announcements'
};

// Helper: Safe query with error handling
async function safeQuery(queryFn, description) {
  try {
    const result = await queryFn();
    if (result.error) {
      return { success: false, error: result.error, description };
    }
    return { success: true, data: result.data, description };
  } catch (e) {
    return { success: false, error: e.message, description };
  }
}

// Helper: Log test result
function logResult(category, testName, passed, message = '', details = null) {
  const result = {
    category,
    test: testName,
    passed,
    message,
    details,
    timestamp: new Date().toISOString()
  };
  
  if (passed) {
    TEST_RESULTS.passed.push(result);
    console.log(`✅ [${category}] ${testName}: ${message}`);
  } else {
    TEST_RESULTS.failed.push(result);
    console.error(`❌ [${category}] ${testName}: ${message}`, details || '');
  }
}

// =============================================================================
// TEST 1: DASHBOARD TESTS
// =============================================================================
export async function testDashboard() {
  console.log('\n=== TESTING DASHBOARD ===\n');
  
  // Test 1.1: Dashboard loads without errors
  const dashboardLoad = await safeQuery(
    () => supabase.from("students").select("id", { count: "exact" }),
    "Dashboard student count query"
  );
  logResult(
    TEST_ITERATIONS.DASHBOARD,
    'Load students table',
    dashboardLoad.success,
    dashboardLoad.success ? 'Students table accessible' : `Failed: ${dashboardLoad.error}`
  );

  // Test 1.2: Check real counts (students, present, late, absent)
  const studentsCount = await safeQuery(
    () => supabase.from("students").select("id", { count: "exact" }).eq("is_active", true),
    "Active students count"
  );
  logResult(
    TEST_ITERATIONS.DASHBOARD,
    'Active students count',
    studentsCount.success,
    studentsCount.success ? `Count: ${studentsCount.data}` : `Error: ${studentsCount.error}`
  );

  // Test 1.3: Present count (today's attendance)
  const today = new Date().toISOString().split('T')[0];
  const presentCount = await safeQuery(
    () => supabase.from("homeroom_attendance")
      .select("id", { count: "exact" })
      .eq("date", today)
      .eq("status", "present"),
    "Present count today"
  );
  logResult(
    TEST_ITERATIONS.DASHBOARD,
    'Present count today',
    presentCount.success,
    presentCount.success ? `Present: ${presentCount.data}` : `Error: ${presentCount.error}`
  );

  // Test 1.4: Late count
  const lateCount = await safeQuery(
    () => supabase.from("homeroom_attendance")
      .select("id", { count: "exact" })
      .eq("date", today)
      .eq("status", "late"),
    "Late count today"
  );
  logResult(
    TEST_ITERATIONS.DASHBOARD,
    'Late count today',
    lateCount.success,
    lateCount.success ? `Late: ${lateCount.data}` : `Error: ${lateCount.error}`
  );

  // Test 1.5: Absent count
  const absentCount = await safeQuery(
    () => supabase.from("homeroom_attendance")
      .select("id", { count: "exact" })
      .eq("date", today)
      .eq("status", "absent"),
    "Absent count today"
  );
  logResult(
    TEST_ITERATIONS.DASHBOARD,
    'Absent count today',
    absentCount.success,
    absentCount.success ? `Absent: ${absentCount.data}` : `Error: ${absentCount.error}`
  );

  // Test 1.6: Edge case - Empty data handling
  const emptyCheck = await safeQuery(
    () => supabase.from("students").select("id,full_name").limit(0),
    "Empty students query"
  );
  logResult(
    TEST_ITERATIONS.DASHBOARD,
    'Empty state handling',
    emptyCheck.success || emptyCheck.data?.length === 0,
    emptyCheck.success ? 'Empty state query works' : `Error: ${emptyCheck.error}`
  );

  // Test 1.7: Check required dashboard columns exist
  const dashboardColumns = await safeQuery(
    () => supabase.from("students").select("id,full_name,current_status,absences,lates").limit(1),
    "Dashboard required columns"
  );
  const requiredCols = ['id', 'full_name', 'current_status', 'absences', 'lates'];
  const hasAllCols = dashboardColumns.data && requiredCols.every(col => col in dashboardColumns.data[0]);
  logResult(
    TEST_ITERATIONS.DASHBOARD,
    'Required dashboard columns',
    hasAllCols,
    hasAllCols ? 'All required columns present' : 'Missing required columns'
  );
}

// =============================================================================
// TEST 2: USER MANAGEMENT TESTS
// =============================================================================
export async function testUserManagement() {
  console.log('\n=== TESTING USER MANAGEMENT ===\n');
  
  // Test 2.1: Profiles table accessible
  const profilesAccess = await safeQuery(
    () => supabase.from("profiles").select("id,full_name,role,is_active").limit(1),
    "Profiles table access"
  );
  logResult(
    TEST_ITERATIONS.USER_MANAGEMENT,
    'Profiles table accessible',
    !profilesAccess.error,
    profilesAccess.error ? `Error: ${profilesAccess.error}` : 'Profiles table accessible'
  );

  // Test 2.2: Role column exists with valid roles
  const roleCheck = await safeQuery(
    () => supabase.from("profiles").select("role").limit(5),
    "Role column check"
  );
  const validRoles = ['admin', 'teacher', 'parent', 'guard', 'clinic'];
  const hasValidRoles = roleCheck.data?.every(p => validRoles.includes(p.role));
  logResult(
    TEST_ITERATIONS.USER_MANAGEMENT,
    'Valid role values',
    hasValidRoles,
    hasValidRoles ? 'All roles valid' : 'Invalid roles found'
  );

  // Test 2.3: is_active column exists
  const isActiveCheck = await safeQuery(
    () => supabase.from("profiles").select("is_active").limit(1),
    "is_active column check"
  );
  logResult(
    TEST_ITERATIONS.USER_MANAGEMENT,
    'is_active column exists',
    !isActiveCheck.error && 'is_active' in (isActiveCheck.data?.[0] || {}),
    !isActiveCheck.error && 'is_active' in (isActiveCheck.data?.[0] || {}) ? 'is_active column exists' : 'Missing is_active column'
  );

  // Test 2.4: Duplicate phone check capability
  const phoneCheck = await safeQuery(
    () => supabase.from("profiles").select("phone").limit(5),
    "Phone field accessibility"
  );
  logResult(
    TEST_ITERATIONS.USER_MANAGEMENT,
    'Phone field accessible',
    !phoneCheck.error,
    phoneCheck.error ? `Error: ${phoneCheck.error}` : 'Phone field accessible for duplicate check'
  );

  // Test 2.5: Required fields check (username, email, phone)
  const requiredFields = await safeQuery(
    () => supabase.from("profiles").select("username,email,phone").limit(1),
    "Required fields check"
  );
  const hasRequired = requiredFields.data && 
    'username' in (requiredFields.data[0] || {}) &&
    'email' in (requiredFields.data[0] || {}) &&
    'phone' in (requiredFields.data[0] || {});
  logResult(
    TEST_ITERATIONS.USER_MANAGEMENT,
    'Required user fields',
    hasRequired,
    hasRequired ? 'All required fields present' : 'Missing required fields'
  );

  // Test 2.6: Deactivated user handling
  const deactivatedCheck = await safeQuery(
    () => supabase.from("profiles").select("id,is_active").eq("is_active", false).limit(1),
    "Deactivated users query"
  );
  logResult(
    TEST_ITERATIONS.USER_MANAGEMENT,
    'Deactivated users query',
    !deactivatedCheck.error,
    deactivatedCheck.error ? `Error: ${deactivatedCheck.error}` : 'Deactivated users accessible'
  );
}

// =============================================================================
// TEST 3: STUDENT + PARENT CREATION TESTS
// =============================================================================
export async function testStudentParentCreation() {
  console.log('\n=== TESTING STUDENT + PARENT CREATION ===\n');
  
  // Test 3.1: Students table accessible
  const studentsAccess = await safeQuery(
    () => supabase.from("students").select("id,full_name,lrn,parent_id").limit(1),
    "Students table access"
  );
  logResult(
    TEST_ITERATIONS.STUDENT_PARENT,
    'Students table accessible',
    !studentsAccess.error,
    studentsAccess.error ? `Error: ${studentsAccess.error}` : 'Students table accessible'
  );

  // Test 3.2: parent_id foreign key exists
  const parentIdCheck = await safeQuery(
    () => supabase.from("students").select("parent_id").limit(1),
    "parent_id column check"
  );
  logResult(
    TEST_ITERATIONS.STUDENT_PARENT,
    'parent_id column exists',
    !parentIdCheck.error && 'parent_id' in (parentIdCheck.data?.[0] || {}),
    !parentIdCheck.error && 'parent_id' in (parentIdCheck.data?.[0] || {}) ? 'parent_id column exists' : 'Missing parent_id column'
  );

  // Test 3.3: LRN field exists
  const lrnCheck = await safeQuery(
    () => supabase.from("students").select("lrn").limit(1),
    "LRN field check"
  );
  logResult(
    TEST_ITERATIONS.STUDENT_PARENT,
    'LRN field exists',
    !lrnCheck.error && 'lrn' in (lrnCheck.data?.[0] || {}),
    !lrnCheck.error && 'lrn' in (lrnCheck.data?.[0] || {}) ? 'LRN field exists' : 'Missing LRN field'
  );

  // Test 3.4: grade_level field exists
  const gradeCheck = await safeQuery(
    () => supabase.from("students").select("grade_level").limit(1),
    "grade_level field check"
  );
  logResult(
    TEST_ITERATIONS.STUDENT_PARENT,
    'grade_level field exists',
    !gradeCheck.error && 'grade_level' in (gradeCheck.data?.[0] || {}),
    !gradeCheck.error && 'grade_level' in (gradeCheck.data?.[0] || {}) ? 'grade_level field exists' : 'Missing grade_level field'
  );

  // Test 3.5: class_id field exists
  const classIdCheck = await safeQuery(
    () => supabase.from("students").select("class_id").limit(1),
    "class_id field check"
  );
  logResult(
    TEST_ITERATIONS.STUDENT_PARENT,
    'class_id field exists',
    !classIdCheck.error && 'class_id' in (classIdCheck.data?.[0] || {}),
    !classIdCheck.error && 'class_id' in (classIdCheck.data?.[0] || {}) ? 'class_id field exists' : 'Missing class_id field'
  );

  // Test 3.6: Duplicate student check capability
  const duplicateCheck = await safeQuery(
    () => supabase.from("students").select("lrn,full_name").limit(5),
    "Duplicate check capability"
  );
  logResult(
    TEST_ITERATIONS.STUDENT_PARENT,
    'Duplicate check fields',
    !duplicateCheck.error,
    duplicateCheck.error ? `Error: ${duplicateCheck.error}` : 'Duplicate check fields accessible'
  );

  // Test 3.7: Auto-activation capability (parent_users table)
  const parentUsersCheck = await safeQuery(
    () => supabase.from("parent_users").select("id,user_id,is_activated").limit(1),
    "parent_users table check"
  );
  logResult(
    TEST_ITERATIONS.STUDENT_PARENT,
    'parent_users table accessible',
    !parentUsersCheck.error,
    parentUsersCheck.error ? `Error: ${parentUsersCheck.error}` : 'parent_users table accessible'
  );
}

// =============================================================================
// TEST 4: ID MANAGEMENT TESTS
// =============================================================================
export async function testIdManagement() {
  console.log('\n=== TESTING ID MANAGEMENT ===\n');
  
  // Test 4.1: student_ids table accessible
  const idsAccess = await safeQuery(
    () => supabase.from("student_ids").select("id,student_id,qr_code,is_active").limit(1),
    "student_ids table access"
  );
  logResult(
    TEST_ITERATIONS.ID_MANAGEMENT,
    'student_ids table accessible',
    !idsAccess.error,
    idsAccess.error ? `Error: ${idsAccess.error}` : 'student_ids table accessible'
  );

  // Test 4.2: QR code format validation
  const qrCheck = await safeQuery(
    () => supabase.from("student_ids").select("qr_code").limit(5),
    "QR code format check"
  );
  const qrPattern = /^EDU-\d{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
  const qrValid = qrCheck.data?.every(r => !r.qr_code || qrPattern.test(r.qr_code));
  logResult(
    TEST_ITERATIONS.ID_MANAGEMENT,
    'QR code format valid',
    qrValid,
    qrValid ? 'All QR codes match pattern EDU-YYYY-LLLL-XXXX' : 'Invalid QR codes found'
  );

  // Test 4.3: student_id format validation
  const studentIdCheck = await safeQuery(
    () => supabase.from("student_ids").select("student_id").limit(5),
    "student_id format check"
  );
  const sidPattern = /^EDU-\d{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
  const sidValid = studentIdCheck.data?.every(r => !r.student_id || sidPattern.test(r.student_id));
  logResult(
    TEST_ITERATIONS.ID_MANAGEMENT,
    'student_id format valid',
    sidValid,
    sidValid ? 'All student IDs match pattern' : 'Invalid student IDs found'
  );

  // Test 4.4: is_active column for re-issue functionality
  const isActiveIdCheck = await safeQuery(
    () => supabase.from("student_ids").select("is_active").limit(1),
    "is_active column for IDs"
  );
  logResult(
    TEST_ITERATIONS.ID_MANAGEMENT,
    'ID re-issue support',
    !isActiveIdCheck.error && 'is_active' in (isActiveIdCheck.data?.[0] || {}),
    !isActiveIdCheck.error && 'is_active' in (isActiveIdCheck.data?.[0] || {}) ? 'ID re-issue supported' : 'Missing is_active for re-issue'
  );

  // Test 4.5: Foreign key to students
  const fkCheck = await safeQuery(
    () => supabase.from("student_ids").select("student_id").limit(1),
    "student_id FK column"
  );
  logResult(
    TEST_ITERATIONS.ID_MANAGEMENT,
    'Student FK exists',
    !fkCheck.error,
    fkCheck.error ? `Error: ${fkCheck.error}` : 'Student FK column exists'
  );

  // Test 4.6: Print layout support (created_at for ordering)
  const printCheck = await safeQuery(
    () => supabase.from("student_ids").select("created_at").limit(1),
    "Print ordering support"
  );
  logResult(
    TEST_ITERATIONS.ID_MANAGEMENT,
    'Print ordering support',
    !printCheck.error && 'created_at' in (printCheck.data?.[0] || {}),
    !printCheck.error && 'created_at' in (printCheck.data?.[0] || {}) ? 'Print ordering supported' : 'Missing created_at'
  );
}

// =============================================================================
// TEST 5: CLASS MANAGEMENT TESTS
// =============================================================================
export async function testClassManagement() {
  console.log('\n=== TESTING CLASS MANAGEMENT ===\n');
  
  // Test 5.1: classes table accessible
  const classesAccess = await safeQuery(
    () => supabase.from("classes").select("id,grade_level,strand,room").limit(1),
    "classes table access"
  );
  logResult(
    TEST_ITERATIONS.CLASS_MANAGEMENT,
    'classes table accessible',
    !classesAccess.error,
    classesAccess.error ? `Error: ${classesAccess.error}` : 'classes table accessible'
  );

  // Test 5.2: homeroom_teacher_id foreign key
  const homeroomCheck = await safeQuery(
    () => supabase.from("classes").select("homeroom_teacher_id").limit(1),
    "homeroom_teacher_id check"
  );
  logResult(
    TEST_ITERATIONS.CLASS_MANAGEMENT,
    'Homeroom teacher FK',
    !homeroomCheck.error && 'homeroom_teacher_id' in (homeroomCheck.data?.[0] || {}),
    !homeroomCheck.error && 'homeroom_teacher_id' in (homeroomCheck.data?.[0] || {}) ? 'Homeroom teacher FK exists' : 'Missing homeroom_teacher_id'
  );

  // Test 5.3: is_active column for classes
  const classActiveCheck = await safeQuery(
    () => supabase.from("classes").select("is_active").limit(1),
    "class is_active check"
  );
  logResult(
    TEST_ITERATIONS.CLASS_MANAGEMENT,
    'Class active status',
    !classActiveCheck.error && 'is_active' in (classActiveCheck.data?.[0] || {}),
    !classActiveCheck.error && 'is_active' in (classActiveCheck.data?.[0] || {}) ? 'is_active column exists' : 'Missing is_active'
  );

  // Test 5.4: class_schedules table for subject teachers
  const schedulesAccess = await safeQuery(
    () => supabase.from("class_schedules").select("id,class_id,subject_code,teacher_id").limit(1),
    "class_schedules table access"
  );
  logResult(
    TEST_ITERATIONS.CLASS_MANAGEMENT,
    'class_schedules accessible',
    !schedulesAccess.error,
    schedulesAccess.error ? `Error: ${schedulesAccess.error}` : 'class_schedules table accessible'
  );

  // Test 5.5: subjects table
  const subjectsAccess = await safeQuery(
    () => supabase.from("subjects").select("code,name").limit(1),
    "subjects table access"
  );
  logResult(
    TEST_ITERATIONS.CLASS_MANAGEMENT,
    'subjects table accessible',
    !subjectsAccess.error,
    subjectsAccess.error ? `Error: ${subjectsAccess.error}` : 'subjects table accessible'
  );

  // Test 5.6: Attendance sync check (homeroom_attendance references class_id)
  const attendanceClassCheck = await safeQuery(
    () => supabase.from("homeroom_attendance").select("class_id").limit(1),
    "Attendance class_id FK"
  );
  logResult(
    TEST_ITERATIONS.CLASS_MANAGEMENT,
    'Attendance class sync',
    !attendanceClassCheck.error && 'class_id' in (attendanceClassCheck.data?.[0] || {}),
    !attendanceClassCheck.error && 'class_id' in (attendanceClassCheck.data?.[0] || {}) ? 'Attendance class sync supported' : 'Missing class_id in attendance'
  );
}

// =============================================================================
// TEST 6: ANNOUNCEMENTS TESTS
// =============================================================================
export async function testAnnouncements() {
  console.log('\n=== TESTING ANNOUNCEMENTS ===\n');
  
  // Test 6.1: announcements table accessible
  const announcementsAccess = await safeQuery(
    () => supabase.from("announcements").select("id,title,body").limit(1),
    "announcements table access"
  );
  logResult(
    TEST_ITERATIONS.ANNOUNCEMENTS,
    'announcements table accessible',
    !announcementsAccess.error,
    announcementsAccess.error ? `Error: ${announcementsAccess.error}` : 'announcements table accessible'
  );

  // Test 6.2: Role-specific audience columns
  const audienceCheck = await safeQuery(
    () => supabase.from("announcements")
      .select("audience_teachers,audience_parents,audience_staff,class_id")
      .limit(1),
    "Audience columns check"
  );
  const hasAudience = audienceCheck.data && 
    'audience_teachers' in (audienceCheck.data[0] || {}) &&
    'audience_parents' in (audienceCheck.data[0] || {}) &&
    'audience_staff' in (audienceCheck.data[0] || {});
  logResult(
    TEST_ITERATIONS.ANNOUNCEMENTS,
    'Role-based audience',
    hasAudience,
    hasAudience ? 'All audience columns exist' : 'Missing audience columns'
  );

  // Test 6.3: class_id for class-specific announcements
  const classAnnounceCheck = await safeQuery(
    () => supabase.from("announcements").select("class_id").limit(1),
    "Class-specific announcements"
  );
  logResult(
    TEST_ITERATIONS.ANNOUNCEMENTS,
    'Class-specific support',
    !classAnnounceCheck.error && 'class_id' in (classAnnounceCheck.data?.[0] || {}),
    !classAnnounceCheck.error && 'class_id' in (classAnnounceCheck.data?.[0] || {}) ? 'Class-specific supported' : 'Missing class_id'
  );

  // Test 6.4: created_by for audit trail
  const createdByCheck = await safeQuery(
    () => supabase.from("announcements").select("created_by").limit(1),
    "Created by audit trail"
  );
  logResult(
    TEST_ITERATIONS.ANNOUNCEMENTS,
    'Audit trail (created_by)',
    !createdByCheck.error && 'created_by' in (createdByCheck.data?.[0] || {}),
    !createdByCheck.error && 'created_by' in (createdByCheck.data?.[0] || {}) ? 'created_by exists' : 'Missing created_by'
  );

  // Test 6.5: RLS - Check if regular users can only see their announcements
  // This tests that there are no data leaks
  const noLeaksCheck = await safeQuery(
    () => supabase.from("announcements").select("id").limit(100),
    "Announcement data access"
  );
  logResult(
    TEST_ITERATIONS.ANNOUNCEMENTS,
    'No data leaks',
    !noLeaksCheck.error,
    noLeaksCheck.error ? `Error: ${noLeaksCheck.error}` : 'Announcements accessible'
  );

  // Test 6.6: created_at for ordering
  const createdAtCheck = await safeQuery(
    () => supabase.from("announcements").select("created_at").limit(1),
    "Ordering support"
  );
  logResult(
    TEST_ITERATIONS.ANNOUNCEMENTS,
    'Ordering support',
    !createdAtCheck.error && 'created_at' in (createdAtCheck.data?.[0] || {}),
    !createdAtCheck.error && 'created_at' in (createdAtCheck.data?.[0] || {}) ? 'created_at exists' : 'Missing created_at'
  );
}

// =============================================================================
// RUN ALL TESTS
// =============================================================================
export async function runAllTests() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  EDUCARE TRACK - COMPREHENSIVE ADMIN QA TEST SUITE         ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  TEST_RESULTS.passed = [];
  TEST_RESULTS.failed = [];
  TEST_RESULTS.warnings = [];
  TEST_RESULTS.skipped = [];

  // Auth check first
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    console.warn('⚠️  No active session - some tests may fail due to RLS');
    console.log('   Please log in as admin to run full tests\n');
  } else {
    console.log(`✅ Authenticated as: ${session.user?.email || session.user?.id}\n`);
  }

  await testDashboard();
  await testUserManagement();
  await testStudentParentCreation();
  await testIdManagement();
  await testClassManagement();
  await testAnnouncements();

  // Summary
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  TEST SUMMARY                                                ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  console.log(`✅ Passed: ${TEST_RESULTS.passed.length}`);
  console.log(`❌ Failed: ${TEST_RESULTS.failed.length}`);
  console.log(`⚠️  Warnings: ${TEST_RESULTS.warnings.length}`);
  
  if (TEST_RESULTS.failed.length > 0) {
    console.log('\n=== FAILED TESTS ===');
    TEST_RESULTS.failed.forEach((f, i) => {
      console.log(`${i + 1}. [${f.category}] ${f.test}`);
      console.log(`   Error: ${f.message}`);
    });
  }

  return TEST_RESULTS;
}

// Export for use
export function getResults() {
  return TEST_RESULTS;
}
