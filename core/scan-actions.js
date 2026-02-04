import { supabase } from "./core.js";

function startOfDayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
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

export async function lookupStudentByQr(qrCode) {
  const qr = String(qrCode ?? "").trim();
  if (!qr) return null;

  const { data, error } = await supabase
    .from("student_ids")
    .select("student_id,students(id,full_name,grade_level,strand,class_id,parent_id,current_status)")
    .eq("qr_code", qr)
    .eq("is_active", true)
    .single();

  if (error) throw error;
  return data?.students ?? null;
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

export async function notify({ recipientId, actorId, verb, object }) {
  if (!recipientId) return;
  const { error } = await supabase.from("notifications").insert({
    recipient_id: recipientId,
    actor_id: actorId,
    verb,
    object: object ?? {},
    read: false,
  });
  if (error) throw error;
}

export async function recordTap({ gatekeeperId, student, tapType, duplicateWindowMs = 15000 }) {
  if (!student?.id) throw new Error("Student not found.");
  const type = String(tapType ?? "").toLowerCase();
  if (type !== "in" && type !== "out") throw new Error("Invalid tap type.");

  const latest = await loadLatestTapToday(student.id);
  if (latest?.tap_type && latest?.timestamp) {
    const sameType = String(latest.tap_type).toLowerCase() === type;
    const dt = Date.now() - new Date(latest.timestamp).getTime();
    if (sameType && dt >= 0 && dt < duplicateWindowMs) {
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

  if (type === "in") {
    const rule = await loadAttendanceRule(student.grade_level);
    const arrival = computeArrivalStatus(rule);
    await upsertHomeroomTapIn({ student, status: arrival });
    await updateStudentCurrentStatus({ studentId: student.id, status: "in" });
    await insertTapLog({ studentId: student.id, gatekeeperId, tapType: "in", status: "ok", remarks: arrival });
    await notify({
      recipientId: student.parent_id,
      actorId: gatekeeperId,
      verb: "tap_in",
      object: { student_id: student.id, timestamp: new Date().toISOString(), arrival },
    });
    return { result: "ok", arrival };
  }

  await setHomeroomTapOut({ student });
  await updateStudentCurrentStatus({ studentId: student.id, status: "out" });
  await insertTapLog({ studentId: student.id, gatekeeperId, tapType: "out", status: "ok" });
  await notify({
    recipientId: student.parent_id,
    actorId: gatekeeperId,
    verb: "tap_out",
    object: { student_id: student.id, timestamp: new Date().toISOString() },
  });
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
  if (!student?.id) throw new Error("Student not found.");

  const pass = await loadLatestPass(student.id);
  let visitId = pass?.clinic_visit_id ?? null;

  if (visitId) {
    await updateClinicVisit(visitId, { status: "in_clinic", notes: notes?.trim() || null, treated_by: clinicStaffId });
  } else {
    visitId = await createClinicVisit({ clinicId: clinicStaffId, studentId: student.id, reason: pass?.reason ?? null, notes });
  }

  if (pass?.id) {
    const nextStatus = pass.status === "pending" ? "approved" : pass.status;
    await updateClinicPass(pass.id, { status: nextStatus, clinic_visit_id: visitId });
  }

  if (pass?.issued_by) {
    await notify({
      recipientId: pass.issued_by,
      actorId: clinicStaffId,
      verb: "clinic_arrived",
      object: { student_id: student.id, pass_id: pass?.id ?? null, clinic_visit_id: visitId, timestamp: new Date().toISOString() },
    });
  }

  await notify({
    recipientId: student.parent_id,
    actorId: clinicStaffId,
    verb: "clinic_arrived",
    object: { student_id: student.id, pass_id: pass?.id ?? null, clinic_visit_id: visitId, timestamp: new Date().toISOString() },
  });

  return { result: "ok", pass, clinicVisitId: visitId };
}
