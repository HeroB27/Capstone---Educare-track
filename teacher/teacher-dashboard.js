// Educare Track Teacher Dashboard - Phase 7 Enhanced Version
import { supabase } from "../core/core.js";
import { checkbox, el, escapeHtml, isoDate, openModal, selectInput, textArea, textInput, button, showToast, showError, showSuccess, loadingOverlay, statusBadge as uiStatusBadge } from "../core/ui.js";
import { initAppShell, updateNetworkStatusIndicator } from "../core/shell.js";
import { initTeacherPage } from "./teacher-common.js";
import { registerPwa } from "../core/pwa.js";
import { hasPendingClinicPass, hasActiveClinicVisit } from "../core/scan-actions.js";

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

// Data loading functions - RLS-safe version using RPC
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
  // Use RPC call to get students - bypasses RLS issues
  // Pass classIds to filter results
  const { data, error } = await supabase.rpc('get_teacher_students_by_class', { 
    p_class_ids: classIds 
  });
  if (error) {
    // Fallback: if RPC doesn't exist, use direct query with RLS
    if (!classIds.length) return [];
    const { data: fallbackData, fallbackError } = await supabase
      .from("students")
      .select("id,full_name,grade_level,strand,class_id,parent_id,current_status")
      .in("class_id", classIds)
      .order("full_name", { ascending: true });
    if (fallbackError) throw fallbackError;
    return fallbackData ?? [];
  }
  return data ?? [];
}

async function loadTodayHomeroomAttendance(studentIds, dateStr) {
  // Use RPC call to get attendance - bypasses RLS issues
  const { data, error } = await supabase.rpc('get_teacher_today_attendance', { p_date: dateStr });
  if (error) {
    // Fallback: if RPC doesn't exist, use direct query
    if (!studentIds.length) return [];
    const { data: fallbackData, fallbackError } = await supabase
      .from("homeroom_attendance")
      .select("id,student_id,class_id,date,tap_in_time,tap_out_time,status,remarks")
      .eq("date", dateStr)
      .in("student_id", studentIds);
    if (fallbackError) throw fallbackError;
    return fallbackData ?? [];
  }
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
  // Check for existing pending pass (both in database and optimistic updates)
  const hasPendingPass = await hasPendingClinicPass(studentId);
  const optimisticClinic = getOptimisticUpdate(studentId, "clinic_pass");
  if (hasPendingPass || (optimisticClinic && optimisticClinic.status === "pending")) {
    throw new Error("Student already has a pending clinic pass");
  }
  
  // Check for active clinic visit
  const hasActiveVisit = await hasActiveClinicVisit(studentId);
  if (hasActiveVisit) {
    throw new Error("Student has an active clinic visit");
  }
  
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
      { value: "absent", label: "Absent" },
      { value: "excused", label: "Excused" },
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

// Analytics calculation for dashboard widgets
function calculateAnalytics({ students, attendanceRows, schedules, dateStr }) {
  const analytics = {
    totalStudents: students.length,
    presentCount: 0,
    lateCount: 0,
    classesToday: 0,
    absentCount: 0,
    excusedCount: 0
  };
  
  // Count attendance statuses from attendance rows
  for (const att of attendanceRows) {
    const status = String(att.status ?? '').toLowerCase();
    if (status === 'present') analytics.presentCount++;
    if (status === 'late') analytics.lateCount++;
    if (status === 'absent') analytics.absentCount++;
    if (status === 'excused') analytics.excusedCount++; // Maps from 'excused_absent'
  }
  
  // Calculate classes today based on day of week
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const today = days[new Date(dateStr).getDay()];
  analytics.classesToday = schedules.filter(s => 
    String(s.day_of_week ?? '').toLowerCase() === today
  ).length;
  
  return analytics;
}

// Update analytics DOM elements
function updateAnalyticsDisplay(analytics) {
  const elements = ['totalStudents', 'presentCount', 'lateCount', 'classesToday', 'absentCount'];
  elements.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      const value = analytics[id] ?? '—';
      el.textContent = value;
    }
  });
  
  // Update attendance percentages if needed
  updateAttendancePercentages(analytics);
}

// Calculate and update attendance percentages
function updateAttendancePercentages(analytics) {
  const total = analytics.totalStudents || 1;
  const presentPercent = Math.round((analytics.presentCount / total) * 100);
  const latePercent = Math.round((analytics.lateCount / total) * 100);
  const absentPercent = Math.round(((analytics.absentCount + analytics.excusedCount) / total) * 100);
  
  // Update percentage elements if they exist
  const presentPercentEl = document.getElementById('presentPercent');
  const latePercentEl = document.getElementById('latePercent');
  const absentPercentEl = document.getElementById('absentPercent');
  
  if (presentPercentEl) presentPercentEl.textContent = `${presentPercent}%`;
  if (latePercentEl) latePercentEl.textContent = `${latePercent}%`;
  if (absentPercentEl) absentPercentEl.textContent = `${absentPercent}%`;
}

/**
 * Calculate 7-day attendance trend for teacher's class
 * @param {string} teacherId - Teacher ID
 * @param {Array} classIds - Array of class IDs
 * @returns {Promise<Object>} 7-day attendance trend data
 */
async function calculate7DayAttendanceTrend(teacherId, classIds) {
  if (!classIds.length) return { labels: [], datasets: [] };
  
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const { data, error } = await supabase
    .from("homeroom_attendance")
    .select(`
      date,
      status,
      students (class_id)
    `)
    .in("students.class_id", classIds)
    .gte("date", sevenDaysAgo.toISOString().split('T')[0])
    .order("date", { ascending: true });
  
  if (error) throw error;
  
  // Group by date and calculate percentages
  const dateMap = new Map();
  const today = new Date().toISOString().split('T')[0];
  
  // Initialize last 7 days
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    dateMap.set(dateStr, { present: 0, total: 0 });
  }
  
  // Count attendance
  data?.forEach(record => {
    const dateStr = record.date;
    if (dateMap.has(dateStr)) {
      const stats = dateMap.get(dateStr);
      stats.total++;
      if (record.status === 'present' || record.status === 'late') {
        stats.present++;
      }
    }
  });
  
  // Prepare chart data
  const labels = Array.from(dateMap.keys()).map(date => 
    new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  );
  
  const attendanceRates = Array.from(dateMap.values()).map(stats => 
    stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0
  );
  
  return {
    labels,
    datasets: [{
      label: 'Attendance Rate (%)',
      data: attendanceRates,
      borderColor: 'rgb(59, 130, 246)',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      tension: 0.4,
      fill: true
    }]
  };
}

/**
 * Calculate subject-level analytics for teacher
 * @param {Array} schedules - Teacher's schedules
 * @param {Array} attendanceRows - Attendance data
 * @returns {Object} Subject analytics
 */
function calculateSubjectAnalytics(schedules, attendanceRows) {
  const subjectMap = new Map();
  
  // Initialize subjects
  schedules.forEach(schedule => {
    const subjectCode = schedule.subject_code;
    const subjectName = schedule.subjects?.name || subjectCode;
    if (!subjectMap.has(subjectCode)) {
      subjectMap.set(subjectCode, {
        name: subjectName,
        totalStudents: 0,
        presentCount: 0,
        attendanceRate: 0
      });
    }
  });
  
  // Count attendance by subject (simplified - assumes subject attendance correlates with homeroom)
  attendanceRows.forEach(attendance => {
    subjectMap.forEach((stats, subjectCode) => {
      stats.totalStudents++;
      if (attendance.status === 'present' || attendance.status === 'late') {
        stats.presentCount++;
      }
    });
  });
  
  // Calculate rates
  subjectMap.forEach(stats => {
    stats.attendanceRate = stats.totalStudents > 0 
      ? Math.round((stats.presentCount / stats.totalStudents) * 100) 
      : 0;
  });
  
  return Array.from(subjectMap.values()).sort((a, b) => b.attendanceRate - a.attendanceRate);
}

/**
 * Identify frequent late students
 * @param {Array} tapRows - Tap log data
 * @param {Array} students - Teacher's students
 * @returns {Array} Frequent late students
 */
function identifyFrequentLateStudents(tapRows, students) {
  const studentMap = new Map(students.map(s => [s.id, { ...s, lateCount: 0 }]));
  
  // Count late arrivals (tap_type = 'in' with late status)
  tapRows.forEach(tap => {
    if (tap.tap_type === 'in' && tap.status === 'late') {
      const student = studentMap.get(tap.student_id);
      if (student) {
        student.lateCount++;
      }
    }
  });
  
  return Array.from(studentMap.values())
    .filter(student => student.lateCount > 0)
    .sort((a, b) => b.lateCount - a.lateCount)
    .slice(0, 5); // Top 5 frequent late students
}

/**
 * Render advanced analytics sections for teacher dashboard
 */
async function renderAdvancedAnalytics({ teacherId, classIds, students, schedules, attendanceRows, tapRows, dateStr }) {
  const analyticsContainer = document.getElementById('advancedAnalytics');
  if (!analyticsContainer) return;
  
  analyticsContainer.innerHTML = '';
  
  try {
    // 7-Day Attendance Trend
    const trendData = await calculate7DayAttendanceTrend(teacherId, classIds);
    if (trendData.labels.length > 0) {
      const trendSection = createTrendChartSection(trendData);
      analyticsContainer.appendChild(trendSection);
    }
    
    // Subject Analytics
    const subjectAnalytics = calculateSubjectAnalytics(schedules, attendanceRows);
    if (subjectAnalytics.length > 0) {
      const subjectSection = createSubjectAnalyticsSection(subjectAnalytics);
      analyticsContainer.appendChild(subjectSection);
    }
    
    // Frequent Late Students
    const lateStudents = identifyFrequentLateStudents(tapRows, students);
    if (lateStudents.length > 0) {
      const lateStudentsSection = createLateStudentsSection(lateStudents);
      analyticsContainer.appendChild(lateStudentsSection);
    }
    
  } catch (error) {
    console.error("Failed to render advanced analytics:", error);
    analyticsContainer.innerHTML = `
      <div class="rounded-2xl bg-white p-6 border border-slate-200">
        <p class="text-slate-500 text-center">Analytics data temporarily unavailable</p>
      </div>
    `;
  }
}

/**
 * Create 7-day attendance trend chart section
 */
function createTrendChartSection(trendData) {
  const section = document.createElement('div');
  section.className = 'rounded-2xl bg-white p-6 border border-slate-200 mb-6';
  section.innerHTML = `
    <div class="flex items-center gap-3 mb-4">
      <div class="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
        <svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
        </svg>
      </div>
      <h3 class="text-lg font-semibold text-slate-900">7-Day Attendance Trend</h3>
    </div>
    <div class="chart-container" style="position: relative; height: 250px;">
      <canvas id="attendanceTrendChart"></canvas>
    </div>
  `;
  
  // Render chart after DOM insertion
  setTimeout(() => {
    const ctx = section.querySelector('#attendanceTrendChart')?.getContext('2d');
    if (ctx && window.Chart) {
      new Chart(ctx, {
        type: 'line',
        data: trendData,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              mode: 'index',
              intersect: false,
              callbacks: {
                label: (context) => `${context.dataset.label}: ${context.parsed.y}%`
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              max: 100,
              ticks: { callback: (value) => `${value}%` }
            }
          }
        }
      });
    }
  }, 100);
  
  return section;
}

/**
 * Create subject analytics section
 */
function createSubjectAnalyticsSection(subjectAnalytics) {
  const section = document.createElement('div');
  section.className = 'rounded-2xl bg-white p-6 border border-slate-200 mb-6';
  
  let subjectHTML = '';
  subjectAnalytics.forEach(subject => {
    subjectHTML += `
      <div class="flex items-center justify-between py-3 border-b border-slate-100 last:border-b-0">
        <span class="text-sm font-medium text-slate-700">${escapeHtml(subject.name)}</span>
        <span class="text-sm font-semibold ${
          subject.attendanceRate >= 90 ? 'text-emerald-600' :
          subject.attendanceRate >= 80 ? 'text-amber-600' : 'text-red-600'
        }">${subject.attendanceRate}%</span>
      </div>
    `;
  });
  
  section.innerHTML = `
    <div class="flex items-center gap-3 mb-4">
      <div class="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
        <svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
        </svg>
      </div>
      <h3 class="text-lg font-semibold text-slate-900">Subject Attendance Rates</h3>
    </div>
    <div class="space-y-2">
      ${subjectHTML}
    </div>
  `;
  
  return section;
}

/**
 * Create frequent late students section
 */
function createLateStudentsSection(lateStudents) {
  const section = document.createElement('div');
  section.className = 'rounded-2xl bg-white p-6 border border-slate-200 mb-6';
  
  let studentsHTML = '';
  lateStudents.forEach(student => {
    studentsHTML += `
      <div class="flex items-center justify-between py-3 border-b border-slate-100 last:border-b-0">
        <span class="text-sm font-medium text-slate-700">${escapeHtml(student.full_name)}</span>
        <span class="text-sm font-semibold text-amber-600">${student.lateCount} late arrival(s)</span>
      </div>
    `;
  });
  
  section.innerHTML = `
    <div class="flex items-center gap-3 mb-4">
      <div class="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
        <svg class="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
      </div>
      <h3 class="text-lg font-semibold text-slate-900">Frequent Late Arrivals</h3>
    </div>
    <div class="space-y-2">
      ${studentsHTML}
    </div>
  `;
  
  return section;
}

function renderDashboard({ teacherId, homeroomClasses, schedules, students, attendanceRows, tapRows, clinicPasses, unreadCount, dateStr }) {
  
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
      dateStr,
    });

    teacherStatus.textContent = `Loaded ${students.length} student(s). Ready.`;

    // Calculate and update analytics
    const analytics = calculateAnalytics({ students, attendanceRows, schedules, dateStr });
    updateAnalyticsDisplay(analytics);
    
    // Calculate and render advanced analytics
    await renderAdvancedAnalytics({
      teacherId,
      classIds,
      students,
      schedules,
      attendanceRows,
      tapRows,
      dateStr
    });
    
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
