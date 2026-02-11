import { supabase } from "./core.js";
import { getNoClassesEvent } from "./school-calendar.js";
import { STUDENT_ID_FORMAT, SCANNER_CONFIG } from "./config.js";

// Scanner debounce using config (2000ms default)
const SCAN_DEBOUNCE_MS = SCANNER_CONFIG.DEBOUNCE_MS || 2000;

function startOfDayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * Parse QR Code in format EDU-YYYY-LAST4LRN-XXXX
 * EDU: Fixed prefix identifying Educare Track system
 * YYYY: 4-digit year (e.g., 2025)
 * LAST4LRN: Last 4 characters of student's LRN
 * XXXX: 4-digit sequence number
 * 
 * Uses STUDENT_ID_FORMAT from config.js for validation
 * 
 * @param {string} qrCode - The QR code string to parse
 * @returns {Object} { valid: boolean, studentId: string, year: string, last4Lrn: string, sequence: string, error?: string }
 */
export function parseStudentID(qrCode) {
  const qr = String(qrCode ?? "").trim().toUpperCase();
  
  if (!qr) {
    return { valid: false, studentId: null, year: null, last4Lrn: null, sequence: null, error: "QR code is empty" };
  }
  
  // MANDATORY: Check EDU- prefix first for fast rejection
  if (!qr.startsWith("EDU-")) {
    return { valid: false, studentId: null, year: null, last4Lrn: null, sequence: null, error: "Invalid ID - must start with EDU-" };
  }
  
  // Validate using pattern from config
  const pattern = STUDENT_ID_FORMAT.PARSE_PATTERN;
  const match = qr.match(pattern);
  
  if (!match) {
    return { 
      valid: false, 
      studentId: null, 
      year: null, 
      last4Lrn: null, 
      sequence: null, 
      error: `Invalid QR format: expected ${STUDENT_ID_FORMAT.PREFIX}-YYYY-${STUDENT_ID_FORMAT.LRN_LENGTH}${STUDENT_ID_FORMAT.SEQ_LENGTH}-XXXX` 
    };
  }
  
  const [, year, last4Lrn, sequence] = match;
  
  // Validate year (must be within ±1 of current year)
  const currentYear = new Date().getFullYear();
  const yearNum = parseInt(year, 10);
  if (isNaN(yearNum) || yearNum < currentYear - 1 || yearNum > currentYear + 1) {
    return { valid: false, studentId: null, year: null, last4Lrn: null, sequence: null, error: `Invalid year in QR code: ${year}` };
  }
  
  // Construct full student ID: EDU-YYYY-LAST4LRN-XXXX
  const fullStudentId = `${STUDENT_ID_FORMAT.PREFIX}-${year}-${last4Lrn}-${sequence}`;
  
  return {
    valid: true,
    studentId: fullStudentId,
    year: year,
    last4Lrn: last4Lrn,
    sequence: sequence,
    error: null
  };
}

/**
 * Enhanced student lookup that handles parsed QR codes
 * Supports EDU-YYYY-LAST4LRN-XXXX format
 * 
 * @param {string} qrCode - The QR code string to lookup
 * @returns {Object|null} Student data or null if not found
 */
export async function lookupStudentByQr(qrCode) {
  const qr = String(qrCode ?? "").trim();
  if (!qr) return null;
  
  // Parse the QR code
  const parsed = parseStudentID(qr);
  
  if (parsed.valid) {
    // Use the full student ID from parsed result
    const { data, error } = await supabase
      .from("student_ids")
      .select("student_id,students(id,full_name,grade_level,strand,class_id,parent_id,current_status)")
      .eq("qr_code", parsed.studentId)
      .eq("is_active", true)
      .single();
    
    if (!error && data?.students) {
      console.log("[QR] Student found via parseStudentID:", {
        qr,
        parsed,
        studentId: data.student_id,
        studentName: data.students.full_name
      });
      return data.students;
    }
    
    console.log("[QR] Student not found for ID:", parsed.studentId);
    return null;
  }
  
  // If parsing failed, return null (no legacy support for non-standard formats)
  console.log("[QR] Invalid QR format:", parsed.error);
  return null;
}

function parseTimeToMinutes(value) {
  const s = String(value ?? "");
  const [hh, mm] = s.split(":");
  const h = Number(hh);
  const m = Number(mm);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function minutesFromDate(d) {
  return d.getHours() * 60 + d.getMinutes();
}

function isMorningTime(minutes) {
  // Morning session: 6:00 AM to 12:00 PM
  return minutes >= 360 && minutes < 720;
}

function isAfternoonTime(minutes) {
  // Afternoon session: 12:00 PM to 6:00 PM
  return minutes >= 720 && minutes < 1080;
}

function getCurrentSession() {
  const now = new Date();
  const minutes = minutesFromDate(now);
  return isMorningTime(minutes) ? "morning" : "afternoon";
}


export async function loadAttendanceRule(gradeLevel) {
  const { data, error } = await supabase
    .from("attendance_rules")
    .select("grade_level,entry_time,grace_until,late_until")
    .eq("grade_level", gradeLevel)
    .single();
  if (error) return null;
  return data ?? null;
}

function extractSettingValue(row) {
  const v = row?.value;
  if (v && typeof v === "object" && "value" in v) return v.value;
  return v ?? null;
}

export async function loadAttendanceSettings() {
  const { data, error } = await supabase
    .from("system_settings")
    .select("key,value")
    .in("key", ["school_start_time", "school_dismissal_time", "late_threshold_minutes", "early_exit_threshold_minutes"]);
  if (error) return null;
  const byKey = new Map((data ?? []).map((r) => [r.key, extractSettingValue(r)]));
  const schoolStartTime = byKey.get("school_start_time") ?? null;
  const schoolDismissalTime = byKey.get("school_dismissal_time") ?? null;
  const lateThresholdMinutesRaw = byKey.get("late_threshold_minutes") ?? null;
  const earlyExitThresholdMinutesRaw = byKey.get("early_exit_threshold_minutes") ?? null;
  const lateThresholdMinutes = Number(lateThresholdMinutesRaw);
  const earlyExitThresholdMinutes = Number(earlyExitThresholdMinutesRaw);
  return {
    schoolStartTime: schoolStartTime ? String(schoolStartTime) : null,
    schoolDismissalTime: schoolDismissalTime ? String(schoolDismissalTime) : null,
    lateThresholdMinutes: Number.isFinite(lateThresholdMinutes) ? lateThresholdMinutes : null,
    earlyExitThresholdMinutes: Number.isFinite(earlyExitThresholdMinutes) ? earlyExitThresholdMinutes : null,
  };
}

export function computeArrivalStatus(rule, now = new Date()) {
  if (!rule) return "present";
  const grace = parseTimeToMinutes(rule.grace_until);
  const lateUntil = parseTimeToMinutes(rule.late_until);
  const current = minutesFromDate(now);
  if (grace === null || lateUntil === null) return "present";
  if (current <= grace) return "present";
  if (current <= lateUntil) return "late";
  return "absent";
}

export function computeArrivalStatusFromSettings(settings, now = new Date()) {
  const start = parseTimeToMinutes(settings?.schoolStartTime);
  const threshold = Number(settings?.lateThresholdMinutes);
  if (start === null || !Number.isFinite(threshold)) return null;
  const current = minutesFromDate(now);
  return current > start + threshold ? "late" : "present";
}

export function computeDepartureStatusFromSettings(settings, now = new Date()) {
  const dismissal = parseTimeToMinutes(settings?.schoolDismissalTime);
  const threshold = Number(settings?.earlyExitThresholdMinutes);
  if (dismissal === null || !Number.isFinite(threshold)) return null;
  const current = minutesFromDate(now);
  
  // Handle early exit
  if (current < dismissal - threshold) {
    return "early";
  }
  
  // Handle late exit (30+ minutes after dismissal)
  if (current > dismissal + 30) {
    return "late_exit";
  }
  
  // Normal exit within dismissal time ±30 minutes
  return "normal";
}

async function checkMorningAfternoonAbsence(studentId, currentSession) {
  const today = new Date().toISOString().slice(0, 10);
  
  // Check if student has any taps today
  const { data: taps, error } = await supabase
    .from("tap_logs")
    .select("tap_type, timestamp")
    .eq("student_id", studentId)
    .gte("timestamp", today)
    .order("timestamp", { ascending: true });
  
  if (error) throw error;
  
  if (taps.length === 0) {
    // No taps today - check if this is afternoon session
    if (currentSession === "afternoon") {
      return "morning_absent"; // Internal logic only - maps to 'absent' in schema
    }
    return null;
  }
  
  // Check for incomplete day (tap in morning but no afternoon tap)
  if (currentSession === "afternoon") {
    const morningTap = taps.find(tap => {
      const tapTime = new Date(tap.timestamp);
      return isMorningTime(minutesFromDate(tapTime));
    });
    
    if (morningTap && !taps.some(tap => {
      const tapTime = new Date(tap.timestamp);
      return isAfternoonTime(minutesFromDate(tapTime)) && tap.tap_type === "in";
    })) {
      return "afternoon_absent"; // Internal logic only - maps to 'absent' in schema
    }
  }
  
  return null;
}

// Check for incomplete days (tap in but no tap out)
async function checkIncompleteDay(studentId) {
  const today = new Date().toISOString().slice(0, 10);
  
  const { data: taps, error } = await supabase
    .from("tap_logs")
    .select("tap_type, timestamp")
    .eq("student_id", studentId)
    .gte("timestamp", today)
    .order("timestamp", { ascending: true });
  
  if (error) throw error;
  
  // Check if student tapped in but never tapped out
  const hasTapIn = taps.some(tap => tap.tap_type === "in");
  const hasTapOut = taps.some(tap => tap.tap_type === "out");
  
  if (hasTapIn && !hasTapOut) {
    return "incomplete"; // Student is still in school
  }
  
  return null; // Day is complete
}

async function loadLatestTapToday(studentId) {
  const { data, error } = await supabase
    .from("tap_logs")
    .select("tap_type,timestamp")
    .eq("student_id", studentId)
    .gte("timestamp", startOfDayIso())
    .order("timestamp", { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0] ?? null;
}

// Map status values to valid schema values (only present, late, absent, excused)
function mapStatusToSchema(status) {
  const s = String(status ?? "").toLowerCase();
  // Only handle the four required statuses - remove unnecessary internal mappings
  if (["present", "late", "absent", "excused"].includes(s)) {
    return s;
  }
  // Default to present for any unrecognized status
  return "present";
}

async function upsertHomeroomTapIn({ student, status }) {
  const dateStr = new Date().toISOString().slice(0, 10);
  const mappedStatus = mapStatusToSchema(status);
  const { error } = await supabase.from("homeroom_attendance").upsert(
    {
      student_id: student.id,
      class_id: student.class_id,
      date: dateStr,
      tap_in_time: new Date().toISOString(),
      status: mappedStatus,
    },
    { onConflict: "student_id,date" }
  );
  if (error) throw error;
}

async function setHomeroomTapOut({ student }) {
  const dateStr = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("homeroom_attendance")
    .update({ tap_out_time: new Date().toISOString() })
    .eq("student_id", student.id)
    .eq("date", dateStr)
    .select("id")
    .limit(1);
  if (!error && (data?.length ?? 0) > 0) return;
  const { error: insErr } = await supabase.from("homeroom_attendance").insert({
    student_id: student.id,
    class_id: student.class_id,
    date: dateStr,
    tap_out_time: new Date().toISOString(),
    status: "present", // Maps from 'partial' to 'present' for schema compliance
  });
  if (insErr) throw insErr;
}

async function insertTapLog({ studentId, gatekeeperId, tapType, status, remarks }) {
  const { error } = await supabase.from("tap_logs").insert({
    student_id: studentId,
    gatekeeper_id: gatekeeperId,
    tap_type: tapType,
    timestamp: new Date().toISOString(),
    status: status ?? "ok",
    remarks: remarks ?? null,
  });
  if (error) throw error;
}

async function getHomeroomTeacherId(classId) {
  if (!classId) return null;
  const { data, error } = await supabase
    .from("classes")
    .select("homeroom_teacher_id")
    .eq("id", classId)
    .single();
  if (error) return null;
  return data?.homeroom_teacher_id;
}

async function updateStudentCurrentStatus({ studentId, status }) {
  const { error } = await supabase.from("students").update({ current_status: status }).eq("id", studentId);
  if (error) throw error;
}

/**
 * Notification verb constants - standardized across the application
 */
export const NOTIFICATION_VERBS = {
  TAP_IN: "TAP_IN",
  TAP_OUT: "TAP_OUT",
  TAP_IN_LATE: "LATE_ARRIVAL",
  TAP_OUT_EARLY: "EARLY_DEPARTURE",
  CLINIC_ENTRY: "CLINIC_ENTRY",
  CLINIC_EXIT: "CLINIC_EXIT",
  PASS_APPROVED: "PASS_APPROVED",
  PASS_REJECTED: "PASS_REJECTED",
  CLINIC_ARRIVED: "clinic_arrived", // Legacy for compatibility
  CLINIC_PASS_APPROVED: "clinic_pass_approved", // Legacy
  CLINIC_VISIT_DONE: "clinic_visit_done", // Legacy
};

/**
 * Enhanced notify function with logging
 */
export async function notify({ recipientId, actorId, verb, object }) {
  if (!recipientId) {
    console.log("[Notify] Skipped - no recipient");
    return;
  }
  
  console.log("[Notify] Sending notification", {
    recipientId,
    actorId,
    verb,
    object,
    timestamp: new Date().toISOString()
  });
  
  const { error } = await supabase.from("notifications").insert({
    recipient_id: recipientId,
    actor_id: actorId,
    verb,
    object: object ?? {},
    read: false,
  });
  
  if (error) {
    console.error("[Notify] Failed to send notification:", error.message);
    throw error;
  }
  
  console.log("[Notify] Notification sent successfully");
}

/**
 * Enhanced recordTap with comprehensive logging
 * Uses SCAN_DEBOUNCE_MS from config.js
 */
export async function recordTap({ gatekeeperId, student, tapType, duplicateWindowMs = SCAN_DEBOUNCE_MS }) {
  console.log("[RecordTap] Starting", {
    gatekeeperId,
    studentId: student?.id,
    studentName: student?.full_name,
    tapType,
    timestamp: new Date().toISOString()
  });
  
  if (!student?.id) {
    console.error("[RecordTap] Student not found");
    throw new Error("Student not found.");
  }
  
  const type = String(tapType ?? "").toLowerCase();
  if (type !== "in" && type !== "out") {
    console.error("[RecordTap] Invalid tap type:", tapType);
    throw new Error("Invalid tap type.");
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  const noClasses = await getNoClassesEvent({ dateStr, gradeLevel: student.grade_level });
  if (noClasses) {
    console.log("[RecordTap] Blocked - no classes today", noClasses);
    await insertTapLog({
      studentId: student.id,
      gatekeeperId,
      tapType: type,
      status: "blocked",
      remarks: `No classes today: ${noClasses.title || noClasses.type}`,
    });
    return { result: "blocked", reason: "no_classes", event: noClasses };
  }

  const latest = await loadLatestTapToday(student.id);
  console.log("[RecordTap] Latest tap today:", latest);
  
  if (latest?.tap_type && latest?.timestamp) {
    const sameType = String(latest.tap_type).toLowerCase() === type;
    const dt = Date.now() - new Date(latest.timestamp).getTime();
    if (sameType && dt >= 0 && dt < duplicateWindowMs) {
      console.log("[RecordTap] Duplicate ignored:", { studentId: student.id, type, dt });
      await insertTapLog({
        studentId: student.id,
        gatekeeperId,
        tapType: type,
        status: "duplicate",
        remarks: "Ignored duplicate scan.",
      });
      return { result: "duplicate" };
    }
  }

  const latestType = latest?.tap_type ? String(latest.tap_type).toLowerCase() : null;
  if (type === "out" && latestType !== "in") {
    console.log("[RecordTap] Rejected - no tap-in recorded today");
    await insertTapLog({
      studentId: student.id,
      gatekeeperId,
      tapType: "out",
      status: "rejected",
      remarks: "No tap-in recorded today.",
    });
    return { result: "rejected", reason: "no_in" };
  }

  if (type === "in" && latestType === "in") {
    console.log("[RecordTap] Rejected - already tapped in");
    await insertTapLog({
      studentId: student.id,
      gatekeeperId,
      tapType: "in",
      status: "rejected",
      remarks: "Already tapped in. Tap out first.",
    });
    return { result: "rejected", reason: "double_in" };
  }

  if (type === "in") {
    // [Date Checked: 2026-02-11] | [Remarks: Fixed priority bug - grade-level rules now take precedence over global settings]
    const settings = await loadAttendanceSettings();
    const byGradeRule = computeArrivalStatus(await loadAttendanceRule(student.grade_level));
    const arrival = byGradeRule ?? computeArrivalStatusFromSettings(settings);
    
    // Check for morning/afternoon absence scenarios
    const currentSession = getCurrentSession();
    const absenceType = await checkMorningAfternoonAbsence(student.id, currentSession);
    
    let finalStatus = arrival;
    let remarks = arrival;
    
    // Handle afternoon-only entry (first tap is PM)
    if (currentSession === "afternoon" && absenceType === "morning_absent") {
      finalStatus = "morning_absent";
      remarks = "Afternoon only entry - Morning absent, excuse letter required";
      
      // Notify teacher about morning absence
      await notify({
        recipientId: student.class_id ? await getHomeroomTeacherId(student.class_id) : null,
        actorId: gatekeeperId,
        verb: "MORNING_ABSENCE",
        object: { 
          student_id: student.id, 
          student_name: student.full_name,
          timestamp: new Date().toISOString(),
          message: "Student arrived afternoon only - morning absence recorded"
        },
      });
    }
    
    console.log("[RecordTap] Recording tap-in", {
      studentId: student.id,
      studentName: student.full_name,
      arrivalStatus: finalStatus,
      absenceType,
      currentSession,
      timestamp: new Date().toISOString()
    });
    
    await upsertHomeroomTapIn({ student, status: finalStatus });
    await updateStudentCurrentStatus({ studentId: student.id, status: "in" });
    await insertTapLog({ studentId: student.id, gatekeeperId, tapType: "in", status: "ok", remarks });
    
    // Use standardized notification verb based on arrival status
    const displayStatus = mapStatusToSchema(finalStatus);
    const verb = displayStatus === "late" ? NOTIFICATION_VERBS.TAP_IN_LATE : NOTIFICATION_VERBS.TAP_IN;
    
    // NOTIFY TEACHER FIRST - Teacher must approve before parent notification
    // This enforces ADMIN → TEACHER → PARENT hierarchy
    await notify({
      recipientId: await getHomeroomTeacherId(student.class_id),
      actorId: gatekeeperId,
      verb: verb,
      object: { 
        student_id: student.id, 
        student_name: student.full_name,
        timestamp: new Date().toISOString(), 
        status: displayStatus, // Use mapped status for display
        remarks,
        requires_approval: true, // Teacher must approve before parent notification
        notification_type: "attendance_tap_in"
      },
    });
    
    // NOTIFY PARENT - Send immediate notification to parent
    if (student.parent_id) {
      await notify({
        recipientId: student.parent_id,
        actorId: gatekeeperId,
        verb: verb === NOTIFICATION_VERBS.TAP_IN_LATE ? "tap_in_late" : "tap_in",
        object: { 
          student_id: student.id, 
          student_name: student.full_name,
          timestamp: new Date().toISOString(), 
          status: displayStatus,
          remarks
        },
      });
      console.log("[RecordTap] Parent notified of tap-in");
    }
    
    console.log("[RecordTap] Tap-in recorded successfully");
    return { result: "ok", arrival: finalStatus, absenceType };
  }

  console.log("[RecordTap] Recording tap-out", {
    studentId: student.id,
    studentName: student.full_name,
    timestamp: new Date().toISOString()
  });
  
  // Check for early exit
  const settings = await loadAttendanceSettings();
  const departureStatus = computeDepartureStatusFromSettings(settings);
  let remarks = "normal";
  let verb = NOTIFICATION_VERBS.TAP_OUT;
  
  if (departureStatus === "early") {
    remarks = "Early exit - before dismissal time";
    verb = NOTIFICATION_VERBS.TAP_OUT_EARLY;
    
    // Notify teacher about early exit
    await notify({
      recipientId: student.class_id ? await getHomeroomTeacherId(student.class_id) : null,
      actorId: gatekeeperId,
      verb: NOTIFICATION_VERBS.TAP_OUT_EARLY,
      object: { 
        student_id: student.id, 
        student_name: student.full_name,
        timestamp: new Date().toISOString(),
        message: "Student exited early - before dismissal time"
      },
    });
  }
  
  await setHomeroomTapOut({ student });
  await updateStudentCurrentStatus({ studentId: student.id, status: "out" });
  await insertTapLog({ studentId: student.id, gatekeeperId, tapType: "out", status: "ok", remarks });
  
  // NOTIFY TEACHER FIRST - Teacher must approve before parent notification
  // This enforces ADMIN → TEACHER → PARENT hierarchy
  await notify({
    recipientId: await getHomeroomTeacherId(student.class_id),
    actorId: gatekeeperId,
    verb: verb,
    object: { 
      student_id: student.id, 
      student_name: student.full_name,
      timestamp: new Date().toISOString(), 
      status: departureStatus, 
      remarks,
      requires_approval: true, // Teacher must approve before parent notification
      notification_type: "attendance_tap_out"
    },
  });
  
  // NOTIFY PARENT - Send immediate notification to parent
  if (student.parent_id) {
    await notify({
      recipientId: student.parent_id,
      actorId: gatekeeperId,
      verb: verb === NOTIFICATION_VERBS.TAP_OUT_EARLY ? "tap_out_early" : "tap_out",
      object: { 
        student_id: student.id, 
        student_name: student.full_name,
        timestamp: new Date().toISOString(), 
        status: departureStatus,
        remarks
      },
    });
    console.log("[RecordTap] Parent notified of tap-out");
  }
  
  console.log("[RecordTap] Tap-out recorded successfully");
  return { result: "ok", departureStatus };
}

async function loadLatestPass(studentId) {
  const { data, error } = await supabase
    .from("clinic_passes")
    .select("id,student_id,clinic_visit_id,issued_by,reason,status,issued_at")
    .eq("student_id", studentId)
    .in("status", ["pending", "approved"])
    .order("issued_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function createClinicVisit({ clinicId, studentId, reason, notes, symptoms, severity }) {
  const { data, error } = await supabase
    .from("clinic_visits")
    .insert({
      student_id: studentId,
      reason: reason || null,
      treated_by: clinicId,
      notes: notes || null,
      symptoms: symptoms || null,
      severity: severity || null,
      status: "in_clinic",
      entry_timestamp: new Date().toISOString(),
    })
    .select("id")
    .limit(1);
  if (error) throw error;
  const id = data?.[0]?.id;
  if (!id) throw new Error("Clinic visit created but id not returned.");
  return id;
}

export async function updateClinicPass(passId, patch) {
  const { error } = await supabase.from("clinic_passes").update(patch).eq("id", passId);
  if (error) throw error;
}

export async function updateClinicVisit(visitId, patch) {
  const { error } = await supabase.from("clinic_visits").update(patch).eq("id", visitId);
  if (error) throw error;
}

/**
 * Complete Clinic Handshake Workflow Functions
 */

export async function updateClinicFindings({
  visitId,
  clinicStaffId,
  diagnosis,
  treatmentNotes,
  followUpRequired,
  actionTaken,
  symptoms
}) {
  console.log("[ClinicFindings] Updating clinic findings", {
    visitId,
    clinicStaffId,
    diagnosis,
    actionTaken
  });

  // Update clinic findings
  await updateClinicVisit(visitId, {
    diagnosis: diagnosis || null,
    treatment_notes: treatmentNotes || null,
    follow_up_required: followUpRequired || false,
    action_taken: actionTaken || null,
    symptoms: symptoms || null,
    status: "treated",
    treated_by: clinicStaffId
  });

  // Get visit details for notification
  const { data: visit } = await supabase
    .from("clinic_visits")
    .select("student_id, reason")
    .eq("id", visitId)
    .single();

  if (!visit) throw new Error("Clinic visit not found");

  // Get student and teacher info
  const { data: student } = await supabase
    .from("students")
    .select("full_name, class_id, parent_id")
    .eq("id", visit.student_id)
    .single();

  const { data: classInfo } = await supabase
    .from("classes")
    .select("homeroom_teacher_id")
    .eq("id", student.class_id)
    .single();

  // Request teacher approval for action
  if (classInfo?.homeroom_teacher_id) {
    console.log("[ClinicFindings] Requesting teacher approval:", classInfo.homeroom_teacher_id);
    
    await notify({
      recipientId: classInfo.homeroom_teacher_id,
      actorId: clinicStaffId,
      verb: "CLINIC_TEACHER_APPROVAL",
      object: {
        student_id: visit.student_id,
        student_name: student.full_name,
        clinic_visit_id: visitId,
        diagnosis: diagnosis,
        action_taken: actionTaken,
        reason: visit.reason,
        symptoms: symptoms,
        timestamp: new Date().toISOString(),
        requires_approval: true
      }
    });

    // Update status to await teacher approval
    await updateClinicVisit(visitId, { status: "teacher_approval" });
  } else {
    // If no teacher, notify parent directly
    await notifyParentAfterFindings({
      visitId,
      clinicStaffId,
      studentId: visit.student_id,
      studentName: student.full_name,
      diagnosis,
      actionTaken,
      reason: visit.reason
    });
  }

  console.log("[ClinicFindings] Findings updated and teacher approval requested");
}

export async function teacherApproveClinicAction({
  visitId,
  teacherId,
  approvalNotes
}) {
  console.log("[TeacherApproval] Processing teacher approval", { visitId, teacherId });

  // Get visit details
  const { data: visit } = await supabase
    .from("clinic_visits")
    .select("student_id, treated_by, diagnosis, action_taken, reason")
    .eq("id", visitId)
    .single();

  if (!visit) throw new Error("Clinic visit not found");

  // Update teacher approval
  await updateClinicVisit(visitId, {
    teacher_approved: true,
    teacher_approval_timestamp: new Date().toISOString(),
    notes: approvalNotes ? `${visit.notes || ''}\nTeacher Approval: ${approvalNotes}`.trim() : visit.notes
  });

  // Get student info for parent notification
  const { data: student } = await supabase
    .from("students")
    .select("full_name, parent_id")
    .eq("id", visit.student_id)
    .single();

  // Notify parent
  await notify({
    recipientId: student.parent_id,
    actorId: teacherId,
    verb: "CLINIC_PARENT_NOTIFICATION",
    object: {
      student_id: visit.student_id,
      student_name: student.full_name,
      clinic_visit_id: visitId,
      diagnosis: visit.diagnosis,
      action_taken: visit.action_taken,
      reason: visit.reason,
      approved_by_teacher: true,
      timestamp: new Date().toISOString()
    }
  });

  // Notify clinic staff of approval
  if (visit.treated_by) {
    await notify({
      recipientId: visit.treated_by,
      actorId: teacherId,
      verb: "CLINIC_TEACHER_APPROVAL_CONFIRMED",
      object: {
        student_id: visit.student_id,
        clinic_visit_id: visitId,
        timestamp: new Date().toISOString()
      }
    });
  }

  // Update final status
  await updateClinicVisit(visitId, { status: "parent_notified" });

  console.log("[TeacherApproval] Teacher approval processed successfully");
}

export async function completeClinicVisit({
  visitId,
  clinicStaffId,
  finalStatus,
  exitNotes
}) {
  console.log("[CompleteVisit] Completing clinic visit", { visitId, finalStatus });

  // Get visit details
  const { data: visit } = await supabase
    .from("clinic_visits")
    .select("student_id, action_taken")
    .eq("id", visitId)
    .single();

  if (!visit) throw new Error("Clinic visit not found");

  // Update exit timestamp and final status
  await updateClinicVisit(visitId, {
    exit_timestamp: new Date().toISOString(),
    status: finalStatus,
    notes: exitNotes ? `${visit.notes || ''}\nExit: ${exitNotes}`.trim() : visit.notes
  });

  // Get student info
  const { data: student } = await supabase
    .from("students")
    .select("full_name, parent_id, class_id")
    .eq("id", visit.student_id)
    .single();

  // Get teacher info
  const { data: classInfo } = await supabase
    .from("classes")
    .select("homeroom_teacher_id")
    .eq("id", student.class_id)
    .single();

  // Send final notification based on action
  if (finalStatus === "sent_home") {
    // Notify parent student was sent home
    await notify({
      recipientId: student.parent_id,
      actorId: clinicStaffId,
      verb: "CLINIC_SENT_HOME",
      object: {
        student_id: visit.student_id,
        student_name: student.full_name,
        clinic_visit_id: visitId,
        action_taken: visit.action_taken,
        timestamp: new Date().toISOString()
      }
    });
    
    // Notify teacher student was sent home
    if (classInfo?.homeroom_teacher_id) {
      await notify({
        recipientId: classInfo.homeroom_teacher_id,
        actorId: clinicStaffId,
        verb: "CLINIC_SENT_HOME",
        object: {
          student_id: visit.student_id,
          student_name: student.full_name,
          clinic_visit_id: visitId,
          action_taken: visit.action_taken,
          timestamp: new Date().toISOString()
        }
      });
    }
  } else if (finalStatus === "completed") {
    // Notify parent student returned to class
    await notify({
      recipientId: student.parent_id,
      actorId: clinicStaffId,
      verb: "CLINIC_RETURNED_CLASS",
      object: {
        student_id: visit.student_id,
        student_name: student.full_name,
        clinic_visit_id: visitId,
        timestamp: new Date().toISOString()
      }
    });
  }

  // Update student status
  await updateStudentCurrentStatus({
    studentId: visit.student_id,
    status: finalStatus === "sent_home" ? "out" : "in"
  });

  console.log("[CompleteVisit] Clinic visit completed successfully");
}

async function notifyParentAfterFindings({
  visitId,
  clinicStaffId,
  studentId,
  studentName,
  diagnosis,
  actionTaken,
  reason
}) {
  // Get parent ID
  const { data: student } = await supabase
    .from("students")
    .select("parent_id")
    .eq("id", studentId)
    .single();

  if (student?.parent_id) {
    await notify({
      recipientId: student.parent_id,
      actorId: clinicStaffId,
      verb: "CLINIC_PARENT_NOTIFICATION",
      object: {
        student_id: studentId,
        student_name: studentName,
        clinic_visit_id: visitId,
        diagnosis: diagnosis,
        action_taken: actionTaken,
        reason: reason,
        timestamp: new Date().toISOString()
      }
    });

    await updateClinicVisit(visitId, {
      parent_notified: true,
      parent_notification_timestamp: new Date().toISOString(),
      status: "parent_notified"
    });
  }
}

export async function recordClinicArrival({ clinicStaffId, student, notes }) {
  console.log("[ClinicArrival] Processing clinic arrival", {
    clinicStaffId,
    studentId: student?.id,
    studentName: student?.full_name,
    notes,
    timestamp: new Date().toISOString()
  });
  
  if (!student?.id) {
    console.error("[ClinicArrival] Student not found");
    throw new Error("Student not found.");
  }

  const pass = await loadLatestPass(student.id);
  console.log("[ClinicArrival] Latest pass found:", pass);
  
  let visitId = pass?.clinic_visit_id ?? null;

  if (visitId) {
    console.log("[ClinicArrival] Updating existing visit:", visitId);
    await updateClinicVisit(visitId, { status: "in_clinic", notes: notes?.trim() || null, treated_by: clinicStaffId });
  } else {
    console.log("[ClinicArrival] Creating new visit for student:", student.id);
    visitId = await createClinicVisit({ clinicId: clinicStaffId, studentId: student.id, reason: pass?.reason ?? null, notes });
  }

  if (pass?.id) {
    const nextStatus = pass.status === "pending" ? "approved" : pass.status;
    console.log("[ClinicArrival] Updating pass status:", pass.id, nextStatus);
    await updateClinicPass(pass.id, { status: nextStatus, clinic_visit_id: visitId });
  }

  // Insert tap_log for clinic arrival
  console.log("[ClinicArrival] Inserting tap_log for clinic arrival");
  await insertTapLog({
    studentId: student.id,
    gatekeeperId: clinicStaffId,
    tapType: "in",
    status: "clinic",
    remarks: "Clinic arrival" + (pass?.id ? ` (pass: ${pass.id})` : ""),
  });

  // Update student current status
  await updateStudentCurrentStatus({ studentId: student.id, status: "in_clinic" });

  // Notify teacher who issued the pass
  if (pass?.issued_by) {
    console.log("[ClinicArrival] Notifying teacher:", pass.issued_by);
    await notify({
      recipientId: pass.issued_by,
      actorId: clinicStaffId,
      verb: NOTIFICATION_VERBS.CLINIC_ENTRY,
      object: { student_id: student.id, pass_id: pass?.id ?? null, clinic_visit_id: visitId, timestamp: new Date().toISOString() },
    });
  }

  // Notify parent
  console.log("[ClinicArrival] Notifying parent:", student.parent_id);
  await notify({
    recipientId: student.parent_id,
    actorId: clinicStaffId,
    verb: NOTIFICATION_VERBS.CLINIC_ENTRY,
    object: { student_id: student.id, pass_id: pass?.id ?? null, clinic_visit_id: visitId, timestamp: new Date().toISOString() },
  });

  console.log("[ClinicArrival] Clinic arrival recorded successfully", {
    visitId,
    passId: pass?.id,
    studentId: student.id
  });

  return { result: "ok", pass, clinicVisitId: visitId };
}

export async function recordClinicDeparture({ clinicStaffId, student, notes }) {
  console.log("[ClinicDeparture] Processing clinic departure", {
    clinicStaffId,
    studentId: student?.id,
    studentName: student?.full_name,
    notes,
    timestamp: new Date().toISOString()
  });
  
  if (!student?.id) {
    console.error("[ClinicDeparture] Student not found");
    throw new Error("Student not found.");
  }

  // Find the current clinic visit
  const { data: visit, error: visitError } = await supabase
    .from("clinic_visits")
    .select("id, status")
    .eq("student_id", student.id)
    .in("status", ["in_clinic", "waiting"])
    .order("created_at", { ascending: false })
    .limit(1);
    
  if (visitError) {
    console.error("[ClinicDeparture] Error fetching visit:", visitError);
    throw visitError;
  }
  
  const currentVisit = visit?.[0];
  
  if (!currentVisit) {
    console.log("[ClinicDeparture] No active clinic visit found for student");
    // Still create a tap_log for departure even without a visit
  }

  // Update visit status
  if (currentVisit) {
    console.log("[ClinicDeparture] Updating visit status to completed:", currentVisit.id);
    await updateClinicVisit(currentVisit.id, { 
      status: "completed", 
      notes: notes?.trim() || null,
      treated_by: clinicStaffId
    });
  }

  // Insert tap_log for clinic departure
  console.log("[ClinicDeparture] Inserting tap_log for clinic departure");
  await insertTapLog({
    studentId: student.id,
    gatekeeperId: clinicStaffId,
    tapType: "out",
    status: "clinic",
    remarks: "Clinic departure" + (currentVisit ? ` (visit: ${currentVisit.id})` : ""),
  });

  // Update student current status back to in
  await updateStudentCurrentStatus({ studentId: student.id, status: "in" });

  // Notify teacher who issued the pass
  const pass = await loadLatestPass(student.id);
  if (pass?.issued_by) {
    console.log("[ClinicDeparture] Notifying teacher:", pass.issued_by);
    await notify({
      recipientId: pass.issued_by,
      actorId: clinicStaffId,
      verb: NOTIFICATION_VERBS.CLINIC_EXIT,
      object: { 
        student_id: student.id, 
        clinic_visit_id: currentVisit?.id ?? null, 
        timestamp: new Date().toISOString() 
      },
    });
  }

  // Notify parent of departure
  console.log("[ClinicDeparture] Notifying parent:", student.parent_id);
  await notify({
    recipientId: student.parent_id,
    actorId: clinicStaffId,
    verb: NOTIFICATION_VERBS.CLINIC_EXIT,
    object: { 
      student_id: student.id, 
      clinic_visit_id: currentVisit?.id ?? null, 
      timestamp: new Date().toISOString() 
    },
  });

  console.log("[ClinicDeparture] Clinic departure recorded successfully", {
    visitId: currentVisit?.id,
    studentId: student.id
  });

  return { result: "ok", visit: currentVisit };
}

/**
 * Parse student QR code in EDU-YYYY-LLLL-XXXX format
 * YYYY: enrollment year, LLLL: class code, XXXX: unique student identifier
 * 
 * @param {string} qrString - The QR code string to parse
 * @returns {Object} { year, class, studentId } or throws error for invalid formats
 */
export function parseStudentQR(qrString) {
  const qr = String(qrString ?? "").trim().toUpperCase();
  
  if (!qr) {
    throw new Error("QR code is empty");
  }
  
  // Validate EDU prefix
  if (!qr.startsWith("EDU-")) {
    throw new Error("Invalid QR format: must start with 'EDU-'");
  }
  
  // Parse components: EDU-YYYY-LLLL-XXXX
  const parts = qr.split("-");
  if (parts.length !== 4) {
    throw new Error("Invalid QR format: expected EDU-YYYY-LLLL-XXXX");
  }
  
  const [, year, classCode, studentId] = parts;
  
  // Validate year (4 digits)
  if (!/^\d{4}$/.test(year)) {
    throw new Error("Invalid year format in QR code");
  }
  
  // Validate class code (2-6 alphanumeric characters)
  if (!/^[A-Z0-9]{2,6}$/.test(classCode)) {
    throw new Error("Invalid class code format in QR code");
  }
  
  // Validate student ID (4 digits)
  if (!/^\d{4}$/.test(studentId)) {
    throw new Error("Invalid student ID format in QR code");
  }
  
  return { year, class: classCode, studentId };
}

/**
 * Record a tap event at the gate
 * Creates tap log entry, applies attendance rules, and triggers notifications
 * 
 * @param {Object} params - Parameters for tap recording
 * @param {string} params.studentId - Student UUID
 * @param {string} params.gatekeeperId - Guard/Teacher UUID
 * @param {string} params.tapType - 'in' or 'out'
 * @param {string} params.location - Gate location
 * @returns {Object} Result including status and notifications sent
 */
export async function recordTapEvent({ studentId, gatekeeperId, tapType, location }) {
  console.log("[recordTapEvent] Recording tap event", {
    studentId,
    gatekeeperId,
    tapType,
    location,
    timestamp: new Date().toISOString()
  });
  
  // Get current date for daily checks
  const dateStr = new Date().toISOString().slice(0, 10);
  
  // Check for no classes event
  const noClasses = await getNoClassesEvent({ dateStr, gradeLevel: null });
  if (noClasses) {
    await insertTapLog({
      studentId,
      gatekeeperId,
      tapType,
      status: "blocked",
      remarks: `No classes today: ${noClasses.title || noClasses.type}`,
      location
    });
    return { result: "blocked", reason: "no_classes", event: noClasses };
  }
  
  // Check for duplicate taps
  const latest = await loadLatestTapToday(studentId);
  if (latest?.tap_type === tapType) {
    const dt = Date.now() - new Date(latest.timestamp).getTime();
    if (dt < 120000) { // 2 minute duplicate window
      await insertTapLog({
        studentId,
        gatekeeperId,
        tapType,
        status: "duplicate",
        remarks: "Duplicate scan ignored",
        location
      });
      return { result: "duplicate" };
    }
  }
  
  // Validate tap sequence
  if (tapType === "out" && latest?.tap_type !== "in") {
    await insertTapLog({
      studentId,
      gatekeeperId,
      tapType: "out",
      status: "rejected",
      remarks: "No tap-in recorded today",
      location
    });
    return { result: "rejected", reason: "no_in" };
  }
  
  if (tapType === "in" && latest?.tap_type === "in") {
    await insertTapLog({
      studentId,
      gatekeeperId,
      tapType: "in",
      status: "rejected",
      remarks: "Already tapped in",
      location
    });
    return { result: "rejected", reason: "double_in" };
  }
  
  // Determine arrival status for tap-in
  let arrivalStatus = "on_time";
  if (tapType === "in") {
    // [Date Checked: 2026-02-11] | [Remarks: Fixed priority bug - grade-level rules now take precedence over global settings]
    const settings = await loadAttendanceSettings();
    const byGradeRule = computeArrivalStatus(await loadAttendanceRule(student.grade_level));
    arrivalStatus = byGradeRule ?? computeArrivalStatusFromSettings(settings) ?? "on_time";
    
    await upsertHomeroomTapIn({
      student: { id: studentId, class_id: null },
      status: arrivalStatus === "late" ? "late" : "present"
    });
    
    await updateStudentCurrentStatus({ studentId, status: "in" });
  } else {
    await setHomeroomTapOut({ student: { id: studentId, class_id: null } });
    await updateStudentCurrentStatus({ studentId, status: "out" });
  }
  
  // Record tap log
  await insertTapLog({
    studentId,
    gatekeeperId,
    tapType,
    status: arrivalStatus === "late" ? "late" : "ok",
    remarks: arrivalStatus,
    location
  });
  
  // Get student info for notifications
  const student = await getStudentContext(studentId);
  
  // Trigger parent notification
  if (student?.parent_id) {
    const verb = tapType === "in" 
      ? (arrivalStatus === "late" ? NOTIFICATION_VERBS.TAP_IN_LATE : NOTIFICATION_VERBS.TAP_IN)
      : NOTIFICATION_VERBS.TAP_OUT;
    
    await notify({
      recipientId: student.parent_id,
      actorId: gatekeeperId,
      verb,
      object: { student_id: studentId, timestamp: new Date().toISOString(), location, arrivalStatus }
    });
  }
  
  return { 
    result: "ok", 
    status: arrivalStatus,
    notificationsSent: !!student?.parent_id
  };
}

/**
 * Get complete student context including attendance status, clinic passes, and emergency contacts
 * 
 * @param {string} studentId - Student UUID
 * @returns {Object} Complete student information
 */
export async function getStudentContext(studentId) {
  console.log("[getStudentContext] Fetching student context", studentId);
  
  // Fetch student with related data
  const { data: student, error: studentError } = await supabase
    .from("students")
    .select(`
      id,
      full_name,
      grade_level,
      strand,
      class_id,
      parent_id,
      current_status,
      emergency_contact_name,
      emergency_contact_phone,
      medical_conditions
    `)
    .eq("id", studentId)
    .single();
  
  if (studentError) {
    console.error("[getStudentContext] Failed to fetch student:", studentError.message);
    return null;
  }
  
  // Fetch active clinic pass
  const { data: activePass } = await supabase
    .from("clinic_passes")
    .select("id,reason,status,issued_at,issued_by")
    .eq("student_id", studentId)
    .in("status", ["pending", "approved"])
    .order("issued_at", { ascending: false })
    .limit(1)
    .single();
  
  // Fetch today's tap status
  const today = new Date().toISOString().slice(0, 10);
  const { data: todayTap } = await supabase
    .from("tap_logs")
    .select("tap_type,timestamp,status")
    .eq("student_id", studentId)
    .gte("timestamp", `${today}T00:00:00`)
    .order("timestamp", { ascending: false })
    .limit(1)
    .single();
  
  return {
    ...student,
    activePass: activePass ?? null,
    todayTap: todayTap ?? null
  };
}

// ============================================
// OFFLINE QUEUE MANAGEMENT (IndexedDB)
// ============================================

const OFFLINE_DB_NAME = "educare-offline-queue";
const OFFLINE_DB_VERSION = 1;
const SCAN_STORE = "pending-scans";

let offlineDb = null;

/**
 * Initialize IndexedDB for offline queue
 */
async function initOfflineDB() {
  if (offlineDb) return offlineDb;
  
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);
    
    request.onerror = () => reject(new Error("Failed to open offline database"));
    
    request.onsuccess = () => {
      offlineDb = request.result;
      resolve(offlineDb);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(SCAN_STORE)) {
        const store = db.createObjectStore(SCAN_STORE, { keyPath: "id", autoIncrement: true });
        store.createIndex("type", "type", { unique: false });
        store.createIndex("timestamp", "timestamp", { unique: false });
      }
    };
  });
}

/**
 * Add a scan record to offline queue
 * 
 * @param {Object} scanRecord - Scan record to queue
 * @param {string} scanRecord.type - 'tap' or 'clinic'
 * @param {Object} scanRecord.data - Scan data
 * @param {string} scanRecord.timestamp - ISO timestamp
 */
export async function queueScanOffline(scanRecord) {
  console.log("[OfflineQueue] Queueing scan", scanRecord.type);
  
  await initOfflineDB();
  
  const record = {
    ...scanRecord,
    timestamp: scanRecord.timestamp || new Date().toISOString(),
    synced: false
  };
  
  return new Promise((resolve, reject) => {
    const transaction = offlineDb.transaction([SCAN_STORE], "readwrite");
    const store = transaction.objectStore(SCAN_STORE);
    const request = store.add(record);
    
    request.onsuccess = () => {
      console.log("[OfflineQueue] Scan queued successfully");
      resolve(request.result);
    };
    
    request.onerror = () => reject(new Error("Failed to queue scan"));
  });
}

/**
 * Get all pending scans from offline queue
 * 
 * @returns {Array} Pending scan records
 */
export async function getPendingScans() {
  await initOfflineDB();
  
  return new Promise((resolve, reject) => {
    const transaction = offlineDb.transaction([SCAN_STORE], "readonly");
    const store = transaction.objectStore(SCAN_STORE);
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(new Error("Failed to get pending scans"));
  });
}

/**
 * Remove a scan from offline queue after successful sync
 * 
 * @param {number} id - Record ID to remove
 */
export async function removeQueuedScan(id) {
  await initOfflineDB();
  
  return new Promise((resolve, reject) => {
    const transaction = offlineDb.transaction([SCAN_STORE], "readwrite");
    const store = transaction.objectStore(SCAN_STORE);
    const request = store.delete(id);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error("Failed to remove queued scan"));
  });
}

/**
 * Sync pending scans when online
 * Processes all queued scans and removes them from IndexedDB
 * 
 * @returns {Object} Sync results { successful, failed }
 */
export async function syncPendingScans() {
  console.log("[OfflineQueue] Starting sync of pending scans");
  
  const pending = await getPendingScans();
  const results = { successful: 0, failed: 0, errors: [] };
  
  for (const scan of pending) {
    try {
      if (scan.type === "tap") {
        await recordTap({
          gatekeeperId: scan.data.gatekeeperId,
          student: scan.data.student,
          tapType: scan.data.tapType
        });
      } else if (scan.type === "clinic") {
        await recordClinicArrival({
          clinicStaffId: scan.data.clinicStaffId,
          student: scan.data.student,
          notes: scan.data.notes
        });
      }
      
      await removeQueuedScan(scan.id);
      results.successful++;
      console.log("[OfflineQueue] Synced scan:", scan.id);
    } catch (error) {
      results.failed++;
      results.errors.push({ id: scan.id, error: error.message });
      console.error("[OfflineQueue] Failed to sync scan:", scan.id, error.message);
    }
  }
  
  console.log("[OfflineQueue] Sync complete", results);
  return results;
}

/**
 * Check if device is online
 * 
 * @returns {boolean} True if online
 */
export function isOnline() {
  return navigator.onLine;
}

/**
 * Listen for online/offline events and auto-sync
 */
export function setupOfflineSync(onSyncComplete) {
  window.addEventListener("online", async () => {
    console.log("[OfflineQueue] Device came online, syncing pending scans...");
    const results = await syncPendingScans();
    if (onSyncComplete) onSyncComplete(results);
  });
  
  window.addEventListener("offline", () => {
    console.log("[OfflineQueue] Device went offline");
  });
}

/**
 * Check if student has an existing pending clinic pass
 * @param {string} studentId - Student ID to check
 * @returns {Promise<boolean>} True if pending pass exists
 */
export async function hasPendingClinicPass(studentId) {
  const { data, error } = await supabase
    .from("clinic_passes")
    .select("id")
    .eq("student_id", studentId)
    .eq("status", "pending")
    .limit(1);
  
  if (error) throw error;
  return data && data.length > 0;
}

/**
 * Check if student has an active clinic visit
 * @param {string} studentId - Student ID to check
 * @returns {Promise<boolean>} True if active visit exists
 */
export async function hasActiveClinicVisit(studentId) {
  const { data, error } = await supabase
    .from("clinic_visits")
    .select("id")
    .eq("student_id", studentId)
    .in("status", ["in_clinic", "being_treated"])
    .limit(1);
  
  if (error) throw error;
  return data && data.length > 0;
}
