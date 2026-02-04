import { supabase, fetchUnreadNotificationsCount, redirectToDashboard, redirectToLogin, requireAuthAndProfile, signOut } from "../core/core.js";
import { registerPwa } from "../core/pwa.js";

const profileBadge = document.getElementById("profileBadge");
const signOutBtn = document.getElementById("signOutBtn");
const dateRangeSelect = document.getElementById("dateRange");
const customDateRange = document.getElementById("customDateRange");
const startDateInput = document.getElementById("startDate");
const endDateInput = document.getElementById("endDate");
const gradeFilter = document.getElementById("gradeFilter");
const statusFilter = document.getElementById("statusFilter");
const generateBtn = document.getElementById("generateBtn");
const exportBtn = document.getElementById("exportBtn");
const reportTableBody = document.getElementById("reportTableBody");
const reportStatus = document.getElementById("reportStatus");

// Statistics elements
const totalTapsEl = document.getElementById("totalTaps");
const onTimeCountEl = document.getElementById("onTimeCount");
const lateCountEl = document.getElementById("lateCount");
const earlyCountEl = document.getElementById("earlyCount");

let currentProfile = null;
let reportData = [];

// Initialize custom date inputs
function initDateInputs() {
  const today = new Date().toISOString().split('T')[0];
  startDateInput.value = today;
  endDateInput.value = today;
  
  // Set default for "This Month"
  const monthStart = new Date();
  monthStart.setDate(1);
  startDateInput.value = monthStart.toISOString().split('T')[0];
}

dateRangeSelect.addEventListener("change", () => {
  if (dateRangeSelect.value === "custom") {
    customDateRange.classList.remove("hidden");
  } else {
    customDateRange.classList.add("hidden");
    initDateInputs();
  }
});

signOutBtn.addEventListener("click", async () => {
  await signOut();
  redirectToLogin();
});

function formatTime(isoString) {
  if (!isoString) return "-";
  return new Date(isoString).toLocaleTimeString("en-PH", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(isoString) {
  if (!isoString) return "-";
  return new Date(isoString).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getStatusBadge(status) {
  const statusLower = String(status ?? "").toLowerCase();
  const badges = {
    present: "bg-green-100 text-green-800",
    "on time": "bg-green-100 text-green-800",
    late: "bg-yellow-100 text-yellow-800",
    absent: "bg-red-100 text-red-800",
    early: "bg-orange-100 text-orange-800",
    "early departure": "bg-orange-100 text-orange-800",
  };
  const className = badges[statusLower] || "bg-gray-100 text-gray-800";
  return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}">${status}</span>`;
}

function getDateRange() {
  const range = dateRangeSelect.value;
  const start = new Date(startDateInput.value);
  const end = new Date(endDateInput.value);
  
  switch (range) {
    case "today":
      return {
        start: new Date(new Date().setHours(0, 0, 0, 0)).toISOString(),
        end: new Date(new Date().setHours(23, 59, 59, 999)).toISOString(),
      };
    case "week":
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      return {
        start: new Date(weekStart.setHours(0, 0, 0, 0)).toISOString(),
        end: new Date(new Date().setHours(23, 59, 59, 999)).toISOString(),
      };
    case "month":
      const monthStart = new Date();
      monthStart.setDate(1);
      return {
        start: new Date(monthStart.setHours(0, 0, 0, 0)).toISOString(),
        end: new Date(new Date().setHours(23, 59, 59, 999)).toISOString(),
      };
    case "custom":
    default:
      return {
        start: new Date(start.setHours(0, 0, 0, 0)).toISOString(),
        end: new Date(end.setHours(23, 59, 59, 999)).toISOString(),
      };
  }
}

async function generateReport() {
  reportStatus.textContent = "Generating report...";
  reportTableBody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">Loading...</td></tr>';
  
  try {
    const { start, end } = getDateRange();
    const grade = gradeFilter.value;
    const status = statusFilter.value;
    
    console.log("[GuardReports] Generating report", { start, end, grade, status });
    
    // Build query
    let query = supabase
      .from("tap_logs")
      .select(`
        id,
        tap_type,
        timestamp,
        status,
        gate_location,
        students!inner(
          id,
          full_name,
          grade_level,
          strand
        )
      `)
      .gte("timestamp", start)
      .lte("timestamp", end)
      .order("timestamp", { ascending: false });
    
    if (grade) {
      query = query.eq("students.grade_level", parseInt(grade, 10));
    }
    
    if (status) {
      const statusMap = {
        present: "ok",
        late: "late",
        absent: "absent",
      };
      query = query.eq("status", statusMap[status] || status);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error("[GuardReports] Query error:", error);
      throw error;
    }
    
    console.log("[GuardReports] Report data:", data);
    reportData = data || [];
    
    // Update statistics
    updateStatistics(data || []);
    
    // Render table
    renderReportTable(data || []);
    
    reportStatus.textContent = `Report generated: ${data?.length || 0} records found.`;
  } catch (e) {
    console.error("[GuardReports] Failed to generate report:", e);
    reportStatus.textContent = e?.message || "Failed to generate report.";
    reportTableBody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-red-500">Error loading report data</td></tr>';
  }
}

function updateStatistics(data) {
  const total = data.length;
  const onTime = data.filter(d => d.status === "ok" && d.tap_type === "in").length;
  const late = data.filter(d => d.status === "late").length;
  const early = data.filter(d => d.tap_type === "out" && d.status === "ok").length;
  
  totalTapsEl.textContent = total;
  onTimeCountEl.textContent = onTime;
  lateCountEl.textContent = late;
  earlyCountEl.textContent = early;
}

function renderReportTable(data) {
  if (!data.length) {
    reportTableBody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">No records found for the selected filters.</td></tr>';
    return;
  }
  
  reportTableBody.innerHTML = data.map((row) => {
    const student = row.students || {};
    const tapIn = row.tap_type === "in" ? formatTime(row.timestamp) : "-";
    const tapOut = row.tap_type === "out" ? formatTime(row.timestamp) : "-";
    const status = row.status === "ok" ? "On Time" : (row.status === "late" ? "Late" : row.status);
    
    return `
      <tr class="hover:bg-gray-50">
        <td class="px-6 py-4 whitespace-nowrap">
          <div class="text-sm font-medium text-gray-900">${escapeHtml(student.full_name || "Unknown")}</div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          ${student.grade_level ? `Grade ${student.grade_level}` : "-"}
          ${student.strand ? ` - ${escapeHtml(student.strand)}` : ""}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${tapIn}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${tapOut}</td>
        <td class="px-6 py-4 whitespace-nowrap">${getStatusBadge(status)}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${escapeHtml(row.gate_location || "-")}</td>
      </tr>
    `;
  }).join("");
}

function escapeHtml(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function exportToCSV() {
  if (!reportData.length) {
    alert("No data to export. Generate a report first.");
    return;
  }
  
  const headers = ["Student", "Grade", "Tap In", "Tap Out", "Status", "Gate", "Timestamp"];
  const rows = reportData.map((row) => {
    const student = row.students || {};
    return [
      student.full_name || "",
      student.grade_level || "",
      row.tap_type === "in" ? formatTime(row.timestamp) : "",
      row.tap_type === "out" ? formatTime(row.timestamp) : "",
      row.status || "",
      row.gate_location || "",
      formatDate(row.timestamp),
    ];
  });
  
  const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
  
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `guard-report-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  
  console.log("[GuardReports] CSV exported");
}

generateBtn.addEventListener("click", generateReport);
exportBtn.addEventListener("click", exportToCSV);

async function init() {
  registerPwa();
  const { profile, error } = await requireAuthAndProfile();
  if (error) {
    redirectToLogin();
    return;
  }
  
  if (profile.role !== "guard") {
    redirectToDashboard(profile.role);
    return;
  }
  
  currentProfile = profile;
  profileBadge.textContent = `${profile.full_name} • ${profile.role}`;
  profileBadge.classList.remove("hidden");
  
  // Set up notifications badge
  const { count } = await fetchUnreadNotificationsCount(profile.id);
  const badge = document.getElementById("notificationBadge");
  if (count > 0) {
    badge.textContent = count;
    badge.classList.remove("hidden");
  }
  
  // Initialize date inputs
  initDateInputs();
  
  // Auto-generate initial report
  await generateReport();
  
  console.log("[GuardReports] Initialized successfully");
}

init();
