/**
 * Phase 8 Implementation Diagnostic Tool
 * Diagnoses Clinic & Guard module issues
 */

import { supabase } from "../core/core.js";

const DIAGNOSTIC_RESULTS = {
  issues: [],
  warnings: [],
  info: []
};

function log(type, message, details = null) {
  const entry = { timestamp: new Date().toISOString(), message, details };
  DIAGNOSTIC_RESULTS[type + 's'].push(entry);
  console[type.toUpperCase()](message, details || '');
}

// ============== DIAGNOSTIC 1: Check QR Code Format and Parsing ==============
export async function diagnoseQrCodeParsing() {
  log('info', '=== DIAGNOSTIC 1: QR Code Format Validation ===');
  
  // Check if student_ids table exists and has qr_code column
  try {
    const { data: qrData, error: qrError } = await supabase
      .from('student_ids')
      .select('qr_code, student_id')
      .limit(5);
    
    if (qrError) {
      log('error', 'student_ids table access failed', qrError.message);
      return false;
    }
    
    log('info', `Found ${qrData?.length || 0} QR code records`);
    
    if (qrData && qrData.length > 0) {
      qrData.forEach(record => {
        const qr = record.qr_code;
        const expectedPattern = /^EDU-\d{4}-[A-Z]{4}-\d{4}$/;
        const matches = expectedPattern.test(qr);
        
        if (matches) {
          log('info', `QR format VALID: ${qr}`);
        } else {
          log('warning', `QR format UNEXPECTED: ${qr}`, {
            expected: 'EDU-YYYY-LLLL-XXXX',
            actual: qr
          });
        }
      });
    }
    
    return true;
  } catch (e) {
    log('error', 'QR code diagnostic failed', e.message);
    return false;
  }
}

// ============== DIAGNOSTIC 2: Check Status Field Consistency ==============
export async function diagnoseStatusFields() {
  log('info', '=== DIAGNOSTIC 2: Status Field Consistency ===');
  
  // Check students table for current_status vs status
  try {
    const { data: studentData, error: studentError } = await supabase
      .from('students')
      .select('id, current_status, status')
      .limit(1);
    
    if (studentError) {
      log('error', 'students table access failed', studentError.message);
    } else if (studentData && studentData.length > 0) {
      const hasCurrentStatus = 'current_status' in studentData[0];
      const hasStatus = 'status' in studentData[0];
      
      log('info', `students table status fields`, {
        hasCurrentStatus,
        hasStatus,
        sampleStatus: studentData[0].current_status || studentData[0].status
      });
      
      if (!hasCurrentStatus && !hasStatus) {
        log('error', 'No status field found in students table!');
      }
    }
  } catch (e) {
    log('error', 'Status field diagnostic failed', e.message);
  }
  
  // Check tap_logs for status enum values
  try {
    const { data: tapData, error: tapError } = await supabase
      .from('tap_logs')
      .select('status')
      .limit(10);
    
    if (tapError) {
      log('error', 'tap_logs table access failed', tapError.message);
    } else if (tapData && tapData.length > 0) {
      const statuses = [...new Set(tapData.map(d => d.status))];
      log('info', `tap_logs status values found`, statuses);
      
      const expectedStatuses = ['ON_TIME', 'LATE', 'EARLY', 'DUPLICATE', 'PARTIAL', 'ok', 'blocked', 'rejected'];
      const unexpected = statuses.filter(s => !expectedStatuses.includes(s));
      
      if (unexpected.length > 0) {
        log('warning', 'Unexpected status values in tap_logs', unexpected);
      }
    }
  } catch (e) {
    log('error', 'tap_logs diagnostic failed', e.message);
  }
  
  // Check clinic_visits status values
  try {
    const { data: visitData, error: visitError } = await supabase
      .from('clinic_visits')
      .select('status')
      .limit(10);
    
    if (visitError) {
      log('error', 'clinic_visits table access failed', visitError.message);
    } else if (visitData && visitData.length > 0) {
      const statuses = [...new Set(visitData.map(d => d.status))];
      log('info', `clinic_visits status values found`, statuses);
    }
  } catch (e) {
    log('error', 'clinic_visits diagnostic failed', e.message);
  }
}

// ============== DIAGNOSTIC 3: Check Teacher Gatekeeper Role Implementation ==============
export async function diagnoseTeacherGatekeeper() {
  log('info', '=== DIAGNOSTIC 3: Teacher Gatekeeper Role Check ===');
  
  // Check teachers table for gatekeeper_role column
  try {
    const { data: teacherData, error: teacherError } = await supabase
      .from('teachers')
      .select('id, gatekeeper_role')
      .limit(5);
    
    if (teacherError) {
      log('error', 'teachers table access failed', teacherError.message);
      
      // Fallback: check if system_settings is used
      const { data: settingsData, error: settingsError } = await supabase
        .from('system_settings')
        .select('key, value')
        .eq('key', 'teacher_gatekeepers');
      
      if (!settingsError && settingsData && settingsData.length > 0) {
        log('info', 'Using system_settings for teacher gatekeepers', settingsData[0]);
      }
    } else if (teacherData) {
      const hasGatekeeperColumn = 'gatekeeper_role' in teacherData[0];
      log('info', `teachers table gatekeeper_role column`, { exists: hasGatekeeperColumn });
      
      if (hasGatekeeperColumn) {
        const gatekeepers = teacherData.filter(t => t.gatekeeper_role === true);
        log('info', `Teachers with gatekeeper_role=true: ${gatekeepers.length}`);
      }
    }
  } catch (e) {
    log('error', 'Teacher gatekeeper diagnostic failed', e.message);
  }
}

// ============== DIAGNOSTIC 4: Check Notification System ==============
export async function diagnoseNotifications() {
  log('info', '=== DIAGNOSTIC 4: Notification System Check ===');
  
  // Check recent notifications for verb consistency
  try {
    const { data: notifData, error: notifError } = await supabase
      .from('notifications')
      .select('verb, created_at')
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (notifError) {
      log('error', 'notifications table access failed', notifError.message);
    } else if (notifData && notifData.length > 0) {
      const verbs = [...new Set(notifData.map(d => d.verb))];
      log('info', `Notification verbs in use`, verbs);
      
      // Expected verbs from task specification
      const expectedVerbs = [
        'TAP_IN', 'TAP_OUT', 'CLINIC_ENTRY', 'CLINIC_EXIT',
        'PASS_APPROVED', 'PASS_REJECTED', 'LATE_ARRIVAL', 'EARLY_DEPARTURE',
        'FOLLOW_UP_REQUIRED'
      ];
      
      // Current verbs in use
      const currentVerbs = [
        'tap_in', 'tap_out', 'clinic_arrived', 'clinic_pass_approved',
        'clinic_visit_done', 'clinic_pass_rejected'
      ];
      
      const mismatched = verbs.filter(v => !expectedVerbs.includes(v) && !currentVerbs.includes(v));
      if (mismatched.length > 0) {
        log('warning', 'Non-standard notification verbs found', mismatched);
      }
    }
  } catch (e) {
    log('error', 'Notification diagnostic failed', e.message);
  }
}

// ============== DIAGNOSTIC 5: Check Required Tables Exist ==============
export async function diagnoseTableStructure() {
  log('info', '=== DIAGNOSTIC 5: Table Structure Validation ===');
  
  const requiredTables = [
    'students',
    'teachers',
    'clinic_staff', 
    'guards',
    'parents',
    'classes',
    'tap_logs',
    'clinic_visits',
    'clinic_passes',
    'notifications',
    'attendance_rules',
    'escort_relationships',
    'student_ids'
  ];
  
  for (const table of requiredTables) {
    try {
      const { error } = await supabase.from(table).select('id').limit(1);
      if (error) {
        log('error', `Table ${table} access failed`, error.message);
      } else {
        log('info', `Table ${table} exists`);
      }
    } catch (e) {
      log('error', `Table ${table} check failed`, e.message);
    }
  }
}

// ============== DIAGNOSTIC 6: Check Missing Modules ==============
export async function diagnoseMissingModules() {
  log('info', '=== DIAGNOSTIC 6: Missing Module Check ===');
  
  const expectedModules = [
    '/guard/guard-reports.html',
    '/guard/guard-reports.js',
    '/clinic/clinic-history.html',
    '/clinic/clinic-history.js'
  ];
  
  log('warning', 'Modules to verify', expectedModules);
  
  // Check if guard-reports exists (will fail if missing)
  // This is just informational
}

// ============== DIAGNOSTIC 7: Check RLS Policies ==============
export async function diagnoseRlsPolicies() {
  log('info', '=== DIAGNOSTIC 7: RLS Policy Check ===');
  
  // Try operations that should be blocked by RLS
  try {
    // Try to insert a tap_log (should work for authenticated guard)
    const { error } = await supabase.from('tap_logs').insert({
      student_id: '00000000-0000-0000-0000-000000000000',
      gatekeeper_id: '00000000-0000-0000-0000-000000000000',
      tap_type: 'in',
      status: 'test'
    }).select().limit(1);
    
    if (error) {
      log('info', 'RLS blocked tap_log insert (expected for test data)', error.message);
    } else {
      log('info', 'tap_log insert succeeded (test data was created - cleanup needed)');
    }
  } catch (e) {
    log('info', 'RLS check exception', e.message);
  }
}

// ============== RUN ALL DIAGNOSTICS ==============
export async function runAllDiagnostics() {
  console.log('Starting Phase 8 Implementation Diagnostics...');
  
  await diagnoseTableStructure();
  await diagnoseQrCodeParsing();
  await diagnoseStatusFields();
  await diagnoseTeacherGatekeeper();
  await diagnoseNotifications();
  await diagnoseMissingModules();
  await diagnoseRlsPolicies();
  
  console.log('=== DIAGNOSTIC SUMMARY ===');
  console.log('Errors:', DIAGNOSTIC_RESULTS.issues.length);
  console.log('Warnings:', DIAGNOSTIC_RESULTS.warnings.length);
  console.log('Info:', DIAGNOSTIC_RESULTS.info.length);
  
  return DIAGNOSTIC_RESULTS;
}

// Export results for external use
export function getDiagnosticResults() {
  return DIAGNOSTIC_RESULTS;
}
