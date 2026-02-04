import { supabase } from "../core/core.js";
import { button, el, escapeHtml, isoDate, selectInput } from "../core/ui.js";
import { initAppShell } from "../core/shell.js";
import { initParentPage } from "./parent-common.js";
import { registerPwa } from "../core/pwa.js";

initAppShell({ role: "parent", active: "dashboard" });

const parentStatus = document.getElementById("parentStatus");
const parentApp = document.getElementById("parentApp");
const notifStatus = document.getElementById("notifStatus");
const notifApp = document.getElementById("notifApp");

function statusPill(status) {
  const s = String(status ?? "").toLowerCase();
  if (s === "present") return "bg-green-100 text-green-700";
  if (s === "late") return "bg-yellow-100 text-yellow-800";
  if (s === "partial") return "bg-amber-100 text-amber-800";
  if (s === "excused_absent") return "bg-slate-200 text-slate-700";
  if (s === "absent") return "bg-red-100 text-red-700";
  return "bg-slate-100 text-slate-700";
}

function inOutPill(value) {
  const s = String(value ?? "").toLowerCase();
  if (s === "in") return "bg-green-100 text-green-700";
  return "bg-slate-100 text-slate-700";
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
    const card = el("div", "rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200");
    card.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="text-sm font-semibold text-slate-900">${escapeHtml(c.full_name)}</div>
          <div class="mt-1 text-xs text-slate-600">${escapeHtml(c.grade_level)}${c.strand ? ` • ${escapeHtml(c.strand)}` : ""}</div>
        </div>
        <span class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${inOutPill(c.current_status)}">${escapeHtml(c.current_status ?? "out")}</span>
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
    const status = map.get(dateStr) ?? "";
    const pillCls = status ? statusPill(status) : "bg-slate-50 text-slate-600 ring-1 ring-slate-200";
    const cell = el("div", `h-16 rounded-xl p-2 ${status ? "" : ""}`);
    cell.innerHTML = `
      <div class="flex items-start justify-between">
        <div class="text-xs font-semibold text-slate-700">${String(d.getDate())}</div>
        <div class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${pillCls}">${escapeHtml(status || "—")}</div>
      </div>
    `;
    grid.appendChild(cell);
  }

  wrap.appendChild(grid);
  return wrap;
}

function renderNotifications({ notifications, onRefresh }) {
  notifApp.replaceChildren();
  const unread = notifications.filter((n) => !n.read).length;
  notifStatus.textContent = `Unread: ${unread}`;

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
    const body = n.object ? JSON.stringify(n.object) : "";
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
        alert(e?.message ?? "Failed to mark as read.");
      }
    });
    list.appendChild(card);
  }
  notifApp.appendChild(list);
}

let currentProfile = null;
let channels = [];
let selectedStudentId = "";
let currentMonth = new Date();

function cleanup() {
  for (const ch of channels) supabase.removeChannel(ch);
  channels = [];
}

async function refresh() {
  if (!currentProfile) return;
  parentStatus.textContent = "Loading…";

  const children = await loadChildren(currentProfile.id);
  const studentIds = children.map((c) => c.id);
  const taps = buildLatestTapMap(await loadTapLogs(studentIds));
  const notifications = await loadNotifications(currentProfile.id);

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

  parentStatus.textContent = "Ready.";

  cleanup();

  const notifCh = supabase
    .channel(`parent-notif-${currentProfile.id}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "notifications", filter: `recipient_id=eq.${currentProfile.id}` },
      async () => {
        await refresh();
      }
    )
    .subscribe();
  channels.push(notifCh);

  if (studentIds.length) {
    const idsFilter = `student_id=in.(${studentIds.join(",")})`;
    const tapCh = supabase
      .channel(`parent-taps-${currentProfile.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "tap_logs", filter: idsFilter }, async () => {
        await refresh();
      })
      .subscribe();
    channels.push(tapCh);
  }

  selectedStudentId = activeId;
}

async function init() {
  registerPwa();
  const { profile, error } = await initParentPage();
  if (error) return;
  currentProfile = profile;
  try {
    await refresh();
  } catch (e) {
    parentStatus.textContent = e?.message ?? "Failed to load.";
    notifStatus.textContent = "";
  }
  window.addEventListener("beforeunload", cleanup);
}

init();
