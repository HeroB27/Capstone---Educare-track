import { supabase, fetchUnreadNotificationsCount, redirectToDashboard, redirectToLogin, requireAuthAndProfile, signOut } from "../core/core.js";
import { formatLocalDateTime } from "../core/ui.js";
import { registerPwa } from "../core/pwa.js";

const profileBadge = document.getElementById("profileBadge");
const signOutBtn = document.getElementById("signOutBtn");
const dateRangeSelect = document.getElementById("dateRange");
const startDateInput = document.getElementById("startDate");
const endDateInput = document.getElementById("endDate");
const statusFilter = document.getElementById("statusFilter");
const searchBtn = document.getElementById("searchBtn");
const exportBtn = document.getElementById("exportBtn");
const historyTableBody = document.getElementById("historyTableBody");
const historyStatus = document.getElementById("historyStatus");

// Statistics elements
const totalVisitsEl = document.getElementById("totalVisits");
const completedCountEl = document.getElementById("completedCount");
const inProgressCountEl = document.getElementById("inProgressCount");
const avgDurationEl = document.getElementById("avgDuration");

// Pagination
const paginationInfo = document.getElementById("paginationInfo");
const prevPageBtn = document.getElementById("prevPage");
const nextPageBtn = document.getElementById("nextPage");

// Modal
const visitModal = document.getElementById("visitModal");
const closeModalBtn = document.getElementById("closeModal");
const modalContent = document.getElementById("modalContent");

let currentProfile = null;
let historyData = [];
let currentPage = 1;
const pageSize = 20;

// Initialize dates
function initDateInputs() {
  const today = new Date().toISOString().split('T')[0];
  
  // Default to "This Month"
  const monthStart = new Date();
  monthStart.setDate(1);
  startDateInput.value = monthStart.toISOString().split('T')[0];
  endDateInput.value = today;
}

dateRangeSelect.addEventListener("change", () => {
  const today = new Date().toISOString().split('T')[0];
  
  switch (dateRangeSelect.value) {
    case "today":
      startDateInput.value = today;
      endDateInput.value = today;
      break;
    case "week":
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      startDateInput.value = weekStart.toISOString().split('T')[0];
      endDateInput.value = today;
      break;
    case "month":
      const monthStart = new Date();
      monthStart.setDate(1);
      startDateInput.value = monthStart.toISOString().split('T')[0];
      endDateInput.value = today;
      break;
    case "custom":
      // Keep current values
      break;
  }
});

signOutBtn.addEventListener("click", async () => {
  await signOut();
  redirectToLogin();
});

closeModalBtn.addEventListener("click", () => {
  visitModal.classList.add("hidden");
  visitModal.classList.remove("flex");
});

visitModal.addEventListener("click", (e) => {
  if (e.target === visitModal) {
    visitModal.classList.add("hidden");
    visitModal.classList.remove("flex");
  }
});

function formatDuration(entryTime, exitTime) {
  if (!entryTime) return "-";
  
  const entry = new Date(entryTime);
  const exit = exitTime ? new Date(exitTime) : new Date();
  
  const diffMs = exit - entry;
  const diffMinutes = Math.round(diffMs / 60000);
  
  if (diffMinutes < 60) {
    return `${diffMinutes} min`;
  }
  
  const hours = Math.floor(diffMinutes / 60);
  const mins = diffMinutes % 60;
  return `${hours}h ${mins}m`;
}

function getStatusBadge(status) {
  const statusLower = String(status ?? "").toLowerCase();
  const badges = {
    completed: "bg-green-100 text-green-800",
    "done": "bg-green-100 text-green-800",
    in_progress: "bg-blue-100 text-blue-800",
    in_clinic: "bg-blue-100 text-blue-800",
    waiting: "bg-yellow-100 text-yellow-800",
    cancelled: "bg-red-100 text-red-800",
  };
  const className = badges[statusLower] || "bg-gray-100 text-gray-800";
  const displayStatus = statusLower.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}">${displayStatus}</span>`;
}

function getDateRange() {
  const start = new Date(startDateInput.value);
  const end = new Date(endDateInput.value);
  end.setHours(23, 59, 59, 999);
  
  return {
    start: new Date(start.setHours(0, 0, 0, 0)).toISOString(),
    end: end.toISOString(),
  };
}

async function loadHistory() {
  historyStatus.textContent = "Loading history...";
  historyTableBody.innerHTML = '<tr><td colspan="9" class="px-6 py-4 text-center text-gray-500">Loading...</td></tr>';
  
  try {
    const { start, end } = getDateRange();
    const status = statusFilter.value;
    
    console.log("[ClinicHistory] Loading history", { start, end, status, page: currentPage });
    
    // Build query
    let query = supabase
      .from("clinic_visits")
      .select(`
        id,
        student_id,
        clinic_pass_id,
        entry_timestamp,
        exit_timestamp,
        status,
        visit_type,
        symptoms,
        diagnosis,
        treatment_notes,
        follow_up_required,
        students!inner(
          id,
          full_name,
          grade_level,
          strand,
          parent_id
        ),
        clinic_passes(
          id,
          issued_by,
          reason,
          pass_type
        )
      `)
      .gte("entry_timestamp", start)
      .lte("entry_timestamp", end)
      .order("entry_timestamp", { ascending: false });
    
    if (status) {
      query = query.eq("status", status);
    }
    
    // Pagination
    const from = (currentPage - 1) * pageSize;
    const to = from + pageSize - 1;
    
    const { data, error, count } = query.range(from, to).then().catch(() => ({ data: null, error: { message: "Pagination not supported" }, count: null }));
    
    // If pagination fails, just get all data
    const { data: allData, error: allError } = await query;
    
    if (allError) {
      console.error("[ClinicHistory] Query error:", allError);
      throw allError;
    }
    
    historyData = allData || [];
    console.log("[ClinicHistory] History data:", historyData);
    
    // Update statistics
    updateStatistics(historyData);
    
    // Render table
    renderHistoryTable(historyData);
    
    historyStatus.textContent = `Found ${historyData.length} visit records.`;
  } catch (e) {
    console.error("[ClinicHistory] Failed to load history:", e);
    historyStatus.textContent = e?.message || "Failed to load history.";
    historyTableBody.innerHTML = '<tr><td colspan="9" class="px-6 py-4 text-center text-red-500">Error loading history data</td></tr>';
  }
}

function updateStatistics(data) {
  const total = data.length;
  const completed = data.filter(d => d.status === "completed" || d.status === "done").length;
  const inProgress = data.filter(d => d.status === "in_progress" || d.status === "in_clinic").length;
  
  // Calculate average duration
  const completedVisits = data.filter(d => d.exit_timestamp);
  let totalMinutes = 0;
  completedVisits.forEach(v => {
    const entry = new Date(v.entry_timestamp);
    const exit = new Date(v.exit_timestamp);
    totalMinutes += (exit - entry) / 60000;
  });
  const avgMinutes = completedVisits.length > 0 ? Math.round(totalMinutes / completedVisits.length) : 0;
  const avgDuration = avgMinutes < 60 ? `${avgMinutes} min` : `${Math.floor(avgMinutes / 60)}h ${avgMinutes % 60}m`;
  
  totalVisitsEl.textContent = total;
  completedCountEl.textContent = completed;
  inProgressCountEl.textContent = inProgress;
  avgDurationEl.textContent = avgDuration;
}

function renderHistoryTable(data) {
  if (!data.length) {
    historyTableBody.innerHTML = '<tr><td colspan="9" class="px-6 py-4 text-center text-gray-500">No clinic visits found for the selected filters.</td></tr>';
    return;
  }
  
  historyTableBody.innerHTML = data.map((row) => {
    const student = row.students || {};
    const pass = row.clinic_passes ? (Array.isArray(row.clinic_passes) ? row.clinic_passes[0] : row.clinic_passes) : null;
    
    return `
      <tr class="hover:bg-gray-50 cursor-pointer" data-visit-id="${row.id}">
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${formatLocalDateTime(row.entry_timestamp)}</td>
        <td class="px-6 py-4 whitespace-nowrap">
          <div class="text-sm font-medium text-gray-900">${escapeHtml(student.full_name || "Unknown")}</div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          ${student.grade_level ? `Grade ${student.grade_level}` : "-"}
          ${student.strand ? ` - ${escapeHtml(student.strand)}` : ""}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatLocalDateTime(row.entry_timestamp)}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatLocalDateTime(row.exit_timestamp)}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatDuration(row.entry_timestamp, row.exit_timestamp)}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${escapeHtml(pass?.reason || row.symptoms || "-")}</td>
        <td class="px-6 py-4 whitespace-nowrap">${getStatusBadge(row.status)}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          <button class="text-clinic-600 hover:text-clinic-900 font-medium view-details">View</button>
        </td>
      </tr>
    `;
  }).join("");
  
  // Add click handlers for view buttons
  document.querySelectorAll(".view-details").forEach((btn, index) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      showVisitDetails(data[index]);
    });
  });
  
  // Add click handlers for row details
  document.querySelectorAll("[data-visit-id]").forEach((row, index) => {
    row.addEventListener("click", () => {
      showVisitDetails(data[index]);
    });
  });
}

function showVisitDetails(visit) {
  const student = visit.students || {};
  const pass = visit.clinic_passes ? (Array.isArray(visit.clinic_passes) ? visit.clinic_passes[0] : visit.clinic_passes) : null;
  
  modalContent.innerHTML = `
    <div class="space-y-4">
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-500">Student Name</label>
          <p class="text-gray-900">${escapeHtml(student.full_name || "Unknown")}</p>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-500">Grade Level</label>
          <p class="text-gray-900">${student.grade_level ? `Grade ${student.grade_level}` : "-"}</p>
        </div>
      </div>
      
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-500">Entry Time</label>
          <p class="text-gray-900">${formatLocalDateTime(visit.entry_timestamp)}</p>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-500">Exit Time</label>
          <p class="text-gray-900">${formatLocalDateTime(visit.exit_timestamp) || "In Progress"}</p>
        </div>
      </div>
      
      <div>
        <label class="block text-sm font-medium text-gray-500">Duration</label>
        <p class="text-gray-900">${formatDuration(visit.entry_timestamp, visit.exit_timestamp)}</p>
      </div>
      
      <div>
        <label class="block text-sm font-medium text-gray-500">Visit Type</label>
        <p class="text-gray-900">${visit.visit_type || "Regular"}</p>
      </div>
      
      <div>
        <label class="block text-sm font-medium text-gray-500">Symptoms</label>
        <p class="text-gray-900">${escapeHtml(visit.symptoms || "-")}</p>
      </div>
      
      <div>
        <label class="block text-sm font-medium text-gray-500">Diagnosis</label>
        <p class="text-gray-900">${escapeHtml(visit.diagnosis || "-")}</p>
      </div>
      
      <div>
        <label class="block text-sm font-medium text-gray-500">Treatment Notes</label>
        <p class="text-gray-900">${escapeHtml(visit.treatment_notes || "-")}</p>
      </div>
      
      <div>
        <label class="block text-sm font-medium text-gray-500">Follow-up Required</label>
        <p class="text-gray-900">${visit.follow_up_required ? "Yes" : "No"}</p>
      </div>
      
      ${pass ? `
      <div class="border-t pt-4 mt-4">
        <h4 class="text-sm font-semibold text-gray-900 mb-2">Pass Information</h4>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-500">Pass Type</label>
            <p class="text-gray-900">${escapeHtml(pass.pass_type || "-")}</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-500">Reason</label>
            <p class="text-gray-900">${escapeHtml(pass.reason || "-")}</p>
          </div>
        </div>
      </div>
      ` : ""}
    </div>
  `;
  
  visitModal.classList.remove("hidden");
  visitModal.classList.add("flex");
}

function escapeHtml(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function exportToCSV() {
  if (!historyData.length) {
    alert("No data to export. Search for history first.");
    return;
  }
  
  const headers = ["Date", "Student", "Grade", "Entry Time", "Exit Time", "Duration", "Reason", "Status", "Diagnosis"];
  const rows = historyData.map((row) => {
    const student = row.students || {};
    const pass = row.clinic_passes ? (Array.isArray(row.clinic_passes) ? row.clinic_passes[0] : row.clinic_passes) : null;
    
    return [
      new Date(row.entry_timestamp).toLocaleDateString(),
      student.full_name || "",
      student.grade_level || "",
      formatLocalDateTime(row.entry_timestamp),
      formatLocalDateTime(row.exit_timestamp),
      formatDuration(row.entry_timestamp, row.exit_timestamp),
      pass?.reason || row.symptoms || "",
      row.status || "",
      row.diagnosis || "",
    ];
  });
  
  const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
  
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `clinic-history-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  
  console.log("[ClinicHistory] CSV exported");
}

searchBtn.addEventListener("click", () => {
  currentPage = 1;
  loadHistory();
});

exportBtn.addEventListener("click", exportToCSV);

// Pagination handlers
prevPageBtn.addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage--;
    loadHistory();
  }
});

nextPageBtn.addEventListener("click", () => {
  if (historyData.length >= pageSize) {
    currentPage++;
    loadHistory();
  }
});

async function init() {
  registerPwa();
  const { profile, error } = await requireAuthAndProfile();
  if (error) {
    redirectToLogin();
    return;
  }
  
  if (profile.role !== "clinic") {
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
  
  // Auto-load initial history
  await loadHistory();
  
  console.log("[ClinicHistory] Initialized successfully");
}

init();
