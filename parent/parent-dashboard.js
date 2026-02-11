// Educare Track Parent Dashboard - Phase 7 Enhanced Version
import { supabase } from "../core/core.js";
import { button, el, escapeHtml, isoDate, selectInput, showToast, showSuccess, showError, statusBadge as uiStatusBadge } from "../core/ui.js";
import { initAppShell } from "../core/shell.js";
import { initParentPage } from "./parent-common.js";
import { registerPwa } from "../core/pwa.js";

initAppShell({ role: "parent", active: "dashboard" });

// DOM elements from static HTML
const parentStatus = document.getElementById("parentStatus");
const childInitial = document.getElementById("childInitial");
const childName = document.getElementById("childName");
const childGrade = document.getElementById("childGrade");
const todayStatus = document.getElementById("todayStatus");
const childSelector = document.getElementById("childSelector");
const presentDays = document.getElementById("presentDays");
const lateDays = document.getElementById("lateDays");
const absentDays = document.getElementById("absentDays");
const attendanceRate = document.getElementById("attendanceRate");
const presentStatus = document.getElementById("presentStatus");
const weekStatus = document.getElementById("weekStatus");
const pendingExcuse = document.getElementById("pendingExcuse");
const activityList = document.getElementById("activityList");

// New elements for enhanced features
const currentStatus = document.getElementById("currentStatus");
const lastTapTime = document.getElementById("lastTapTime");
const tapType = document.getElementById("tapType");
const homeroomTeacher = document.getElementById("homeroomTeacher");
const todaysSubject = document.getElementById("todaysSubject");
const classroom = document.getElementById("classroom");
const gradeLevel = document.getElementById("gradeLevel");
const strand = document.getElementById("strand");
const attendanceMonth = document.getElementById("attendanceMonth");
const exportAttendance = document.getElementById("exportAttendance");
const attendanceHistoryBody = document.getElementById("attendanceHistoryBody");
const clinicVisits = document.getElementById("clinicVisits");
const gateActivity = document.getElementById("gateActivity");

// State management
let currentProfile = null;
let subscriptions = [];
let isRefreshing = false;
let pendingRefresh = false;
let lastRefreshTime = 0;
let currentMonth = new Date();
let selectedChildId = null;

// Status helpers - only handle required statuses: present, late, absent, excused
function statusPill(status) {
  const s = String(status ?? "").toLowerCase();
  if (s === "present") return "status-indicator status-present";
  if (s === "late") return "status-indicator status-late";
  if (s === "absent") return "status-indicator status-absent";
  if (s === "excused") return "status-indicator status-excused";
  return "status-indicator status-neutral";
}

function inOutPill(value) {
  const s = String(value ?? "").toLowerCase();
  if (s === "in") return "status-indicator status-present";
  return "status-indicator status-neutral";
}

function monthKey(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

function firstDayOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function lastDayOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function iso(d) {
  return isoDate(d);
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function uniq(arr) {
  return [...new Set(arr)];
}

// Data loading functions
async function loadChildren(profileId) {
  const { data, error } = await supabase
    .from("students")
    .select("id,full_name,grade_level,strand,class_id,parent_id,current_status")
    .eq("parent_id", profileId)
    .order("full_name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function loadTapLogs(studentIds, limit = 250) {
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

async function loadNotifications(profileId, limit = 30) {
  const { data, error } = await supabase
    .from("notifications")
    .select("id,actor_id,verb,object,read,created_at")
    .eq("recipient_id", profileId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

async function markNotificationRead(id) {
  const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id);
  if (error) throw error;
}

async function loadMonthAttendance(studentId, monthDate) {
  const start = firstDayOfMonth(monthDate);
  const end = lastDayOfMonth(monthDate);
  const { data, error } = await supabase
    .from("homeroom_attendance")
    .select("id,student_id,date,status,remarks")
    .eq("student_id", studentId)
    .gte("date", iso(start))
    .lte("date", iso(end))
    .order("date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// Load total absences for absence warning system
async function loadTotalAbsences(studentId) {
  const { data, error } = await supabase
    .from("homeroom_attendance")
    .select("status")
    .eq("student_id", studentId)
    .in("status", ["absent", "excused"]);
  if (error) throw error;
  return data?.length ?? 0;
}

// Show absence warnings based on threshold
async function showAbsenceWarnings(totalAbsences, studentName) {
  // Remove any existing warnings
  const existingWarnings = document.querySelectorAll('.absence-warning');
  existingWarnings.forEach(warning => warning.remove());
  
  // Show warning for 10+ absences
  if (totalAbsences >= 10 && totalAbsences < 20) {
    showWarning(`⚠️  Warning: ${studentName} has ${totalAbsences} absences. Please monitor attendance.`);
  }
  
  // Show critical alert for 20+ absences
  if (totalAbsences >= 20) {
    showCriticalAlert(`🚨  Critical: ${studentName} has ${totalAbsences} absences! Please contact the school.`);
  }
}

// Show warning toast
function showWarning(message) {
  showToast(message, { 
    type: 'warning', 
    className: 'absence-warning',
    duration: 8000 
  });
}

// Show critical alert toast
function showCriticalAlert(message) {
  showToast(message, { 
    type: 'error', 
    className: 'absence-warning',
    duration: 12000 
  });
}

async function loadClassDetails(classId) {
  if (!classId) return null;
  const { data, error } = await supabase
    .from("classes")
    .select("id,name,homeroom_teacher_id,room")
    .eq("id", classId)
    .single();
  if (error) return null;
  return data;
}

async function loadTeacherDetails(teacherId) {
  if (!teacherId) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id,full_name")
    .eq("id", teacherId)
    .single();
  if (error) return null;
  return data;
}

async function loadClinicVisits(studentId, limit = 10) {
  const { data, error } = await supabase
    .from("clinic_visits")
    .select("id,student_id,reason,findings,disposition,created_at,updated_at")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

async function loadDetailedTapLogs(studentId, limit = 20) {
  const { data, error } = await supabase
    .from("tap_logs")
    .select("id,student_id,tap_type,timestamp,status,remarks,scanner_id")
    .eq("student_id", studentId)
    .order("timestamp", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

async function loadScannerDetails(scannerId) {
  // Scanner details functionality removed - scanners table doesn't exist in schema
  return null;
}

function buildLatestTapMap(rows) {
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.student_id)) map.set(r.student_id, r);
  }
  return map;
}

// Get today's subject for a class
async function getTodaysSubject(classId) {
  if (!classId) return null;
  
  const today = new Date().toLocaleString('en-US', { weekday: 'long' }).toLowerCase();
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5); // HH:MM format (without seconds)
  
  try {
    // First try to find current subject (within time range)
    const { data: currentData, error: currentError } = await supabase
      .from('class_schedules')
      .select('subject_code, subjects(name), start_time, end_time')
      .eq('class_id', classId)
      .eq('day_of_week', today)
      .lte('start_time', currentTime)
      .gte('end_time', currentTime)
      .limit(1);
    
    if (currentError) {
      console.error('Error fetching current subject:', currentError);
    }
    
    if (currentData && currentData.length > 0) {
      return currentData[0].subjects?.name || currentData[0].subject_code;
    }
    
    // If no current subject, find the next subject today
    const { data: nextData, error: nextError } = await supabase
      .from('class_schedules')
      .select('subject_code, subjects(name), start_time')
      .eq('class_id', classId)
      .eq('day_of_week', today)
      .gt('start_time', currentTime)
      .order('start_time', { ascending: true })
      .limit(1);
    
    if (nextError) {
      console.error('Error fetching next subject:', nextError);
      return null;
    }
    
    if (nextData && nextData.length > 0) {
      return `Next: ${nextData[0].subjects?.name || nextData[0].subject_code}`;
    }
    
    return null;
  } catch (error) {
    console.error('Error in getTodaysSubject:', error);
    return null;
  }
}

// Update Student Overview Card
async function updateStudentOverview(child, latestTap, classDetails, teacherDetails) {
  if (currentStatus) {
    const status = latestTap?.status || "absent";
    currentStatus.textContent = status.charAt(0).toUpperCase() + status.slice(1);
    currentStatus.className = `status-indicator status-${status}`;
  }
  
  if (lastTapTime && latestTap?.timestamp) {
    const date = new Date(latestTap.timestamp);
    lastTapTime.textContent = date.toLocaleTimeString();
  } else if (lastTapTime) {
    lastTapTime.textContent = "—";
  }
  
  if (tapType && latestTap?.tap_type) {
    tapType.textContent = latestTap.tap_type === "in" ? "Tap In" : "Tap Out";
  } else if (tapType) {
    tapType.textContent = "—";
  }
  
  if (homeroomTeacher && teacherDetails) {
    homeroomTeacher.textContent = teacherDetails.full_name;
  } else if (homeroomTeacher) {
    homeroomTeacher.textContent = "Not assigned";
  }
  
  if (todaysSubject) {
    // Implement today's subject logic
    const subject = await getTodaysSubject(child.class_id);
    todaysSubject.textContent = subject || "—";
  }
  
  if (classroom && classDetails) {
    classroom.textContent = classDetails.room_number || "—";
  } else if (classroom) {
    classroom.textContent = "—";
  }
  
  if (gradeLevel && child.grade_level) {
    gradeLevel.textContent = child.grade_level;
  } else if (gradeLevel) {
    gradeLevel.textContent = "—";
  }
  
  if (strand && child.strand) {
    strand.textContent = child.strand;
  } else if (strand) {
    strand.textContent = "—";
  }
}

// Update Attendance History with Monthly Summary
function updateAttendanceHistory(attendanceData) {
  if (!attendanceHistoryBody) return;
  
  if (attendanceData.length === 0) {
    attendanceHistoryBody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center py-8 text-slate-500">No attendance records for selected month</td>
      </tr>
    `;
    return;
  }
  
  // Calculate monthly summary
  const summary = {
    present: 0,
    late: 0,
    absent: 0,
    excused: 0
  };
  
  for (const record of attendanceData) {
    const status = record.status.toLowerCase();
    if (summary.hasOwnProperty(status)) {
      summary[status]++;
    }
  }
  
  let html = '';
  
  // Add summary row
  html += `
    <tr class="bg-slate-50 border-b-2 border-slate-200 font-semibold">
      <td class="py-3 text-sm text-slate-900">Monthly Summary</td>
      <td class="py-3">
        <span class="flex items-center gap-2">
          <span class="status-indicator status-present">${summary.present}</span>
          <span class="status-indicator status-late">${summary.late}</span>
          <span class="status-indicator status-absent">${summary.absent}</span>
          <span class="status-indicator status-excused">${summary.excused}</span>
        </span>
      </td>
      <td class="py-3 text-sm text-slate-600">—</td>
      <td class="py-3 text-sm text-slate-600">
        Total: ${attendanceData.length} days
      </td>
    </tr>
  `;
  
  // Add individual records
  for (const record of attendanceData) {
    const date = new Date(record.date);
    const statusClass = `status-indicator status-${record.status}`;
    
    html += `
      <tr class="border-b border-slate-100 hover:bg-slate-50">
        <td class="py-3 text-sm text-slate-900">${date.toLocaleDateString()}</td>
        <td class="py-3"><span class="${statusClass}">${record.status}</span></td>
        <td class="py-3 text-sm text-slate-600">—</td>
        <td class="py-3 text-sm text-slate-600">${record.remarks || "—"}</td>
      </tr>
    `;
  }
  
  attendanceHistoryBody.innerHTML = html;
}

// Update Clinic Visits
async function updateClinicVisits(visits) {
  if (!clinicVisits) return;
  
  if (visits.length === 0) {
    clinicVisits.innerHTML = '<div class="text-center py-8 text-slate-500">No clinic visits recorded</div>';
    return;
  }
  
  let html = '';
  for (const visit of visits) {
    const date = new Date(visit.created_at);
    const updated = visit.updated_at ? new Date(visit.updated_at) : null;
    
    html += `
      <div class="p-4 rounded-xl bg-slate-50 border border-slate-200">
        <div class="flex items-start justify-between mb-2">
          <div>
            <h4 class="font-medium text-slate-900">${visit.reason || "Clinic Visit"}</h4>
            <p class="text-sm text-slate-600">${date.toLocaleDateString()}</p>
          </div>
          <span class="status-indicator status-${visit.disposition || 'pending'}">
            ${visit.disposition || "Pending"}
          </span>
        </div>
        ${visit.findings ? `<p class="text-sm text-slate-700 mb-2">${visit.findings}</p>` : ''}
        ${updated ? `<p class="text-xs text-slate-500">Updated: ${updated.toLocaleDateString()}</p>` : ''}
      </div>
    `;
  }
  
  clinicVisits.innerHTML = html;
}

// Update Guard & Gate Activity
async function updateGateActivity(tapLogs) {
  if (!gateActivity) return;
  
  if (tapLogs.length === 0) {
    gateActivity.innerHTML = '<div class="text-center py-8 text-slate-500">No scan activity recorded</div>';
    return;
  }
  
  let html = '';
  for (const log of tapLogs) {
    const date = new Date(log.timestamp);
    const scanner = log.scanner_id ? await loadScannerDetails(log.scanner_id) : null;
    
    html += `
      <div class="flex items-center gap-3 p-3 rounded-xl bg-slate-50">
        <span class="text-xl">${log.tap_type === 'in' ? '🏫' : '🚪'}</span>
        <div class="flex-1">
          <p class="text-sm font-medium text-slate-900">
            ${log.tap_type === 'in' ? 'Tap In' : 'Tap Out'} - 
            <span class="status-indicator status-${log.status}">${log.status}</span>
          </p>
          <p class="text-xs text-slate-500">
            ${date.toLocaleString()}
            ${scanner ? ` • ${scanner.name} (${scanner.location})` : ''}
          </p>
        </div>
      </div>
    `;
  }
  
  gateActivity.innerHTML = html;
}

// Populate month selector
function populateMonthSelector() {
  if (!attendanceMonth) return;
  
  const months = [];
  const currentDate = new Date();
  
  // Add 6 months back and 1 month forward
  for (let i = 6; i >= 0; i--) {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
    months.push(date);
  }
  
  let html = '<option value="">Select Month</option>';
  for (const date of months) {
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    html += `<option value="${value}">${label}</option>`;
  }
  
  attendanceMonth.innerHTML = html;
}

// Debounced refresh
function debouncedRefresh(delay = 500) {
  if (pendingRefresh) return;
  
  pendingRefresh = true;
  setTimeout(async () => {
    pendingRefresh = false;
    const now = Date.now();
    if (now - lastRefreshTime < 1000) return;
    lastRefreshTime = now;
    
    try {
      await refresh();
    } catch (e) {
      console.error("Refresh error:", e);
    }
  }, delay);
}

// Subscription cleanup
function cleanup() {
  for (const ch of subscriptions) {
    try {
      supabase.removeChannel(ch);
    } catch (e) {}
  }
  subscriptions = [];
}

// Main refresh function - updates existing static HTML elements
async function refresh() {
  if (!currentProfile) return;
  
  if (isRefreshing) {
    pendingRefresh = true;
    return;
  }
  
  isRefreshing = true;
  
  try {
    if (parentStatus) {
      parentStatus.textContent = "Loading…";
      parentStatus.classList.remove("hidden");
    }

    const children = await loadChildren(currentProfile.id);
    const studentIds = children.map((c) => c.id);
    
    // Load data in parallel
    const [tapRes, notifRes, detailedTapRes, clinicRes, absencesRes] = await Promise.allSettled([
      loadTapLogs(studentIds),
      loadNotifications(currentProfile.id),
      selectedChildId ? loadDetailedTapLogs(selectedChildId) : Promise.resolve([]),
      selectedChildId ? loadClinicVisits(selectedChildId) : Promise.resolve([]),
      selectedChildId ? loadTotalAbsences(selectedChildId) : Promise.resolve(0),
    ]);

    const taps = buildLatestTapMap(tapRes.status === "fulfilled" ? tapRes.value : []);
    const notifications = notifRes.status === "fulfilled" ? notifRes.value : [];
    const detailedTaps = detailedTapRes.status === "fulfilled" ? detailedTapRes.value : [];
    const clinicVisitsData = clinicRes.status === "fulfilled" ? clinicRes.value : [];
    const totalAbsences = absencesRes.status === "fulfilled" ? absencesRes.value : 0;
    
    // Populate child selector
    if (childSelector) {
      childSelector.innerHTML = "";
      if (children.length === 0) {
        const opt = document.createElement("option");
        opt.textContent = "No children linked";
        childSelector.appendChild(opt);
      } else {
        for (const child of children) {
          const opt = document.createElement("option");
          opt.value = child.id;
          opt.textContent = child.full_name;
          if (child.id === selectedChildId) opt.selected = true;
          childSelector.appendChild(opt);
        }
        // Select first child if none selected
        if (!selectedChildId && children.length > 0) {
          selectedChildId = children[0].id;
        }
      }
    }
    
    // Update selected child's details
      if (selectedChildId && children.length > 0) {
        const selectedChild = children.find(c => c.id === selectedChildId) || children[0];
        if (childInitial) childInitial.textContent = selectedChild.full_name.charAt(0);
        if (childName) childName.textContent = selectedChild.full_name;
        if (childGrade) {
          const grade = selectedChild.grade_level || "";
          const strand = selectedChild.strand ? ` • ${selectedChild.strand}` : "";
          childGrade.textContent = (grade + strand).trim() || "—";
        }
        
        // Load class and teacher details
        const [classDetails, teacherDetails] = await Promise.all([
          selectedChild.class_id ? loadClassDetails(selectedChild.class_id) : Promise.resolve(null),
          selectedChild.class_id ? loadClassDetails(selectedChild.class_id).then(classData => 
            classData?.homeroom_teacher_id ? loadTeacherDetails(classData.homeroom_teacher_id) : Promise.resolve(null)
          ) : Promise.resolve(null)
        ]);
        
        // Today's status from taps
        const todayTap = taps.get(selectedChild.id);
        if (todayStatus) {
          if (todayTap?.timestamp) {
            todayStatus.textContent = "In School";
            todayStatus.className = "text-lg font-bold text-emerald-600";
          } else {
            todayStatus.textContent = "Out of School";
            todayStatus.className = "text-lg font-bold text-slate-600";
          }
        }
        
        // Update enhanced features
        await updateStudentOverview(selectedChild, todayTap, classDetails, teacherDetails);
        await updateGateActivity(detailedTaps);
        await updateClinicVisits(clinicVisitsData);
        
        // Show absence warnings if applicable
        await showAbsenceWarnings(totalAbsences, selectedChild.full_name);
    } else {
      if (childName) childName.textContent = "No children linked";
      if (childGrade) childGrade.textContent = "—";
      if (todayStatus) {
        todayStatus.textContent = "—";
        todayStatus.className = "text-lg font-bold text-slate-600";
      }
    }
    
    // Calculate stats - show for selected child only
    let selectedChild = children.find(c => c.id === selectedChildId) || (children.length > 0 ? children[0] : null);
    if (selectedChild) {
      const childTap = taps.get(selectedChild.id);
      const present = childTap?.timestamp ? 1 : 0;
      const late = 0;
      const absent = 0;
      const rate = present > 0 ? 100 : 0;
      
      if (presentDays) presentDays.textContent = present.toString();
      if (lateDays) lateDays.textContent = late.toString();
      if (absentDays) absentDays.textContent = absent.toString();
      if (attendanceRate) attendanceRate.textContent = `${rate}%`;
    } else {
      if (presentDays) presentDays.textContent = "0";
      if (lateDays) lateDays.textContent = "0";
      if (absentDays) absentDays.textContent = "0";
      if (attendanceRate) attendanceRate.textContent = "0%";
    }
    
    // Quick actions status
    if (presentStatus) presentStatus.textContent = taps.has(selectedChildId) ? "Yes" : "No";
    if (weekStatus) weekStatus.textContent = "This week";
    if (pendingExcuse) {
      const pending = notifications.filter(n => n.verb.includes("excuse") && !n.read).length;
      pendingExcuse.textContent = `${pending} pending`;
    }
    
    // Recent activity - build from notifications
    if (activityList) {
      activityList.innerHTML = "";
      if (notifications.length === 0) {
        activityList.innerHTML = '<p class="text-slate-500 text-center py-8">No recent activity</p>';
      } else {
        const recent = notifications.slice(0, 5);
        for (const n of recent) {
          const verb = String(n.verb ?? "update");
          let icon = "📋";
          let text = verb;
          if (verb === "announcement") { icon = "📢"; text = "New announcement"; }
          else if (verb.includes("excuse")) { icon = "📝"; text = "Excuse letter update"; }
          else if (verb.includes("tap")) { icon = "🏫"; text = "Attendance update"; }
          else if (verb.includes("clinic")) { icon = "🏥"; text = "Clinic visit"; }
          
          const time = n.created_at ? new Date(n.created_at).toLocaleDateString() : "";
          const item = document.createElement("div");
          item.className = "flex items-center gap-3 p-3 rounded-xl bg-slate-50";
          item.innerHTML = `<span class="text-xl">${icon}</span><div class="flex-1"><p class="text-sm font-medium text-slate-900">${text}</p><p class="text-xs text-slate-500">${time}</p></div>`;
          activityList.appendChild(item);
        }
      }
    }
    
    if (parentStatus) parentStatus.classList.add("hidden");
    
    // Setup subscriptions for real-time updates
    setupSubscriptions(studentIds);
    
  } catch (e) {
    console.error("Refresh error:", e);
    if (parentStatus) {
      parentStatus.textContent = e?.message ?? "Failed to load data";
      parentStatus.classList.remove("hidden");
    }
  } finally {
    isRefreshing = false;
    if (pendingRefresh) {
      pendingRefresh = false;
      setTimeout(() => refresh(), 100);
    }
  }
}

// Setup real-time subscriptions
function setupSubscriptions(studentIds) {
  cleanup();
  
  // For now, just log that subscriptions would be set up
  // In production, you would set up Supabase real-time subscriptions here
  console.log("Subscriptions ready for student IDs:", studentIds.length);
}

// Initialize page
async function init() {
  const { profile, error } = await initParentPage();
  if (error) {
    if (parentStatus) {
      parentStatus.textContent = `Error: ${error.message}`;
      parentStatus.classList.remove("hidden");
    }
    return;
  }
  currentProfile = profile;

  // Child selector change handler
  if (childSelector) {
    childSelector.addEventListener("change", async () => {
      selectedChildId = childSelector.value;
      await refresh();
    });
  }

  // Month selector change handler
  if (attendanceMonth) {
    attendanceMonth.addEventListener("change", async () => {
      const monthValue = attendanceMonth.value;
      if (monthValue && selectedChildId) {
        const [year, month] = monthValue.split('-');
        const monthDate = new Date(parseInt(year), parseInt(month) - 1, 1);
        const attendanceData = await loadMonthAttendance(selectedChildId, monthDate);
        updateAttendanceHistory(attendanceData);
      }
    });
  }

  // Export button handler
  if (exportAttendance) {
    exportAttendance.addEventListener("click", async () => {
      if (!selectedChildId) {
        showError("Please select a child first");
        return;
      }
      
      const monthValue = attendanceMonth.value;
      if (!monthValue) {
        showError("Please select a month first");
        return;
      }
      
      const [year, month] = monthValue.split('-');
      const monthDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      const attendanceData = await loadMonthAttendance(selectedChildId, monthDate);
      
      // Create CSV content
      let csvContent = "Date,Status,Time,Remarks\n";
      for (const record of attendanceData) {
        const date = new Date(record.date);
        csvContent += `"${date.toLocaleDateString()}","${record.status}","—","${record.remarks || ''}"\n`;
      }
      
      // Create download link
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance-${monthValue}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      showSuccess("Attendance data exported successfully");
    });
  }

  try {
    await refresh();
  } catch (e) {
    console.error("Init error:", e);
    if (parentStatus) {
      parentStatus.textContent = e?.message ?? "Failed to load.";
      parentStatus.classList.remove("hidden");
    }
    showError(e?.message || "Failed to load dashboard");
  }

  window.addEventListener("beforeunload", () => {
    cleanup();
    if (window._shellCleanupFn) {
      window._shellCleanupFn();
    }
  });
}

// Start the app
init();
