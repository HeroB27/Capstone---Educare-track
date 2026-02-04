// Educare Track Parent Dashboard - Phase 7 Enhanced Version
import { supabase } from "../core/core.js";
import { button, el, escapeHtml, isoDate, selectInput, showToast, showSuccess, showError, statusBadge as uiStatusBadge } from "../core/ui.js";
import { initAppShell } from "../core/shell.js";
import { initParentPage } from "./parent-common.js";
import { registerPwa } from "../core/pwa.js";

initAppShell({ role: "parent", active: "dashboard" });

const parentStatus = document.getElementById("parentStatus");
const parentApp = document.getElementById("parentApp");
const notifStatus = document.getElementById("notifStatus");
const notifApp = document.getElementById("notifApp");
const announceStatus = document.getElementById("announceStatus");
const announceApp = document.getElementById("announceApp");

// State management
let currentProfile = null;
let subscriptions = [];
let isRefreshing = false;
let pendingRefresh = false;
let lastRefreshTime = 0;
let optimisticUpdates = new Map();

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

// Optimistic update helpers
function applyOptimisticUpdate(childId, updateType, newValue) {
  const key = `${childId}-${updateType}`;
  optimisticUpdates.set(key, { value: newValue, timestamp: Date.now() });
}

function getOptimisticUpdate(childId, updateType) {
  const key = `${childId}-${updateType}`;
  const update = optimisticUpdates.get(key);
  if (update && Date.now() - update.timestamp < 30000) {
    return update.value;
  }
  optimisticUpdates.delete(key);
  return null;
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

async function loadAnnouncementsForParent(classIds, limit = 10) {
  const base = supabase
    .from("announcements")
    .select("id,title,body,class_id,created_at")
    .eq("audience_parents", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!classIds.length) {
    const { data, error } = await base.is("class_id", null);
    if (error) throw error;
    return data ?? [];
  }

  const filter = `class_id.is.null,class_id.in.(${classIds.join(",")})`;
  const { data, error } = await base.or(filter);
  if (error) throw error;
  return data ?? [];
}

async function loadClinicVisits(studentIds) {
  if (!studentIds.length) return [];
  const { data, error } = await supabase
    .from("clinic_visits")
    .select("id,student_id,status,arrived_at,concluded_at,presenting_symptoms,notes")
    .in("student_id", studentIds)
    .order("arrived_at", { ascending: false });
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

// Render functions
function renderChildren({ children, taps }) {
  const box = el("div", "");
  const list = el("div", "grid gap-3 md:grid-cols-2");
  
  if (!children.length) {
    list.appendChild(
      el(
        "div",
        "rounded-2xl bg-slate-50 p-4 text-sm text-slate-700 ring-1 ring-slate-200 md:col-span-2",
        "No linked children yet. Ask the admin to link your account to your student(s)."
      )
    );
    box.appendChild(list);
    return box;
  }

  for (const c of children) {
    const tap = taps.get(c.id);
    // Check for optimistic updates
    const optimisticStatus = getOptimisticUpdate(c.id, "status");
    const currentStatus = optimisticStatus || c.current_status;
    
    const card = el("div", "rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200");
    if (optimisticStatus) {
      card.classList.add("animate-pulse", "bg-blue-50");
    }
    
    card.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="text-sm font-semibold text-slate-900">${escapeHtml(c.full_name)}</div>
          <div class="mt-1 text-xs text-slate-600">${escapeHtml(c.grade_level)}${c.strand ? ` • ${escapeHtml(c.strand)}` : ""}</div>
        </div>
        <span class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${inOutPill(currentStatus)}">${escapeHtml(currentStatus ?? "out")}</span>
      </div>
      <div class="mt-3 text-sm text-slate-700"><span class="font-semibold">Last tap:</span> ${tap?.timestamp ? escapeHtml(new Date(tap.timestamp).toLocaleString()) : "—"}</div>
    `;
    list.appendChild(card);
  }

  box.appendChild(list);
  return box;
}

function renderCalendar({ student, monthDate, attendanceRows, onMonthChange }) {
  const wrap = el("div", "mt-5");
  wrap.appendChild(el("div", "text-sm font-semibold text-slate-900", "Attendance history"));

  const bar = el("div", "mt-3 flex flex-wrap items-center justify-between gap-2");
  const left = el("div", "text-sm text-slate-700", `${escapeHtml(student.full_name)} • ${escapeHtml(monthKey(monthDate))}`);
  const controls = el("div", "flex gap-2");
  const prev = button("Prev", "secondary", "green");
  const next = button("Next", "secondary", "green");
  prev.className = "rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50";
  next.className = "rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50";
  prev.addEventListener("click", () => onMonthChange(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1)));
  next.addEventListener("click", () => onMonthChange(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1)));
  controls.appendChild(prev);
  controls.appendChild(next);
  bar.appendChild(left);
  bar.appendChild(controls);
  wrap.appendChild(bar);

  const map = new Map(attendanceRows.map((r) => [r.date, r.status]));
  const start = firstDayOfMonth(monthDate);
  const end = lastDayOfMonth(monthDate);

  const startWeekday = (start.getDay() + 6) % 7;
  const days = [];
  for (let i = 0; i < startWeekday; i++) days.push(null);
  for (let d = new Date(start); d <= end; d = addDays(d, 1)) days.push(new Date(d));
  while (days.length % 7 !== 0) days.push(null);

  const grid = el("div", "mt-4 grid grid-cols-7 gap-2");
  const dow = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  for (const label of dow) {
    grid.appendChild(el("div", "px-1 text-xs font-semibold text-slate-600", escapeHtml(label)));
  }

  for (const d of days) {
    if (!d) {
      grid.appendChild(el("div", "h-16 rounded-xl bg-transparent"));
      continue;
    }
    const dateStr = iso(d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const day = new Date(d);
    day.setHours(0, 0, 0, 0);
    const weekday = day.getDay();
    const isWeekend = weekday === 0 || weekday === 6;
    const isPastOrToday = day.getTime() <= today.getTime();
    const baseStatus = map.get(dateStr) ?? "";
    const status = baseStatus || (isPastOrToday && !isWeekend ? "absent" : "");
    const pillCls = status ? statusPill(status) : "status-indicator status-neutral";
    const tip = status
      ? status === "absent"
        ? "Absent: no tap-in recorded"
        : status === "late"
          ? "Late: tap-in after the late threshold"
          : status === "present"
            ? "Present: tap-in recorded"
            : status === "excused_absent"
              ? "Excused: excuse letter approved"
              : status
      : isWeekend
        ? "Weekend"
        : isPastOrToday
          ? "No record"
          : "Future date";
    const cell = el("div", `h-16 rounded-xl p-2 ${status ? "" : ""}`);
    cell.innerHTML = `
      <div class="flex items-start justify-between">
        <div class="text-xs font-semibold text-slate-700">${String(d.getDate())}</div>
        <div class="${pillCls}" title="${escapeHtml(tip)}">${escapeHtml(status || "—")}</div>
      </div>
    `;
    grid.appendChild(cell);
  }

  wrap.appendChild(grid);
  return wrap;
}

function renderNotifications({ notifications, onRefresh }) {
  notifApp?.replaceChildren();
  const unread = notifications.filter((n) => !n.read).length;
  if (notifStatus) notifStatus.textContent = `Unread: ${unread}`;

  if (!notifications.length) {
    notifApp.appendChild(el("div", "mt-4 text-sm text-slate-600", "No notifications yet."));
    return;
  }

  const list = el("div", "mt-4 space-y-2");
  for (const n of notifications) {
    const card = el("button", n.read ? "w-full rounded-2xl bg-white p-3 text-left ring-1 ring-slate-200 hover:bg-slate-50" : "w-full rounded-2xl bg-green-50 p-3 text-left ring-1 ring-green-200 hover:bg-green-100");
    const verb = String(n.verb ?? "update");
    const title = (() => {
      if (verb === "announcement") return "Announcement";
      if (verb.includes("excuse")) return "Excuse letter update";
      if (verb.includes("tap")) return "Tap update";
      if (verb.includes("clinic")) return "Clinic update";
      return verb;
    })();
    const time = n.created_at ? new Date(n.created_at).toLocaleString() : "";
    let body = "";
    try {
      body = typeof n.object === "string" ? n.object : JSON.stringify(n.object);
    } catch {
      body = String(n.object || "");
    }
    
    card.innerHTML = `
      <div class="flex items-start justify-between gap-2">
        <div class="text-sm font-semibold text-slate-900">${escapeHtml(title)}</div>
        <div class="text-xs text-slate-600">${escapeHtml(time)}</div>
      </div>
      <div class="mt-1 text-xs text-slate-700 line-clamp-3">${escapeHtml(body)}</div>
    `;
    card.addEventListener("click", async () => {
      if (n.read) return;
      try {
        await markNotificationRead(n.id);
        await onRefresh();
      } catch (e) {
        notifStatus.textContent = e?.message ?? "Failed to mark as read.";
      }
    });
    list.appendChild(card);
  }
  notifApp.appendChild(list);
}

function renderAnnouncements({ announcements, classLabelById }) {
  announceApp?.replaceChildren();

  if (!announcements.length) {
    if (announceStatus) announceStatus.textContent = "No announcements yet.";
    if (announceApp) announceApp.appendChild(el("div", "text-sm text-slate-600", "You will see school and class announcements here."));
    return;
  }

  if (announceStatus) announceStatus.textContent = `Latest: ${announcements.length}`;
  const list = el("div", "space-y-2");
  for (const a of announcements) {
    const time = a.created_at ? new Date(a.created_at).toLocaleString() : "";
    const scope = a.class_id ? classLabelById.get(a.class_id) : "School-wide";
    const card = el("div", "rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200");
    card.innerHTML = `
      <div class="flex items-start justify-between gap-2">
        <div>
          <div class="text-sm font-semibold text-slate-900">${escapeHtml(a.title)}</div>
          <div class="mt-1 text-xs text-slate-600">${escapeHtml(scope || "Class")}</div>
        </div>
        <div class="text-xs text-slate-600">${escapeHtml(time)}</div>
      </div>
      <div class="mt-2 whitespace-pre-wrap text-sm text-slate-700">${escapeHtml(a.body ?? "")}</div>
    `;
    list.appendChild(card);
  }
  announceApp.appendChild(list);
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

// Main refresh function
async function refresh() {
  if (!currentProfile) return;
  
  if (isRefreshing) {
    pendingRefresh = true;
    return;
  }
  
  isRefreshing = true;
  
  try {
    if (parentStatus) parentStatus.textContent = "Loading…";
    if (notifStatus) notifStatus.textContent = "Loading…";
    if (announceStatus) announceStatus.textContent = "Loading…";

    const children = await loadChildren(currentProfile.id);
    const studentIds = children.map((c) => c.id);
    const classIds = uniq(children.map((c) => c.class_id));

    const [tapRes, notifRes, announceRes, clinicRes] = await Promise.allSettled([
      loadTapLogs(studentIds),
      loadNotifications(currentProfile.id),
      loadAnnouncementsForParent(classIds),
      loadClinicVisits(studentIds),
    ]);

    const taps = buildLatestTapMap(tapRes.status === "fulfilled" ? tapRes.value : []);
    const notifications = notifRes.status === "fulfilled" ? notifRes.value : [];
    const announcements = announceRes.status === "fulfilled" ? announceRes.value : [];
    const clinicVisits = clinicRes.status === "fulfilled" ? clinicRes.value : [];

    parentApp.replaceChildren();

    const header = el("div", "flex flex-wrap items-center justify-between gap-2");
    header.appendChild(el("div", "text-sm text-slate-600", `Children: ${children.length}`));

    const childSel = selectInput(
      [{ value: "", label: children.length ? "Select child for calendar…" : "No children linked" }].concat(
        children.map((c) => ({ value: c.id, label: c.full_name }))
      ),
      selectedStudentId || (children[0]?.id ?? "")
    );
    childSel.disabled = !children.length;
    childSel.addEventListener("change", async () => {
      selectedStudentId = childSel.value;
      await refresh();
    });
    header.appendChild(el("div", "w-full md:w-80"));
    header.lastChild.appendChild(childSel);

    parentApp.appendChild(header);
    parentApp.appendChild(renderChildren({ children, taps }));

    const activeId = childSel.value;
    if (activeId) {
      const active = children.find((c) => c.id === activeId);
      const rows = await loadMonthAttendance(activeId, currentMonth);
      parentApp.appendChild(
        renderCalendar({
          student: active,
          monthDate: currentMonth,
          attendanceRows: rows,
          onMonthChange: async (d) => {
            currentMonth = d;
            await refresh();
          },
        })
      );
    }

    renderNotifications({ notifications, onRefresh: refresh });
    if (announceStatus && announceApp) {
      const labelByClass = new Map();
      for (const c of children) {
        if (!c.class_id || labelByClass.has(c.class_id)) continue;
        const label = `${c.grade_level ?? ""}${c.strand ? ` • ${c.strand}` : ""}`.trim();
        labelByClass.set(c.class_id, label || "Class");
      }
      if (announceRes.status === "rejected") {
        if (announceStatus) announceStatus.textContent = announceRes.reason?.message ?? "Failed to load announcements.";
        if (announceApp) announceApp.replaceChildren();
        if (announceApp) announceApp.appendChild(el("div", "text-sm text-red-700", escapeHtml(announceStatus.textContent)));
      } else {
        renderAnnouncements({ announcements, classLabelById: labelByClass });
      }
    }

    if (notifRes.status === "rejected") {
      if (notifStatus) notifStatus.textContent = notifRes.reason?.message ?? "Failed to load notifications.";
    }

    parentStatus.textContent = "Ready.";

    // Setup subscriptions
    setupSubscriptions(studentIds, classIds);

    selectedStudentId = activeId;
    
  } catch (e) {
    console.error("Refresh error:", e);
    parentStatus.textContent = `Error: ${e?.message || "Failed to load"}`;
    showError("Failed to load dashboard data");
  } finally {
    isRefreshing = false;
    if (pendingRefresh) {
      pendingRefresh = false;
      setTimeout(() => refresh(), 100);
    }
  }
}

// Setup real-time subscriptions
function setupSubscriptions(studentIds, classIds) {
  cleanup();

  // Notification channel
  const notifCh = supabase
    .channel(`parent-notif-${currentProfile.id}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "notifications", filter: `recipient_id=eq.${currentProfile.id}` },
      debouncedRefresh
    )
    .subscribe();
  subscriptions.push(notifCh);

  if (studentIds.length) {
    const idsFilter = `student_id=in.(${studentIds.join(",")})`;
    
    // Tap logs channel
    const tapCh = supabase
      .channel(`parent-taps-${currentProfile.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "tap_logs", filter: idsFilter }, debouncedRefresh)
      .subscribe();
    subscriptions.push(tapCh);
    
    // Students status channel
    const studentCh = supabase
      .channel(`parent-students-${currentProfile.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "students", filter: idsFilter }, debouncedRefresh)
      .subscribe();
    subscriptions.push(studentCh);
    
    // Clinic visits channel
    const clinicCh = supabase
      .channel(`parent-clinic-${currentProfile.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "clinic_visits", filter: idsFilter }, debouncedRefresh)
      .subscribe();
    subscriptions.push(clinicCh);
  }
}

// Initialize page
let selectedStudentId = "";
let currentMonth = new Date();

async function init() {
  registerPwa();

  const { profile, error } = await initParentPage();
  if (error) {
    parentStatus.textContent = `Error: ${error.message}`;
    return;
  }
  currentProfile = profile;

  try {
    await refresh();
  } catch (e) {
    parentStatus.textContent = e?.message ?? "Failed to load.";
    showError(e?.message || "Failed to load dashboard");
  }

  window.addEventListener("beforeunload", () => {
    cleanup();
    if (window._shellCleanupFn) {
      window._shellCleanupFn();
    }
  });
}

init();
