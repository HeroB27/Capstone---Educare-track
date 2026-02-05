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

// State management
let currentProfile = null;
let subscriptions = [];
let isRefreshing = false;
let pendingRefresh = false;
let lastRefreshTime = 0;
let currentMonth = new Date();
let selectedChildId = null;

// Status helpers
function statusPill(status) {
  const s = String(status ?? "").toLowerCase();
  if (s === "present") return "status-indicator status-present";
  if (s === "late") return "status-indicator status-late";
  if (s === "partial") return "status-indicator status-partial";
  if (s === "excused_absent") return "status-indicator status-excused";
  if (s === "absent") return "status-indicator status-absent";
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
    .select("id,student_id,date,status")
    .eq("student_id", studentId)
    .gte("date", iso(start))
    .lte("date", iso(end));
  if (error) throw error;
  return data ?? [];
}

function buildLatestTapMap(rows) {
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.student_id)) map.set(r.student_id, r);
  }
  return map;
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
    const [tapRes, notifRes] = await Promise.allSettled([
      loadTapLogs(studentIds),
      loadNotifications(currentProfile.id),
    ]);

    const taps = buildLatestTapMap(tapRes.status === "fulfilled" ? tapRes.value : []);
    const notifications = notifRes.status === "fulfilled" ? notifRes.value : [];
    
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
