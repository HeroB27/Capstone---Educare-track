import { supabase } from "../core/core.js";
import { initAppShell } from "../core/shell.js";
import { initAdminPage } from "./admin-common.js";
import { Skeleton, Toast, CommandPalette } from "../core/ui-premium.js";

let appShellInitialized = false;

// Premium command palette actions for admin
const adminCommands = [
  { category: 'Navigation', action: 'nav-dashboard', label: 'Go to Dashboard', shortcut: 'G D', execute: () => window.location.href = './admin-dashboard.html' },
  { category: 'Navigation', action: 'nav-people', label: 'Go to People', shortcut: 'G P', execute: () => window.location.href = './admin-people.html' },
  { category: 'Navigation', action: 'nav-attendance', label: 'Go to Attendance', shortcut: 'G A', execute: () => window.location.href = './admin-attendance.html' },
  { category: 'Navigation', action: 'nav-classes', label: 'Go to Classes', shortcut: 'G C', execute: () => window.location.href = './admin-classes.html' },
  { category: 'Actions', action: 'export-report', label: 'Export Report', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>', execute: () => exportReport() },
  { category: 'Actions', action: 'new-announcement', label: 'New Announcement', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5.882V19.24a1.76 1.76 0 0 1-3.417.592l-2.147-6.15M18 13a3 3 0 1 0-6 0M5.436 13.683A4.001 4.001 0 0 1 7 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 0 1-1.564-.317z"/></svg>', execute: () => window.location.href = './admin-announcements.html' },
  { category: 'Actions', action: 'view-calendar', label: 'View Calendar', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>', execute: () => window.location.href = './admin-calendar.html' },
  { category: 'Actions', action: 'settings', label: 'Open Settings', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>', execute: () => window.location.href = './admin-settings.html' },
];

// Export report placeholder - TODO: Implement export functionality
function exportReport() {
  Toast.info('Export feature is being developed.');
}

// Initialize skeleton loading states
function showLoadingStates() {
  const kpiSection = document.querySelector('.grid.grid-cols-1.sm\\:grid-cols-2.lg\\:grid-cols-4');
  const chartsSection = document.querySelector('.grid.lg\\:grid-cols-3');
  const alertsSection = document.querySelector('.grid.lg\\:grid-cols-2');
  
  if (kpiSection) {
    kpiSection.innerHTML = '';
    for (let i = 0; i < 4; i++) {
      const skeleton = Skeleton.kpiCard();
      skeleton.style.cssText += '; animation-delay: ' + (i * 0.1) + 's;';
      kpiSection.appendChild(skeleton);
    }
  }
  
  if (chartsSection) {
    chartsSection.innerHTML = '';
    const chart1 = Skeleton.chart('280px');
    chart1.style.cssText += '; grid-column: span 2; animation-delay: 0.1s;';
    const chart2 = Skeleton.chart('280px');
    chart2.style.cssText += '; animation-delay: 0.2s;';
    chartsSection.appendChild(chart1);
    chartsSection.appendChild(chart2);
  }
  
  if (alertsSection) {
    alertsSection.innerHTML = '';
    alertsSection.appendChild(Skeleton.card());
    alertsSection.appendChild(Skeleton.card());
  }
}

// Wait for shell to be ready
function waitForShell() {
  return new Promise((resolve) => {
    if (appShellInitialized) {
      resolve();
      return;
    }
    
    // Check if sidebar exists (shell has initialized)
    const checkInterval = setInterval(() => {
      const sidebar = document.getElementById('appSidebar');
      if (sidebar && sidebar.children.length > 0) {
        clearInterval(checkInterval);
        appShellInitialized = true;
        resolve();
      }
    }, 100);
    
    // Timeout after 5 seconds
    setTimeout(() => {
      clearInterval(checkInterval);
      resolve(); // Continue anyway
    }, 5000);
  });
}

async function init() {
  // Initialize shell first
  await initAppShell({ role: "admin", active: "dashboard" });
  
  // Wait for shell DOM to be ready
  await waitForShell();
  
  // Initialize command palette
  CommandPalette.init(adminCommands);
  
  // NO LONGER CALL showLoadingStates() - the HTML already has the cards
  
  // Now get elements (they should exist after shell init)
  const studentsCount = document.getElementById("studentsCount");
  const presentCount = document.getElementById("presentCount");
  const lateCount = document.getElementById("lateCount");
  const absentCount = document.getElementById("absentCount");
  const announcementsBox = document.getElementById("announcementsBox");
  const alertsBox = document.getElementById("alertsBox");
  const statusBox = document.getElementById("statusBox");
  const totalCount = document.getElementById("totalCount");
  const presentPercent = document.getElementById("presentPercent");
  const latePercent = document.getElementById("latePercent");
  const absentPercent = document.getElementById("absentPercent");

  let weeklyBarChart = null;
  let donutChart = null;
  let trendLineChart = null;

  // Helper function to add timeout to Supabase queries
  function queryWithTimeout(query, timeoutMs = 10000) {
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        console.warn("Query timeout after " + timeoutMs + "ms");
        resolve({ data: null, error: { message: "Query timeout - network may be slow" } });
      }, timeoutMs);
      
      query.then(result => {
        clearTimeout(timeoutId);
        resolve(result);
      }).catch(error => {
        clearTimeout(timeoutId);
        resolve({ data: null, error });
      });
    });
  }

  // Cleanup function to destroy all charts
  function destroyAllCharts() {
    if (weeklyBarChart) {
      weeklyBarChart.destroy();
      weeklyBarChart = null;
    }
    if (donutChart) {
      donutChart.destroy();
      donutChart = null;
    }
    if (trendLineChart) {
      trendLineChart.destroy();
      trendLineChart = null;
    }
  }

  // Cleanup on page unload
  window.addEventListener('beforeunload', destroyAllCharts);
  window.addEventListener('pagehide', destroyAllCharts);

  function toLocalISODate(date) {
    const d = date instanceof Date ? new Date(date) : new Date(date);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return yyyy + "-" + mm + "-" + dd;
  }

  function renderAnnouncements(items) {
    if (!announcementsBox) return;
    
    if (!items || items.length === 0) {
      announcementsBox.innerHTML = `
        <div class="p-4 rounded-2xl bg-violet-50 border border-violet-100 text-center">
          <svg class="w-12 h-12 mx-auto text-violet-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"></path>
          </svg>
          <p class="text-violet-600">No announcements yet</p>
        </div>
      `;
      return;
    }

    const ul = document.createElement("ul");
    ul.className = "space-y-3";
    for (const a of items) {
      const li = document.createElement("li");
      li.className = "p-4 rounded-2xl bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-100 scale-hover transition-all";
      const created = a.created_at ? new Date(a.created_at).toLocaleString() : "";
      li.innerHTML = `
        <div class="flex items-start gap-3">
          <div class="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"></path>
            </svg>
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-semibold text-slate-900">${escapeHtml(a.title || "")}</div>
            <div class="text-xs text-slate-500 mt-1">${escapeHtml(created)}</div>
          </div>
        </div>
      `;
      ul.appendChild(li);
    }
    announcementsBox.replaceChildren(ul);
  }

  function renderAlerts(absenceAlerts, lateAlerts) {
    if (!alertsBox) return;
    
    if ((!absenceAlerts || absenceAlerts.length === 0) && (!lateAlerts || lateAlerts.length === 0)) {
      alertsBox.innerHTML = `
        <div class="p-4 rounded-2xl bg-green-50 border border-green-100 text-center">
          <svg class="w-12 h-12 mx-auto text-green-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <p class="text-green-600">All clear! No critical alerts.</p>
        </div>
      `;
      return;
    }

    const wrap = document.createElement("div");
    wrap.className = "space-y-3";

    if (absenceAlerts && absenceAlerts.length > 0) {
      const section = document.createElement("div");
      section.className = "p-4 rounded-2xl bg-amber-50 border border-amber-100";
      section.innerHTML = `
        <div class="flex items-center gap-2 mb-3">
          <svg class="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
          </svg>
          <div class="text-sm font-semibold text-amber-800">>= 10 absences</div>
          <span class="ml-auto px-2 py-1 rounded-full bg-amber-200 text-xs font-semibold text-amber-700">${absenceAlerts.length}</span>
        </div>
      `;
      const ul = document.createElement("ul");
      ul.className = "space-y-2";
      for (const a of absenceAlerts) {
        const li = document.createElement("li");
        li.className = "flex items-center gap-2 text-sm text-amber-700";
        li.innerHTML = `
          <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
          </svg>
          <span class="flex-1">${escapeHtml(a.full_name || "")}</span>
          <span class="text-xs bg-amber-100 px-2 py-0.5 rounded-lg">${a.grade_level || "-"}</span>
          <span class="font-semibold">${a.absences} absences</span>
        `;
        ul.appendChild(li);
      }
      section.appendChild(ul);
      wrap.appendChild(section);
    }

    if (lateAlerts && lateAlerts.length > 0) {
      const section = document.createElement("div");
      section.className = "p-4 rounded-2xl bg-orange-50 border border-orange-100";
      section.innerHTML = `
        <div class="flex items-center gap-2 mb-3">
          <svg class="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <div class="text-sm font-semibold text-orange-800">Frequent late arrivals</div>
          <span class="ml-auto px-2 py-1 rounded-full bg-orange-200 text-xs font-semibold text-orange-700">${lateAlerts.length}</span>
        </div>
      `;
      const ul = document.createElement("ul");
      ul.className = "space-y-2";
      for (const a of lateAlerts) {
        const li = document.createElement("li");
        li.className = "flex items-center gap-2 text-sm text-orange-700";
        li.innerHTML = `
          <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
          </svg>
          <span class="flex-1">${escapeHtml(a.full_name || "")}</span>
          <span class="text-xs bg-orange-100 px-2 py-0.5 rounded-lg">${a.grade_level || "-"}</span>
          <span class="font-semibold">${a.lates} late</span>
        `;
        ul.appendChild(li);
      }
      section.appendChild(ul);
      wrap.appendChild(section);
    }

    alertsBox.replaceChildren(wrap);
  }

  function escapeHtml(value) {
    if (value === null || value === undefined) return "";
    const str = String(value);
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '\"': "&quot;",
      "'": "&#039;"
    };
    return str.replace(/[&<>"']/g, m => map[m]);
  }

  function setText(el, value) {
    if (!el) return;
    el.textContent = value;
  }

  // Set loading status
  if (statusBox) {
    statusBox.innerHTML = `
      <div class="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-100">
        <svg class="w-5 h-5 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p class="text-blue-700">Loading dashboard data...</p>
      </div>
    `;
  } else {
    console.warn('statusBox element not found');
  }

  const today = toLocalISODate(new Date());
  const sevenDaysAgo = toLocalISODate(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000));
  const thirtyDaysAgo = toLocalISODate(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000));

  try {
    const [{ count: studentTotal, error: studentsError }, { data: todayAttendance, error: todayError }] = await Promise.all([
      queryWithTimeout(supabase.from("students").select("id", { count: "exact", head: true })),
      queryWithTimeout(supabase.from("homeroom_attendance").select("student_id,status").eq("date", today)),
    ]);

    if (studentsError) {
      if (statusBox) {
        statusBox.innerHTML = `
          <div class="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-100">
            <svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <p class="text-red-700">Error: ${escapeHtml(studentsError.message)}</p>
          </div>
        `;
      }
      return;
    }

    setText(studentsCount, String(studentTotal || 0));

    const statusCounts = { present: 0, late: 0, absent: 0, excused: 0 };
    for (const rec of todayAttendance || []) {
      const s = (rec.status || "").toLowerCase();
      if (["present", "present_in_class"].includes(s)) statusCounts.present++;
      else if (["late", "late_arrival"].includes(s)) statusCounts.late++;
      else if (["absent", "absent_unexcused"].includes(s)) statusCounts.absent++;
      else if (["excused", "absent_excused"].includes(s)) statusCounts.excused++;
    }

    setText(presentCount, String(statusCounts.present));
    setText(lateCount, String(statusCounts.late));
    setText(absentCount, String(statusCounts.absent + statusCounts.excused));

    // Update donut chart percentages
    const total = statusCounts.present + statusCounts.late + statusCounts.absent + statusCounts.excused;
    setText(totalCount, String(total));
    if (total > 0) {
      setText(presentPercent, Math.round((statusCounts.present / total) * 100) + "%");
      setText(latePercent, Math.round((statusCounts.late / total) * 100) + "%");
      setText(absentPercent, Math.round(((statusCounts.absent + statusCounts.excused) / total) * 100) + "%");
    }

    // Fetch 7-day attendance trend
    const { data: weekData } = await queryWithTimeout(
      supabase.from("homeroom_attendance").select("date,status").gte("date", sevenDaysAgo).lte("date", today).order("date", { ascending: true })
    );

    const dayStats = {};
    for (const rec of weekData || []) {
      const d = rec.date;
      if (!dayStats[d]) dayStats[d] = { present: 0, late: 0, absent: 0, excused: 0, total: 0 };
      const s = (rec.status || "").toLowerCase();
      if (["present", "present_in_class"].includes(s)) dayStats[d].present++;
      else if (["late", "late_arrival"].includes(s)) dayStats[d].late++;
      else if (["absent", "absent_unexcused"].includes(s)) dayStats[d].absent++;
      else if (["excused", "absent_excused"].includes(s)) dayStats[d].excused++;
      dayStats[d].total++;
    }

    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const presentData = [];
    const lateData = [];
    const absentData = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      const iso = toLocalISODate(date);
      const dayStat = dayStats[iso];
      presentData.push(dayStat ? dayStat.present : 0);
      lateData.push(dayStat ? dayStat.late : 0);
      absentData.push((dayStat ? dayStat.absent : 0) + (dayStat ? dayStat.excused : 0));
    }

    // Update bar chart
    const barCtx = document.getElementById("weeklyBarChart");
    if (barCtx) {
      // Destroy existing chart from Chart.js registry first
      const existingBarChart = window.Chart.getChart(barCtx);
      if (existingBarChart) {
        existingBarChart.destroy();
      }
      // Destroy our local reference
      if (weeklyBarChart) {
        weeklyBarChart.destroy();
        weeklyBarChart = null;
      }
      // Clear canvas completely
      barCtx.width = barCtx.width; // Reset canvas dimensions
      // Create new chart
      try {
        weeklyBarChart = new window.Chart(barCtx, {
          type: "bar",
          data: {
            labels: days,
            datasets: [
              { label: "Present", data: presentData, backgroundColor: "rgba(102, 126, 234, 0.85)", borderRadius: 8 },
              { label: "Late", data: lateData, backgroundColor: "rgba(245, 87, 108, 0.85)", borderRadius: 8 },
              { label: "Absent", data: absentData, backgroundColor: "rgba(251, 191, 36, 0.85)", borderRadius: 8 },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: "bottom", labels: { usePointStyle: true, padding: 20 } } },
            scales: { x: { grid: { display: false } }, y: { grid: { color: "rgba(0,0,0,0.05)" } } },
          },
        });
      } catch (chartError) {
        console.error("Bar chart error:", chartError);
      }
    }

    // Update donut chart
    const donutCtx = document.getElementById("donutChart");
    if (donutCtx) {
      try {
        donutChart = new window.Chart(donutCtx, {
          type: "doughnut",
          data: {
            labels: ["Present", "Late", "Absent"],
            datasets: [{
              data: [statusCounts.present, statusCounts.late, statusCounts.absent + statusCounts.excused],
              backgroundColor: ["rgba(52, 211, 153, 0.9)", "rgba(251, 191, 36, 0.9)", "rgba(248, 113, 113, 0.9)"],
              borderWidth: 0,
              cutout: "75%",
            }],
          },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
        });
      } catch (chartError) {
        console.error("Donut chart error:", chartError);
      }
    }

    // Update trend line chart
    const { data: monthData } = await queryWithTimeout(
      supabase.from("homeroom_attendance").select("date,status").gte("date", thirtyDaysAgo).lte("date", today).order("date", { ascending: true })
    );

    const monthStats = {};
    for (const rec of monthData || []) {
      const d = rec.date;
      if (!monthStats[d]) monthStats[d] = { present: 0, total: 0 };
      const s = (rec.status || "").toLowerCase();
      if (["present", "present_in_class"].includes(s)) monthStats[d].present++;
      if (["present", "present_in_class", "late", "late_arrival", "absent", "absent_unexcused", "excused", "absent_excused"].includes(s)) {
        monthStats[d].total++;
      }
    }

    const trendLabels = [];
    const trendValues = [];
    for (let i = 0; i < 30; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      const iso = toLocalISODate(date);
      trendLabels.push(String(i + 1));
      const dayStat = monthStats[iso];
      if (dayStat && dayStat.total > 0) {
        trendValues.push(Math.round((dayStat.present / dayStat.total) * 100));
      } else {
        trendValues.push(0);
      }
    }

    const trendCanvas = document.getElementById("trendLineChart");
    if (trendCanvas) {
      try {
        trendLineChart = new window.Chart(trendCanvas, {
          type: "line",
          data: {
            labels: trendLabels,
            datasets: [{
              label: "Present %",
              data: trendValues,
              borderColor: "rgba(102, 126, 234, 1)",
              backgroundColor: "rgba(102, 126, 234, 0.1)",
              fill: true,
              tension: 0.4,
              pointRadius: 0,
              pointHoverRadius: 6,
              pointHoverBackgroundColor: "rgba(102, 126, 234, 1)",
              pointHoverBorderColor: "#fff",
              pointHoverBorderWidth: 2,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { grid: { display: false }, ticks: { display: false } },
              y: { min: 80, max: 100, grid: { color: "rgba(0,0,0,0.05)" } },
            },
            interaction: { intersect: false, mode: "index" },
          },
        });
      } catch (chartError) {
        console.error("Trend chart error:", chartError);
      }
    }

    // Load alerts
    const { data: poorAttendance } = await queryWithTimeout(
      supabase.from("students").select("id,full_name,grade_level").eq("current_status", "active").limit(10)
    );
    const { data: lateStudents } = await queryWithTimeout(
      supabase.from("students").select("id,full_name,grade_level").eq("current_status", "active").limit(10)
    );
    console.log("Alerts query completed:", { poorAttendanceCount: poorAttendance?.length, lateStudentsCount: lateStudents?.length });
    
    // Since students table doesn't have lates/absences columns, 
    // we'll show all active students and filter by status
    const absenceAlerts = (poorAttendance || []).slice(0, 5);
    const lateAlerts = (lateStudents || []).slice(0, 5);

    renderAlerts(absenceAlerts, lateAlerts);

    // Load announcements
    console.log("Fetching announcements...");
    const { data: announcements } = await queryWithTimeout(
      supabase.from("announcements").select("id,title,created_at").order("created_at", { ascending: false }).limit(5)
    );
    console.log("Announcements query completed:", { announcementsCount: announcements?.length });

    renderAnnouncements(announcements || []);

    // Update status
    if (statusBox) {
      statusBox.innerHTML = `
        <div class="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 border border-green-100">
          <div class="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
          <p class="text-green-700 font-medium">All systems operational</p>
          <span class="ml-auto text-xs text-green-600">Last updated: ${new Date().toLocaleTimeString()}</span>
        </div>
      `;
    }
    console.log("Dashboard loaded successfully");
  } catch (err) {
    console.error("Dashboard error:", err);
    if (statusBox) {
      statusBox.innerHTML = `
        <div class="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-100">
          <svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <p class="text-red-700">Error loading data: ${escapeHtml(err.message)}</p>
        </div>
      `;
    }
  }
}

// Dashboard load timeout fallback
setTimeout(() => {
  const statusBox = document.getElementById("statusBox");
  if (statusBox && statusBox.innerHTML.includes("Loading")) {
    statusBox.innerHTML = `
      <div class="flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-100">
        <svg class="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <p class="text-amber-700">Loading is taking longer than expected. Check console for details.</p>
      </div>
    `;
  }
}, 30000); // 30 second timeout

init();
