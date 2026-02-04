import { supabase } from "./core.js";
import { getNoClassesEvent } from "./school-calendar.js";

function startOfDayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * Parse QR Code in format EDU-YYYY-LLLL-XXXX
 * EDU: Fixed prefix identifying Educare Track system
 * YYYY: 4-digit year (e.g., 2025)
 * LLLL: 4-character location/class code (e.g., GATE, CLIN, 7A, 8B)
 * XXXX: 4-digit student unique identifier
 * 
 * @param {string} qrCode - The QR code string to parse
 * @returns {Object} { valid: boolean, studentId: string, year: string, location: string, error?: string }
 */
export function parseStudentID(qrCode) {
  const qr = String(qrCode ?? "").trim().toUpperCase();
  
  if (!qr) {
    return { valid: false, studentId: null, year: null, location: null, error: "QR code is empty" };
  }
  
  // Validate prefix
  if (!qr.startsWith("EDU-")) {
    return { valid: false, studentId: null, year: null, location: null, error: "Invalid QR format: must start with 'EDU-'" };
  }
  
  // Parse components
  const parts = qr.split("-");
  if (parts.length !== 4) {
    return { valid: false, studentId: null, year: null, location: null, error: "Invalid QR format: expected EDU-YYYY-LLLL-XXXX" };
  }
  
  const [, year, location, studentId] = parts;
  
  // Validate year (must be within ±1 of current year)
  const currentYear = new Date().getFullYear();
  const yearNum = parseInt(year, 10);
  if (isNaN(yearNum) || yearNum < currentYear - 1 || yearNum > currentYear + 1) {
    return { valid: false, studentId: null, year: null, location: null, error: `Invalid year in QR code: ${year}` };
  }
  
  // Validate location code (2-6 characters, alphanumeric)
  if (!location || location.length < 2 || location.length > 6 || !/^[A-Z0-9]+$/.test(location)) {
    return { valid: false, studentId: null, year: null, location: null, error: `Invalid location code: ${location}` };
  }
  
  // Validate student ID (4 digits, leading zeros allowed)
  if (!studentId || studentId.length !== 4 || !/^[0-9]{4}$/.test(studentId)) {
    return { valid: false, studentId: null, year: null, location: null, error: `Invalid student ID: ${studentId}` };
  }
  
  return {
    valid: true,
    studentId: studentId,
    year: year,
    location: location,
    error: null
  };
}

/**
 * Enhanced student lookup that handles parsed QR codes
 * Supports both legacy QR format and new EDU-YYYY-LLLL-XXXX format
 * 
 * @param {string} qrCode - The QR code string to lookup
 * @returns {Object|null} Student data or null if not found
 */
export async function lookupStudentByQr(qrCode) {
  const qr = String(qrCode ?? "").trim();
  if (!qr) return null;
  
  // Try parsing as new format first
  const parsed = parseStudentID(qr);
  
  if (parsed.valid) {
    // Query by student_id format: EDU-YYYY-XXXX (without location)
    const formattedStudentId = `EDU-${parsed.year}-${parsed.studentId}`;
    
    const { data, error } = await supabase
      .from("student_ids")
      .select("student_id,students(id,full_name,grade_level,strand,class_id,parent_id,current_status)")
      .eq("student_id", formattedStudentId)
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
    
    // Fallback: try direct QR lookup if parsed lookup fails
    console.log("[QR] Parsed lookup failed, trying direct QR lookup");
  }
  
  // Fallback to direct QR code lookup (legacy format)
  const { data, error } = await supabase
    .from("student_ids")
    .select("student_id,students(id,full_name,grade_level,strand,class_id,parent_id,current_status)")
    .eq("qr_code", qr)
    .eq("is_active", true)
    .single();
  
  if (error) {
    console.log("[QR] Student lookup failed:", error.message);
    return null;
  }
  
  console.log("[QR] Student found via direct lookup:", {
    qr,
    studentId: data?.student_id,
    studentName: data?.students?.full_name
  });
  
  return data?.students ?? null;
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
    .in("key", ["school_start_time", "late_threshold_minutes"]);
  if (error) return null;
  const byKey = new Map((data ?? []).map((r) => [r.key, extractSettingValue(r)]));
  const schoolStartTime = byKey.get("school_start_time") ?? null;
  const lateThresholdMinutesRaw = byKey.get("late_threshold_minutes") ?? null;
  const lateThresholdMinutes = Number(lateThresholdMinutesRaw);
  return {
    schoolStartTime: schoolStartTime ? String(schoolStartTime) : null,
    lateThresholdMinutes: Number.isFinite(lateThresholdMinutes) ? lateThresholdMinutes : null,
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

async function upsertHomeroomTapIn({ student, status }) {
  const dateStr = new Date().toISOString().slice(0, 10);
  const { error } = await supabase.from("homeroom_attendance").upsert(
    {
      student_id: student.id,
      class_id: student.class_id,
      date: dateStr,
      tap_in_time: new Date().toISOString(),
      status,
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
    status: "partial",
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
 */
export async function recordTap({ gatekeeperId, student, tapType, duplicateWindowMs = 15000 }) {
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
    const settings = await loadAttendanceSettings();
    const bySettings = computeArrivalStatusFromSettings(settings);
    const arrival = bySettings ?? computeArrivalStatus(await loadAttendanceRule(student.grade_level));
    
    console.log("[RecordTap] Recording tap-in", {
      studentId: student.id,
      studentName: student.full_name,
      arrivalStatus: arrival,
      timestamp: new Date().toISOString()
    });
    
    await upsertHomeroomTapIn({ student, status: arrival });
    await updateStudentCurrentStatus({ studentId: student.id, status: "in" });
    await insertTapLog({ studentId: student.id, gatekeeperId, tapType: "in", status: "ok", remarks: arrival });
    
    // Use standardized notification verb based on arrival status
    const verb = arrival === "late" ? NOTIFICATION_VERBS.TAP_IN_LATE : NOTIFICATION_VERBS.TAP_IN;
    await notify({
      recipientId: student.parent_id,
      actorId: gatekeeperId,
      verb: verb,
      object: { student_id: student.id, timestamp: new Date().toISOString(), arrival },
    });
    
    console.log("[RecordTap] Tap-in recorded successfully");
    return { result: "ok", arrival };
  }

  console.log("[RecordTap] Recording tap-out", {
    studentId: student.id,
    studentName: student.full_name,
    timestamp: new Date().toISOString()
  });
  
  await setHomeroomTapOut({ student });
  await updateStudentCurrentStatus({ studentId: student.id, status: "out" });
  await insertTapLog({ studentId: student.id, gatekeeperId, tapType: "out", status: "ok" });
  
  await notify({
    recipientId: student.parent_id,
    actorId: gatekeeperId,
    verb: NOTIFICATION_VERBS.TAP_OUT,
    object: { student_id: student.id, timestamp: new Date().toISOString() },
  });
  
  console.log("[RecordTap] Tap-out recorded successfully");
  return { result: "ok" };
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

export async function createClinicVisit({ clinicId, studentId, reason, notes }) {
  const { data, error } = await supabase
    .from("clinic_visits")
    .insert({
      student_id: studentId,
      reason: reason || null,
      treated_by: clinicId,
      notes: notes || null,
      status: "in_clinic",
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
    const settings = await loadAttendanceSettings();
    arrivalStatus = computeArrivalStatusFromSettings(settings) ?? "on_time";
    
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
