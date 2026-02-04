export const SUPABASE_URL = "https://whmxpkqdveonprnbkmkr.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndobXhwa3FkdmVvbnBybmJrbWtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5OTkzODIsImV4cCI6MjA4NTU3NTM4Mn0.Ren0PAXa1iVviPdZqpYUN_2OrElgBVtvnf01eHtufK8";

// =============================================================================
// PHASE 9: PRODUCTION STABILIZATION CONSTANTS
// =============================================================================

// School Name - FIXED, NOT EDITABLE (system-defined constant)
export const SCHOOL_NAME = "Educare Colleges Inc";

// Student ID Format Configuration (EDU-YYYY-LAST4LRN-XXXX)
export const STUDENT_ID_FORMAT = {
  PREFIX: "EDU",
  YEAR_LENGTH: 4,
  LRN_LENGTH: 4,
  SEQ_LENGTH: 4,
  // Regex: EDU-YYYY-LAST4LRN-XXXX (last 4 chars of LRN + 4-digit sequence)
  PATTERN: /^EDU-\d{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/,
  // Pattern for parsing components
  PARSE_PATTERN: /^EDU-(\d{4})-([A-Z0-9]{4})-([A-Z0-9]{4})$/
};

// Scanner Configuration
export const SCANNER_CONFIG = {
  FPS: 10,
  QRBOX_WIDTH: 250,
  QRBOX_HEIGHT: 250,
  DEBOUNCE_MS: 2000, // Prevent duplicate scans within 2 seconds
  TIMEOUT_MS: 30000 // Scanner timeout
};

// Dashboard Role Definitions
export const ROLES = {
  ADMIN: 'admin',
  TEACHER: 'teacher',
  PARENT: 'parent',
  GUARD: 'guard',
  CLINIC: 'clinic'
};

// Attendance Types
export const ATTENDANCE_TYPES = {
  HOMEROOM: 'homeroom',
  SUBJECT: 'subject',
  CLINIC: 'clinic',
  GUARD_ENTRY: 'guard_entry',
  GUARD_EXIT: 'guard_exit'
};

// Attendance Statuses
export const ATTENDANCE_STATUS = {
  PRESENT: 'present',
  ABSENT: 'absent',
  LATE: 'late',
  EXCUSED: 'excused'
};
