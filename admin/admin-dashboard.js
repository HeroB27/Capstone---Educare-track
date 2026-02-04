import { supabase } from "../core/core.js";
import { initAppShell } from "../core/shell.js";
import { initAdminPage } from "./admin-common.js";

initAppShell({ role: "admin", active: "dashboard" });

const studentsCount = document.getElementById("studentsCount");
const presentCount = document.getElementById("presentCount");
const lateCount = document.getElementById("lateCount");
const absentCount = document.getElementById("absentCount");
const announcementsBox = document.getElementById("announcementsBox");
const alertsBox = document.getElementById("alertsBox");
const statusBox = document.getElementById("statusBox");
const attendanceEmpty = document.getElementById("attendanceEmpty");
const trendEmpty = document.getElementById("trendEmpty");
const attendanceChartNote = document.getElementById("attendanceChartNote");

let attendancePieChart = null;
let attendanceTrendChart = null;

function toLocalISODate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function renderAnnouncements(items) {
  if (!items.length) {
    announcementsBox.textContent = "No announcements yet.";
    return;
  }

  const ul = document.createElement("ul");
  ul.className = "space-y-2";
  for (const a of items) {
    const li = document.createElement("li");
    li.className = "rounded-xl bg-slate-50 px-3 py-2";
    const created = a.created_at ? new Date(a.created_at).toLocaleString() : "";
    li.innerHTML = `<div class="text-sm font-semibold text-slate-900">${escapeHtml(a.title ?? "")}</div><div class="text-xs text-slate-600">${escapeHtml(created)}</div>`;
    ul.appendChild(li);
  }
  announcementsBox.replaceChildren(ul);
}

function renderAlerts(absenceAlerts, lateAlerts) {
  if (!absenceAlerts.length && !lateAlerts.length) {
    alertsBox.textContent = "No critical alerts.";
    return;
  }

  const wrap = document.createElement("div");
  wrap.className = "space-y-4";

  if (absenceAlerts.length) {
    const section = document.createElement("div");
    section.innerHTML = `<div class="text-sm font-semibold text-slate-900">≥ 10 absences</div>`;
    const ul = document.createElement("ul");
    ul.className = "mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700";
    for (const a of absenceAlerts) {
      const li = document.createElement("li");
      li.textContent = `${a.full_name} (${a.grade_level ?? "—"}) • ${a.absences} absences`;
      ul.appendChild(li);
    }
    section.appendChild(ul);
    wrap.appendChild(section);
  }

  if (lateAlerts.length) {
    const section = document.createElement("div");
    section.innerHTML = `<div class="text-sm font-semibold text-slate-900">Frequent late</div>`;
    const ul = document.createElement("ul");
    ul.className = "mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700";
    for (const a of lateAlerts) {
      const li = document.createElement("li");
      li.textContent = `${a.full_name} (${a.grade_level ?? "—"}) • ${a.lates} late`;
      ul.appendChild(li);
    }
    section.appendChild(ul);
    wrap.appendChild(section);
  }

  alertsBox.replaceChildren(wrap);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setText(el, value) {
  if (!el) return;
  el.textContent = value;
}

function renderAttendancePie({ present, late, absent, excused }) {
  const canvas = document.getElementById("attendancePie");
  const total = present + late + absent + excused;
  if (!total) {
    attendanceEmpty.classList.remove("hidden");
    canvas.classList.add("hidden");
    if (attendancePieChart) attendancePieChart.destroy();
    attendancePieChart = null;
    return;
  }

  attendanceEmpty.classList.add("hidden");
  canvas.classList.remove("hidden");

  const data = {
    labels: ["Present", "Late", "Absent", "Excused"],
    datasets: [
      {
        data: [present, late, absent, excused],
        backgroundColor: ["#16a34a", "#2563eb", "#ef4444", "#a855f7"],
      },
    ],
  };

  if (attendancePieChart) attendancePieChart.destroy();
  attendancePieChart = new window.Chart(canvas.getContext("2d"), {
    type: "pie",
    data,
    options: { plugins: { legend: { position: "bottom" } } },
  });
}

function renderTrend(labels, values) {
  const canvas = document.getElementById("attendanceTrend");
  if (!labels.length) {
    trendEmpty.classList.remove("hidden");
    canvas.classList.add("hidden");
    if (attendanceTrendChart) attendanceTrendChart.destroy();
    attendanceTrendChart = null;
    return;
  }

  trendEmpty.classList.add("hidden");
  canvas.classList.remove("hidden");

  if (attendanceTrendChart) attendanceTrendChart.destroy();
  attendanceTrendChart = new window.Chart(canvas.getContext("2d"), {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Present %",
          data: values,
          borderColor: "#7c3aed",
          backgroundColor: "rgba(124,58,237,0.12)",
          tension: 0.25,
          fill: true,
        },
      ],
    },
    options: {
      scales: { y: { min: 0, max: 100, ticks: { callback: (v) => `${v}%` } } },
      plugins: { legend: { display: false } },
    },
  });
}

async function loadPythonMetricsIfPresent() {
  try {
    const res = await fetch("/exports/dashboard_metrics.json", { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function init() {
  const { error } = await initAdminPage();
  if (error) return;

  statusBox.textContent = "Loading data…";

  const today = toLocalISODate(new Date());
  const sevenDaysAgo = toLocalISODate(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000));
  const thirtyDaysAgo = toLocalISODate(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000));

  const [{ count: studentTotal, error: studentsError }, { data: todayAttendance, error: todayError }] = await Promise.all([
    supabase.from("students").select("id", { count: "exact", head: true }),
    supabase.from("homeroom_attendance").select("student_id,status").eq("date", today),
  ]);

  if (studentsError) {
    statusBox.textContent = studentsError.message;
    return;
  }

  setText(studentsCount, String(studentTotal ?? 0));

  const todayCounts = { present: 0, late: 0, absent: 0, excused: 0 };
  if (todayError) {
    statusBox.textContent = todayError.message;
    return;
  }
  for (const row of todayAttendance ?? []) {
    const s = String(row.status ?? "");
    if (s === "present" || s === "partial") todayCounts.present += 1;
    else if (s === "late") todayCounts.late += 1;
    else if (s === "excused_absent") todayCounts.excused += 1;
    else if (s === "absent") todayCounts.absent += 1;
  }

  setText(presentCount, String(todayCounts.present));
  setText(lateCount, String(todayCounts.late));
  setText(absentCount, String(todayCounts.absent + todayCounts.excused));

  const [announcementsRes, recentAttendanceRes, pendingClinicPassesRes, activeClinicVisitsRes, pendingExcusesRes, pythonMetrics] =
    await Promise.all([
    supabase
      .from("announcements")
      .select("id,title,created_at")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("homeroom_attendance")
      .select("student_id,status,date")
      .gte("date", thirtyDaysAgo)
      .lte("date", today),
    supabase.from("clinic_passes").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("clinic_visits").select("id", { count: "exact", head: true }).eq("status", "in_clinic"),
    supabase.from("excuse_letters").select("id", { count: "exact", head: true }).eq("status", "pending"),
    loadPythonMetricsIfPresent(),
  ]);

  if (announcementsRes.error) {
    announcementsBox.textContent = announcementsRes.error.message;
  } else {
    renderAnnouncements(announcementsRes.data ?? []);
  }

  if (recentAttendanceRes.error) {
    alertsBox.textContent = recentAttendanceRes.error.message;
    statusBox.textContent = "Loaded (with some errors).";
    return;
  }

  const absenceCountByStudent = new Map();
  const lateCountByStudent = new Map();

  const trendByDate = new Map();

  for (const row of recentAttendanceRes.data ?? []) {
    const status = String(row.status ?? "");
    const studentId = row.student_id;
    const date = row.date;

    if (status === "absent") {
      absenceCountByStudent.set(studentId, (absenceCountByStudent.get(studentId) ?? 0) + 1);
    }
    if (status === "late") {
      lateCountByStudent.set(studentId, (lateCountByStudent.get(studentId) ?? 0) + 1);
    }

    if (date >= sevenDaysAgo) {
      const prev = trendByDate.get(date) ?? { presentish: 0, total: 0 };
      const presentish = status === "present" || status === "late" || status === "partial";
      trendByDate.set(date, { presentish: prev.presentish + (presentish ? 1 : 0), total: prev.total + 1 });
    }
  }

  const absenceAlertIds = [...absenceCountByStudent.entries()]
    .filter(([, c]) => c >= 10)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id]) => id);

  const lateAlertIds = [...lateCountByStudent.entries()]
    .filter(([, c]) => c >= 5)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id]) => id);

  const uniqueStudentIds = Array.from(new Set([...absenceAlertIds, ...lateAlertIds]));
  let studentsById = new Map();
  if (uniqueStudentIds.length) {
    const studentsRes = await supabase.from("students").select("id,full_name,grade_level").in("id", uniqueStudentIds);
    if (!studentsRes.error) {
      studentsById = new Map((studentsRes.data ?? []).map((s) => [s.id, s]));
    }
  }

  const absenceAlerts = absenceAlertIds
    .map((id) => {
      const s = studentsById.get(id);
      if (!s) return null;
      return { full_name: s.full_name, grade_level: s.grade_level, absences: absenceCountByStudent.get(id) ?? 0 };
    })
    .filter(Boolean);

  const lateAlerts = lateAlertIds
    .map((id) => {
      const s = studentsById.get(id);
      if (!s) return null;
      return { full_name: s.full_name, grade_level: s.grade_level, lates: lateCountByStudent.get(id) ?? 0 };
    })
    .filter(Boolean);

  renderAlerts(absenceAlerts, lateAlerts);

  renderAttendancePie({
    present: todayCounts.present,
    late: todayCounts.late,
    absent: todayCounts.absent,
    excused: todayCounts.excused,
  });

  if (pythonMetrics?.trend?.labels?.length && pythonMetrics?.trend?.values?.length) {
    attendanceChartNote.textContent = "Python export";
    renderTrend(pythonMetrics.trend.labels, pythonMetrics.trend.values);
  } else {
    attendanceChartNote.textContent = "Live";
    const labels = Array.from(trendByDate.keys()).sort();
    const points = labels
      .map((d) => {
        const v = trendByDate.get(d);
        if (!v?.total) return null;
        return { d, value: Math.round((v.presentish / v.total) * 1000) / 10 };
      })
      .filter(Boolean);
    renderTrend(
      points.map((p) => p.d),
      points.map((p) => p.value)
    );
  }

  const pendingClinicPasses = pendingClinicPassesRes?.error ? null : pendingClinicPassesRes?.count ?? 0;
  const activeClinicVisits = activeClinicVisitsRes?.error ? null : activeClinicVisitsRes?.count ?? 0;
  const pendingExcuses = pendingExcusesRes?.error ? null : pendingExcusesRes?.count ?? 0;
  const dataSource = pythonMetrics ? "Python export detected" : "Live Supabase data";
  const cPasses = pendingClinicPasses === null ? "—" : String(pendingClinicPasses);
  const cVisits = activeClinicVisits === null ? "—" : String(activeClinicVisits);
  const cExcuses = pendingExcuses === null ? "—" : String(pendingExcuses);
  statusBox.innerHTML = `
    <div style="font-size:0.9rem;color:var(--secondary-700);">Loaded. (${escapeHtml(dataSource)})</div>
    <div style="margin-top:0.75rem;">
      <table class="table">
        <thead>
          <tr>
            <th>Queue</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="cell-strong">Pending clinic passes</td>
            <td>${escapeHtml(cPasses)}</td>
          </tr>
          <tr>
            <td class="cell-strong">Active clinic visits</td>
            <td>${escapeHtml(cVisits)}</td>
          </tr>
          <tr>
            <td class="cell-strong">Pending excuse letters</td>
            <td>${escapeHtml(cExcuses)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

init();
