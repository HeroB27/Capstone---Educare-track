// Educare Track Teacher Dashboard - Phase 7 Enhanced Version
import { supabase } from "../core/core.js";
import { checkbox, el, escapeHtml, isoDate, openModal, selectInput, textArea, textInput, button, showToast, showError, showSuccess, loadingOverlay, statusBadge as uiStatusBadge } from "../core/ui.js";
import { initAppShell, updateNetworkStatusIndicator } from "../core/shell.js";
import { initTeacherPage } from "./teacher-common.js";
import { registerPwa } from "../core/pwa.js";

initAppShell({ role: "teacher", active: "dashboard" });

const teacherStatus = document.getElementById("teacherStatus");
const teacherApp = document.getElementById("teacherApp");

// State management
let currentProfile = null;
let subscriptions = [];
let isRefreshing = false;
let pendingRefresh = false;
let lastRefreshTime = 0;
let optimisticUpdates = new Map();

// Utility functions
function uniq(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function toClassLabel(c) {
  return `${c.grade_level}${c.strand ? ` • ${c.strand}` : ""}${c.room ? ` • ${c.room}` : ""}`;
}

// Status badge helper
function statusBadgeClass(status) {
  const s = String(status ?? "").toLowerCase();
  if (s === "unmarked") return "bg-slate-100 text-slate-700";
  if (s === "present") return "bg-green-100 text-green-700";
  if (s === "late") return "bg-yellow-100 text-yellow-800";
  if (s === "partial") return "bg-amber-100 text-amber-800";
  if (s === "excused_absent") return "bg-slate-200 text-slate-700";
  return "bg-red-100 text-red-700";
}

function statusBadge(status) {
  return statusBadgeClass(status);
}

function inOutBadgeClass(value) {
  const s = String(value ?? "").toLowerCase();
  if (s === "in") return "bg-blue-100 text-blue-700";
  return "bg-slate-100 text-slate-700";
}

function inOutBadge(value) {
  return inOutBadgeClass(value);
}

// Data loading functions
async function loadHomeroomClasses(profileId) {
  const { data, error } = await supabase
    .from("classes")
    .select("id,grade_level,strand,room,homeroom_teacher_id")
    .eq("homeroom_teacher_id", profileId)
    .eq("is_active", true)
    .order("grade_level", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function loadSchedules(profileId) {
  const { data, error } = await supabase
    .from("class_schedules")
    .select("id,class_id,subject_code,day_of_week,start_time,end_time,classes(id,grade_level,strand,room),subjects(code,name)")
    .eq("teacher_id", profileId)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function loadStudentsByClassIds(classIds) {
  if (!classIds.length) return [];
  const { data, error } = await supabase
    .from("students")
    .select("id,full_name,grade_level,strand,class_id,parent_id,current_status")
    .in("class_id", classIds)
    .order("full_name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function loadTodayHomeroomAttendance(studentIds, dateStr) {
  if (!studentIds.length) return [];
  const { data, error } = await supabase
    .from("homeroom_attendance")
    .select("id,student_id,class_id,date,tap_in_time,tap_out_time,status,remarks")
    .eq("date", dateStr)
    .in("student_id", studentIds);
  if (error) throw error;
  return data ?? [];
}

async function loadRecentTapLogs(studentIds, limit = 250) {
  if (!studentIds.length) return [];
  const { data, error } = await supabase
    .from("tap_logs")
    .select("id,student_id,tap_type,timestamp,status,remarks")
    .in("student_id", studentIds)
    .order("timestamp", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

async function loadUnreadNotificationsCount(profileId) {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", profileId)
    .eq("read", false);
  if (error) throw error;
  return count ?? 0;
}

async function loadClinicPasses(studentIds, limit = 20) {
  if (!studentIds.length) return [];
  const { data, error } = await supabase
    .from("clinic_passes")
    .select("id,student_id,clinic_visit_id,issued_by,reason,status,issued_at")
    .in("student_id", studentIds)
    .order("issued_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

async function hasActiveClinicVisit(studentId) {
  const { data, error } = await supabase
    .from("clinic_visits")
    .select("id")
    .eq("student_id", studentId)
    .eq("status", "in_clinic")
    .limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

async function hasApprovedExcuse({ studentId, dateStr }) {
  const { data, error } = await supabase
    .from("excuse_letters")
    .select("id")
    .eq("student_id", studentId)
    .eq("absent_date", dateStr)
    .eq("status", "approved")
    .limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

// Optimistic update helpers
function applyOptimisticUpdate(studentId, updateType, newValue) {
  const key = `${studentId}-${updateType}`;
  optimisticUpdates.set(key, { value: newValue, timestamp: Date.now() });
}

function getOptimisticUpdate(studentId, updateType) {
  const key = `${studentId}-${updateType}`;
  const update = optimisticUpdates.get(key);
  if (update && Date.now() - update.timestamp < 30000) {
    return update.value;
  }
  optimisticUpdates.delete(key);
  return null;
}

function clearOptimisticUpdate(studentId, updateType) {
  const key = `${studentId}-${updateType}`;
  optimisticUpdates.delete(key);
}

// Action functions with optimistic updates
async function issueClinicPass({ teacherId, studentId, reason }) {
  // Apply optimistic update
  applyOptimisticUpdate(studentId, "clinic_pass", { status: "pending", reason });
  
  const { error } = await supabase.from("clinic_passes").insert({
    student_id: studentId,
    issued_by: teacherId,
    reason: reason || null,
    status: "pending",
  });
  
  if (error) {
    clearOptimisticUpdate(studentId, "clinic_pass");
    throw error;
  }
}

async function upsertHomeroomOverride({ student, dateStr, status, remarks }) {
  const payload = {
    student_id: student.id,
    class_id: student.class_id,
    date: dateStr,
    status,
    remarks: remarks || null,
  };
  
  // Apply optimistic update
  applyOptimisticUpdate(student.id, "attendance", { status, date: dateStr });
  
  const { error } = await supabase.from("homeroom_attendance").upsert(payload, { onConflict: "student_id,date" });
  
  if (error) {
    clearOptimisticUpdate(student.id, "attendance");
    throw error;
  }
}

async function upsertSubjectOverride({ student, dateStr, subjectCode, status, remarks }) {
  const payload = {
    student_id: student.id,
    subject_code: subjectCode,
    date: dateStr,
    status,
    remarks: remarks || null,
  };
  
  // Apply optimistic update
  applyOptimisticUpdate(student.id, "subject_attendance", { status, subjectCode, date: dateStr });
  
  const { error } = await supabase
    .from("subject_attendance")
    .upsert(payload, { onConflict: "student_id,subject_code,date" });
  
  if (error) {
    clearOptimisticUpdate(student.id, "subject_attendance");
    throw error;
  }
}

async function notifyParent({ teacherId, parentId, studentId, verb, object }) {
  if (!parentId) return;
  const { error } = await supabase.from("notifications").insert({
    recipient_id: parentId,
    actor_id: teacherId,
    verb,
    object: { student_id: studentId, ...object },
    read: false,
  });
  if (error) throw error;
}

// Modal functions
function openManualOverrideModal({ teacherId, students, subjects, onSaved }) {
  const content = el("div", "");
  content.appendChild(el("div", "text-lg font-semibold text-slate-900", "Manual Attendance Override"));

  const form = el("form", "mt-4 grid gap-4 md:grid-cols-2");
  const date = textInput({ type: "date", value: isoDate() });
  const studentSel = selectInput(
    [{ value: "", label: "Select student…" }].concat(students.map((s) => ({ value: s.id, label: s.full_name }))),
    ""
  );
  const kindSel = selectInput(
    [
      { value: "homeroom", label: "Homeroom attendance" },
      { value: "subject", label: "Subject attendance" },
    ],
    "homeroom"
  );
  const subjectSel = selectInput([{ value: "", label: "Select subject…" }].concat(subjects), "");
  const statusSel = selectInput(
    [
      { value: "present", label: "Present" },
      { value: "late", label: "Late" },
      { value: "partial", label: "Partial" },
      { value: "absent", label: "Absent" },
      { value: "excused_absent", label: "Excused absent" },
    ],
    "present"
  );
  const remarks = textArea({ placeholder: "Remarks (optional)", rows: 3 });

  const announce = checkbox("Notify parent", true, "text-blue-600 focus:ring-blue-500");

  const row = (label, inputEl, span2 = false) => {
    const w = el("div", span2 ? "space-y-1 md:col-span-2" : "space-y-1");
    w.appendChild(el("label", "block text-sm font-medium text-slate-700", escapeHtml(label)));
    w.appendChild(inputEl);
    return w;
  };

  form.appendChild(row("Date", date));
  form.appendChild(row("Student", studentSel));
  form.appendChild(row("Type", kindSel));
  const subjectWrap = row("Subject", subjectSel);
  form.appendChild(subjectWrap);
  form.appendChild(row("Status", statusSel));
  form.appendChild(row("Remarks", remarks, true));

  const notice = el("div", "md:col-span-2 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200");
  notice.appendChild(el("div", "text-sm font-semibold text-slate-900", "Notification"));
  notice.appendChild(el("div", "mt-1 text-sm text-slate-600", "Optional: notify the parent after saving the override."));
  const line = el("div", "mt-3");
  line.appendChild(announce.wrap);
  notice.appendChild(line);
  form.appendChild(notice);

  function syncSubjectEnabled() {
    const enabled = kindSel.value === "subject";
    subjectSel.disabled = !enabled;
    subjectWrap.className = enabled ? "space-y-1" : "space-y-1 opacity-50 pointer-events-none";
  }
  kindSel.addEventListener("change", syncSubjectEnabled);
  syncSubjectEnabled();

  const errorBox = el("div", "mt-3 hidden rounded-xl bg-red-50 p-3 text-sm text-red-700 md:col-span-2");
  const actions = el("div", "mt-5 flex justify-end gap-2 md:col-span-2");
  const cancelBtn = button("Cancel", "ghost");
  const saveBtn = button("Save override", "primary", "blue");
  saveBtn.type = "submit";
  cancelBtn.addEventListener("click", () => overlay.remove());
  actions.appendChild(cancelBtn);
  actions.appendChild(saveBtn);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorBox.classList.add("hidden");
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="flex items-center gap-2"><span class="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>Saving...</span>';

    const student = students.find((s) => s.id === studentSel.value);
    if (!student) {
      errorBox.textContent = "Student is required.";
      errorBox.classList.remove("hidden");
      saveBtn.disabled = false;
      saveBtn.textContent = "Save override";
      return;
    }
    if (!date.value) {
      errorBox.textContent = "Date is required.";
      errorBox.classList.remove("hidden");
      saveBtn.disabled = false;
      saveBtn.textContent = "Save override";
      return;
    }

    try {
      if (await hasApprovedExcuse({ studentId: student.id, dateStr: date.value })) {
        errorBox.textContent = "Excuse letter is approved for this date. Attendance status is locked as Excused.";
        errorBox.classList.remove("hidden");
        saveBtn.disabled = false;
        saveBtn.textContent = "Save override";
        return;
      }
      
      if (kindSel.value === "homeroom") {
        await upsertHomeroomOverride({ student, dateStr: date.value, status: statusSel.value, remarks: remarks.value.trim() });
        showSuccess("Attendance override saved");
        if (announce.input.checked) {
          await notifyParent({
            teacherId,
            parentId: student.parent_id,
            studentId: student.id,
            verb: "homeroom_override",
            object: { date: date.value, status: statusSel.value },
          });
        }
      } else {
        if (!subjectSel.value) {
          errorBox.textContent = "Subject is required for subject attendance.";
          errorBox.classList.remove("hidden");
          saveBtn.disabled = false;
          saveBtn.textContent = "Save override";
          return;
        }
        if (await hasActiveClinicVisit(student.id)) {
          errorBox.textContent = "Student is currently in clinic. Subject attendance is locked.";
          errorBox.classList.remove("hidden");
          saveBtn.disabled = false;
          saveBtn.textContent = "Save override";
          return;
        }
        await upsertSubjectOverride({
          student,
          dateStr: date.value,
          subjectCode: subjectSel.value,
          status: statusSel.value,
          remarks: remarks.value.trim(),
        });
        showSuccess("Subject attendance override saved");
        if (announce.input.checked) {
          await notifyParent({
            teacherId,
            parentId: student.parent_id,
            studentId: student.id,
            verb: "subject_override",
            object: { date: date.value, subject_code: subjectSel.value, status: statusSel.value },
          });
        }
      }

      overlay.remove();
      await onSaved();
    } catch (err) {
      showError(err?.message || "Failed to save override");
      errorBox.textContent = err?.message ?? "Failed to save override.";
      errorBox.classList.remove("hidden");
      saveBtn.disabled = false;
      saveBtn.textContent = "Save override";
    }
  });

  content.appendChild(form);
  content.appendChild(errorBox);
  content.appendChild(actions);
  const overlay = openModal(content, { maxWidthClass: "max-w-3xl" });
}

function openClinicPassModal({ teacherId, students, onSaved }) {
  const content = el("div", "");
  content.appendChild(el("div", "text-lg font-semibold text-slate-900", "Issue clinic pass"));

  const form = el("form", "mt-4 space-y-4");
  const studentSel = selectInput(
    [{ value: "", label: "Select student…" }].concat(students.map((s) => ({ value: s.id, label: s.full_name }))),
    ""
  );
  const reason = textArea({ placeholder: "Reason (optional)", rows: 3 });

  const row = (label, inputEl) => {
    const w = el("div", "space-y-1");
    w.appendChild(el("label", "block text-sm font-medium text-slate-700", escapeHtml(label)));
    w.appendChild(inputEl);
    return w;
  };

  form.appendChild(row("Student", studentSel));
  form.appendChild(row("Reason", reason));

  const errorBox = el("div", "hidden rounded-xl bg-red-50 p-3 text-sm text-red-700");
  const actions = el("div", "flex justify-end gap-2");
  const cancelBtn = button("Cancel", "ghost");
  const saveBtn = button("Send to clinic", "primary", "blue");
  saveBtn.type = "submit";
  cancelBtn.addEventListener("click", () => overlay.remove());
  actions.appendChild(cancelBtn);
  actions.appendChild(saveBtn);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorBox.classList.add("hidden");
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="flex items-center gap-2"><span class="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>Sending...</span>';
    
    if (!studentSel.value) {
      errorBox.textContent = "Student is required.";
      errorBox.classList.remove("hidden");
      saveBtn.disabled = false;
      saveBtn.textContent = "Send to clinic";
      return;
    }
    try {
      await issueClinicPass({ teacherId, studentId: studentSel.value, reason: reason.value.trim() });
      showSuccess("Clinic pass issued successfully");
      overlay.remove();
      await onSaved();
    } catch (err) {
      showError(err?.message || "Failed to issue clinic pass");
      errorBox.textContent = err?.message ?? "Failed to issue clinic pass.";
      errorBox.classList.remove("hidden");
      saveBtn.disabled = false;
      saveBtn.textContent = "Send to clinic";
    }
  });

  content.appendChild(form);
  content.appendChild(errorBox);
  content.appendChild(actions);
  const overlay = openModal(content, { maxWidthClass: "max-w-2xl" });
}

// Render function
function buildLatestTapMap(rows) {
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.student_id)) map.set(r.student_id, r);
  }
  return map;
}

function renderDashboard({ teacherId, homeroomClasses, schedules, students, attendanceRows, tapRows, clinicPasses, unreadCount }) {
  teacherApp?.replaceChildren();

  const classIds = uniq(students.map((s) => s.class_id));
  const homeroomLabel = homeroomClasses.length ? homeroomClasses.map(toClassLabel).join(", ") : "Not assigned";
  const subjectCount = uniq(schedules.map((s) => s.subject_code)).length;
  const tapMap = buildLatestTapMap(tapRows);
  const attMap = new Map(attendanceRows.map((r) => [r.student_id, r]));

  // Summary cards
  const cards = el("div", "grid gap-4 md:grid-cols-4");
  const card = (label, value) => {
    const c = el("div", "rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200");
    c.appendChild(el("div", "text-xs font-semibold text-slate-600", escapeHtml(label)));
    c.appendChild(el("div", "mt-2 text-2xl font-semibold text-slate-900", escapeHtml(value)));
    return c;
  };
  cards.appendChild(card("Homeroom", homeroomLabel));
  cards.appendChild(card("Classes", String(classIds.length)));
  cards.appendChild(card("Subjects", String(subjectCount)));
  cards.appendChild(card("Unread notifications", String(unreadCount)));

  // Action buttons
  const actions = el("div", "mt-4 flex flex-wrap items-center justify-between gap-2");
  actions.appendChild(el("div", "text-sm text-slate-600", "Tip: use Manual Override to correct attendance for today or past dates."));
  const btns = el("div", "flex flex-wrap gap-2");
  const overrideBtn = button("Manual Override", "primary", "blue");
  overrideBtn.addEventListener("click", () => {
    const subjects = uniq(schedules.map((s) => s.subject_code)).map((code) => {
      const name = schedules.find((x) => x.subject_code === code)?.subjects?.name;
      return { value: code, label: name ? `${code} • ${name}` : code };
    });
    openManualOverrideModal({
      teacherId,
      students,
      subjects,
      onSaved: async () => {
        await refresh();
      },
    });
  });
  btns.appendChild(overrideBtn);

  const clinicBtn = button("Issue Clinic Pass", "secondary", "blue");
  clinicBtn.className = "rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50";
  clinicBtn.addEventListener("click", () => {
    openClinicPassModal({ teacherId, students, onSaved: async () => refresh() });
  });
  btns.appendChild(clinicBtn);
  actions.appendChild(btns);

  // Students table
  const tableWrap = el("div", "mt-4 overflow-x-auto rounded-2xl ring-1 ring-slate-200");
  const table = el("table", "min-w-full bg-white");
  table.innerHTML = `
    <thead class="bg-slate-50">
      <tr>
        <th class="px-4 py-3 text-left text-xs font-semibold text-slate-600">Student</th>
        <th class="px-4 py-3 text-left text-xs font-semibold text-slate-600">Attendance (today)</th>
        <th class="px-4 py-3 text-left text-xs font-semibold text-slate-600">In/Out</th>
        <th class="px-4 py-3 text-left text-xs font-semibold text-slate-600">Last tap</th>
      </tr>
    </thead>
    <tbody class="divide-y divide-slate-100"></tbody>
  `;
  const tbody = table.querySelector("tbody");

  for (const s of students) {
    // Check for optimistic updates
    const optimisticAttendance = getOptimisticUpdate(s.id, "attendance");
    const optimisticClinic = getOptimisticUpdate(s.id, "clinic_pass");
    
    const att = attMap.get(s.id);
    const tap = tapMap.get(s.id);
    
    // Use optimistic status if available
    const attStatus = (optimisticAttendance?.status) || (att?.status ?? "unmarked");
    
    const tr = document.createElement("tr");
    if (optimisticAttendance || optimisticClinic) {
      tr.classList.add("animate-pulse", "bg-blue-50");
    }
    
    tr.innerHTML = `
      <td class="px-4 py-3">
        <div class="text-sm font-semibold text-slate-900">${escapeHtml(s.full_name)}</div>
        <div class="mt-1 text-xs text-slate-600">${escapeHtml(s.grade_level)}${s.strand ? ` • ${escapeHtml(s.strand)}` : ""}</div>
      </td>
      <td class="px-4 py-3">
        <span class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadge(attStatus)}">${escapeHtml(attStatus)}</span>
      </td>
      <td class="px-4 py-3">
        <span class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${inOutBadge(s.current_status)}">${escapeHtml(s.current_status ?? "out")}</span>
      </td>
      <td class="px-4 py-3 text-sm text-slate-700">${tap?.timestamp ? escapeHtml(new Date(tap.timestamp).toLocaleString()) : "—"}</td>
    `;
    tbody.appendChild(tr);
  }

  tableWrap.appendChild(table);

  teacherApp.appendChild(cards);
  teacherApp.appendChild(actions);
  teacherApp.appendChild(tableWrap);

  // Clinic passes section
  const clinicBox = el("div", "mt-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200");
  clinicBox.appendChild(el("div", "text-sm font-semibold text-slate-900", "Clinic passes"));
  clinicBox.appendChild(
    el(
      "div",
      "mt-1 text-sm text-slate-600",
      clinicPasses.length ? `Recent: ${clinicPasses.length}` : "No clinic passes yet."
    )
  );
  if (clinicPasses.length) {
    const list = el("div", "mt-4 space-y-2");
    for (const p of clinicPasses) {
      const studentName = students.find((s) => s.id === p.student_id)?.full_name ?? "Student";
      const meta = `${p.status || "pending"} • ${p.issued_at ? new Date(p.issued_at).toLocaleString() : ""}`;
      const card = el("div", "rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200");
      card.innerHTML = `
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="text-sm font-semibold text-slate-900">${escapeHtml(studentName)}</div>
            <div class="mt-1 text-xs text-slate-600">${escapeHtml(meta)}</div>
          </div>
          <div class="text-xs text-slate-600">${escapeHtml(p.reason || "—")}</div>
        </div>
      `;
      list.appendChild(card);
    }
    clinicBox.appendChild(list);
  }
  teacherApp.appendChild(clinicBox);
}

// Subscription management
function cleanupSubscriptions() {
  for (const ch of subscriptions) {
    try {
      supabase.removeChannel(ch);
    } catch (e) {}
  }
  subscriptions = [];
}

// Debounced refresh with cooldown
function debouncedRefresh(delay = 500) {
  if (pendingRefresh) return;
  
  pendingRefresh = true;
  setTimeout(async () => {
    pendingRefresh = false;
    const now = Date.now();
    // Prevent rapid consecutive refreshes (less than 1 second apart)
    if (now - lastRefreshTime < 1000) return;
    lastRefreshTime = now;
    
    try {
      await refresh();
    } catch (e) {
      console.error("Refresh error:", e);
    }
  }, delay);
}

// Main refresh function with error handling
async function refresh() {
  if (!currentProfile) return;
  
  // Prevent concurrent refreshes
  if (isRefreshing) {
    pendingRefresh = true;
    return;
  }
  
  isRefreshing = true;
  
  try {
    if (teacherStatus) teacherStatus.textContent = "Loading…";

    const dateStr = isoDate();
    const [homeroomClasses, schedules] = await Promise.all([
      loadHomeroomClasses(currentProfile.id),
      loadSchedules(currentProfile.id),
    ]);
    const scheduleClassIds = schedules.map((s) => s.class_id);
    const homeroomClassIds = homeroomClasses.map((c) => c.id);
    const classIds = uniq([...scheduleClassIds, ...homeroomClassIds]);

    const students = await loadStudentsByClassIds(classIds);
    const studentIds = students.map((s) => s.id);

    const [attendanceRows, tapRows, clinicPasses, unreadCount] = await Promise.all([
      loadTodayHomeroomAttendance(studentIds, dateStr),
      loadRecentTapLogs(studentIds),
      loadClinicPasses(studentIds),
      loadUnreadNotificationsCount(currentProfile.id),
    ]);

    renderDashboard({
      teacherId: currentProfile.id,
      homeroomClasses,
      schedules,
      students,
      attendanceRows,
      tapRows,
      clinicPasses,
      unreadCount,
    });

    teacherStatus.textContent = `Loaded ${students.length} student(s). Ready.`;

    // Setup real-time subscriptions
    setupSubscriptions(studentIds);
    
  } catch (e) {
    console.error("Refresh error:", e);
    teacherStatus.textContent = `Error: ${e?.message || "Failed to load data"}`;
    showError("Failed to load dashboard data");
  } finally {
    isRefreshing = false;
    if (pendingRefresh) {
      pendingRefresh = false;
      // Small delay before triggering another refresh
      setTimeout(() => refresh(), 100);
    }
  }
}

// Real-time subscriptions setup
function setupSubscriptions(studentIds) {
  cleanupSubscriptions();

  // Notification channel
  const notifyChannel = supabase
    .channel(`teacher-notifications-${currentProfile.id}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "notifications", filter: `recipient_id=eq.${currentProfile.id}` },
      debouncedRefresh
    )
    .subscribe();
  subscriptions.push(notifyChannel);

  if (!studentIds.length) return;

  const idsFilter = `student_id=in.(${studentIds.join(",")})`;

  // Tap logs channel
  const tapChannel = supabase
    .channel(`teacher-taps-${currentProfile.id}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "tap_logs", filter: idsFilter }, debouncedRefresh)
    .subscribe();
  subscriptions.push(tapChannel);

  // Attendance channel
  const attChannel = supabase
    .channel(`teacher-homeroom-att-${currentProfile.id}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "homeroom_attendance", filter: idsFilter },
      debouncedRefresh
    )
    .subscribe();
  subscriptions.push(attChannel);

  // Clinic passes channel
  const clinicChannel = supabase
    .channel(`teacher-clinic-${currentProfile.id}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "clinic_passes", filter: idsFilter },
      debouncedRefresh
    )
    .subscribe();
  subscriptions.push(clinicChannel);
  
  // Students channel for status updates
  const studentChannel = supabase
    .channel(`teacher-students-${currentProfile.id}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "students", filter: idsFilter },
      debouncedRefresh
    )
    .subscribe();
  subscriptions.push(studentChannel);
}

// Initialize page
async function init() {
  // Initialize PWA
  registerPwa();

  // Initialize page
  const { profile, error } = await initTeacherPage();
  if (error) {
    if (teacherStatus) teacherStatus.textContent = `Error: ${error.message}`;
    return;
  }
  
  currentProfile = profile;

  try {
    await refresh();
  } catch (e) {
    if (teacherStatus) teacherStatus.textContent = e?.message ?? "Failed to load.";
    showError(e?.message || "Failed to load dashboard");
  }

  // Cleanup on page unload - use shell's cleanup
  window.addEventListener("beforeunload", () => {
    cleanupSubscriptions();
    if (window._shellCleanupFn) {
      window._shellCleanupFn();
    }
  });
}

// Start the app
init();
