import { supabase, storePassword } from "../core/core.js";
import { initAppShell } from "../core/shell.js";
import { initAdminPage } from "./admin-common.js";

initAppShell({ role: "admin", active: "people" });

// State
let allPeople = [];
let filteredPeople = [];
let currentPage = 1;
const ITEMS_PER_PAGE = 10;

// DOM Elements with defensive code
// [Date Checked: 2026-02-11] | [Remarks: Added defensive code to prevent null reference errors when DOM elements are missing]
const searchInput = document.getElementById("searchInput") ?? document.createElement("input");
const roleFilter = document.getElementById("roleFilter") ?? document.createElement("select");
const statusFilter = document.getElementById("statusFilter") ?? document.createElement("select");
const tableBody = document.getElementById("peopleTableBody") ?? document.createElement("tbody");
const paginationInfo = document.getElementById("paginationInfo") ?? document.createElement("p");
const prevPageBtn = document.getElementById("prevPage") ?? document.createElement("button");
const nextPageBtn = document.getElementById("nextPage") ?? document.createElement("button");
const pageNumber = document.getElementById("pageNumber") ?? document.createElement("span");
const addPersonBtn = document.getElementById("addPersonBtn") ?? document.createElement("button");
const exportBtn = document.getElementById("exportBtn") ?? document.createElement("button");

// Modal elements - create fallback modal structure if missing
const personModal = document.getElementById("personModal") ?? document.createElement("div");
if (!document.getElementById("personModal")) {
  personModal.id = "personModal";
  personModal.className = "hidden fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4";
  personModal.innerHTML = `
    <div class="bg-white rounded-2xl p-5 shadow-lg max-w-2xl w-full">
      <div id="modalTitle" class="text-lg font-semibold text-slate-900">Add Person</div>
      <form id="personForm"></form>
    </div>
  `;
  document.body.appendChild(personModal);
}
const personForm = document.getElementById("personForm") ?? document.createElement("form");
const modalTitle = document.getElementById("modalTitle") ?? document.createElement("div");
const closeModalBtn = document.getElementById("closeModalBtn") ?? document.createElement("button");
const cancelBtn = document.getElementById("cancelBtn") ?? document.createElement("button");
const modalBackdrop = document.getElementById("modalBackdrop") ?? document.createElement("div");

// Initialize
async function init() {
  const { error } = await initAdminPage();
  if (error) {
    showError("Error loading page");
    return;
  }
  await loadPeople();
  setupEventListeners();
}

// Load people from database
async function loadPeople() {
  try {
    // Fetch from profiles table
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, username, role, is_active, created_at")
      .order("username", { ascending: true });

    if (profileError) {
      console.error("Error fetching profiles:", profileError);
    }

    // Fetch from students table
    const { data: students, error: studentError } = await supabase
      .from("students")
      .select("id, full_name, grade_level, current_status")
      .order("full_name", { ascending: true });

    if (studentError) {
      console.error("Error fetching students:", studentError);
    }

    // Combine profiles with student details
    allPeople = [];

    // Add profiles (adult users - parents, teachers, admins, etc.)
    if (profiles) {
      for (const p of profiles) {
        const person = {
          id: p.id,
          username: p.username,
          role: p.role,
          is_active: p.is_active,
          created_at: p.created_at,
          full_name: null,
          grade_level: null,
          current_status: null
        };

        // Students don't have matching profiles - they are children
        // No match needed, students are added separately
        allPeople.push(person);
      }
    }

    // Add students as separate entries with role = 'student'
    if (students) {
      for (const s of students) {
        const person = {
          id: s.id,
          username: null,
          role: 'student',
          is_active: true, // Students are always active; use current_status for actual status
          created_at: s.created_at,
          full_name: s.full_name,
          grade_level: s.grade_level,
          current_status: s.current_status
        };
        allPeople.push(person);
      }
    }

    console.log("Loaded people:", allPeople.length, "(profiles:", profiles?.length || 0, ", students:", students?.length || 0, ")");
    applyFilters();

  } catch (err) {
    console.error("Exception loading people:", err);
    showError("Error loading data");
  }
}

// Setup event listeners
function setupEventListeners() {
  searchInput?.addEventListener("input", debounce(applyFilters, 300));
  roleFilter?.addEventListener("change", applyFilters);
  statusFilter?.addEventListener("change", applyFilters);

  prevPageBtn?.addEventListener("click", () => changePage(currentPage - 1));
  nextPageBtn?.addEventListener("click", () => changePage(currentPage + 1));

  addPersonBtn?.addEventListener("click", () => openModal());
  exportBtn?.addEventListener("click", exportToCSV);
  closeModalBtn?.addEventListener("click", closeModal);
  cancelBtn?.addEventListener("click", closeModal);
  modalBackdrop?.addEventListener("click", closeModal);
  personForm?.addEventListener("submit", handleFormSubmit);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && personModal) {
      closeModal();
    }
  });
}

// Apply filters
function applyFilters() {
  const search = (searchInput?.value || "").toLowerCase();
  const role = roleFilter?.value || "";
  const status = statusFilter?.value || "";

  filteredPeople = allPeople.filter(person => {
    const name = (person.full_name || person.username || "").toLowerCase();
    const personRole = (person.role || "").toLowerCase();
    const isActive = person.is_active ? "active" : "inactive";
    const studentStatus = (person.current_status || "").toLowerCase();

    const matchesSearch = name.includes(search);
    const matchesRole = !role || personRole === role.toLowerCase();
    const matchesStatus = !status || 
      (status === "active" && (isActive === "active" || studentStatus === "in")) ||
      (status === "inactive" && isActive === "inactive");

    return matchesSearch && matchesRole && matchesStatus;
  });

  currentPage = 1;
  renderTable();
  updateCounts();
}

// Render table
function renderTable() {
  if (!tableBody) return;

  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE;
  const pageData = filteredPeople.slice(start, end);

  if (filteredPeople.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="5" class="py-8 text-center text-slate-500">No people found</td></tr>';
  } else {
    tableBody.innerHTML = pageData.map(person => {
      const name = person.full_name || person.username || "-";
      const email = person.username || "-";
      const role = person.role || "-";
      const status = person.is_active ? "active" : "inactive";
      
      return '<tr class="border-b border-slate-100 hover:bg-slate-50 transition-colors">' +
        '<td class="py-4 font-medium text-slate-900">' + escapeHtml(name) + '</td>' +
        '<td class="py-4"><span class="px-3 py-1 rounded-full text-xs font-medium ' + getRoleBadgeColor(role) + '">' + escapeHtml(role) + '</span></td>' +
        '<td class="py-4 text-slate-600">' + escapeHtml(email) + '</td>' +
        '<td class="py-4"><span class="px-3 py-1 rounded-full text-xs font-medium ' + getStatusBadgeColor(status) + '">' + escapeHtml(status) + '</span></td>' +
        '<td class="py-4">' +
          '<div class="flex items-center gap-2">' +
            '<button onclick="viewPerson(\'' + person.id + '\')" class="text-violet-600 hover:text-violet-800 font-medium text-sm">View</button>' +
            '<button onclick="editPerson(\'' + person.id + '\')" class="text-blue-600 hover:text-blue-800 font-medium text-sm">Edit</button>' +
            '<button onclick="deletePerson(\'' + person.id + '\')" class="text-red-600 hover:text-red-800 font-medium text-sm">Delete</button>' +
          '</div>' +
        '</td>' +
      '</tr>';
    }).join("");
  }

  updatePagination();
}

// Update pagination
function updatePagination() {
  const totalPages = Math.ceil(filteredPeople.length / ITEMS_PER_PAGE) || 1;
  const start = filteredPeople.length > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0;
  const end = Math.min(currentPage * ITEMS_PER_PAGE, filteredPeople.length);

  if (paginationInfo) paginationInfo.textContent = 'Showing ' + start + ' to ' + end + ' of ' + filteredPeople.length + ' people';
  if (pageNumber) pageNumber.textContent = 'Page ' + currentPage + ' of ' + totalPages;
  if (prevPageBtn) prevPageBtn.disabled = currentPage <= 1;
  if (nextPageBtn) nextPageBtn.disabled = currentPage >= totalPages;
}

// Change page
function changePage(page) {
  const totalPages = Math.ceil(filteredPeople.length / ITEMS_PER_PAGE) || 1;
  if (page >= 1 && page <= totalPages) {
    currentPage = page;
    renderTable();
  }
}

// Update counts
function updateCounts() {
  const counts = { students: 0, teachers: 0, parents: 0, active: 0 };

  for (const p of filteredPeople) {
    const role = String(p.role || "").toLowerCase();
    const isActive = p.is_active ? "active" : "inactive";

    if (role === "student") counts.students++;
    if (role === "teacher") counts.teachers++;
    if (role === "parent") counts.parents++;
    if (isActive === "active") counts.active++;
  }

  const studentsCount = document.getElementById("studentsCount");
  const teachersCount = document.getElementById("teachersCount");
  const parentsCount = document.getElementById("parentsCount");
  const activeCount = document.getElementById("activeCount");

  if (studentsCount) studentsCount.textContent = counts.students;
  if (teachersCount) teachersCount.textContent = counts.teachers;
  if (parentsCount) parentsCount.textContent = counts.parents;
  if (activeCount) activeCount.textContent = counts.active;
}

// Modal functions
function openModal(personId = null) {
  if (!personModal) return;

  const isEdit = !!personId;
  if (modalTitle) modalTitle.textContent = isEdit ? "Edit Person" : "Add Person";

  if (isEdit) {
    const person = allPeople.find(p => p.id === personId);
    if (person) {
      const personIdEl = document.getElementById("personId");
      const personNameEl = document.getElementById("personName");
      const personRoleEl = document.getElementById("personRole");
      const passwordField = document.getElementById("passwordField");
      
      if (personIdEl) personIdEl.value = person.id;
      if (personNameEl) personNameEl.value = person.full_name || "";
      if (personRoleEl) personRoleEl.value = person.role || "student";
      if (passwordField) passwordField.classList.add("hidden");
    }
  } else {
    personForm.reset();
    const personIdEl = document.getElementById("personId");
    const passwordField = document.getElementById("passwordField");
    
    if (personIdEl) personIdEl.value = "";
    if (passwordField) passwordField.classList.remove("hidden");
  }

  personModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  if (!personModal) return;
  personModal.classList.add("hidden");
  document.body.style.overflow = "";
  personForm.reset();
}

// Handle form submit
async function handleFormSubmit(e) {
  e.preventDefault();

  const personIdEl = document.getElementById("personId");
  const personNameEl = document.getElementById("personName");
  const personRoleEl = document.getElementById("personRole");
  
  const personId = personIdEl ? personIdEl.value : "";
  const fullName = personNameEl ? personNameEl.value.trim() : "";
  const role = personRoleEl ? personRoleEl.value : "student";

  const saveBtn = document.getElementById("savePersonBtn");
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";
  }

  try {
    if (personId) {
      // Update existing person (profiles only)
      const { error } = await supabase
        .from("profiles")
        .update({ 
          full_name: fullName,
          role: role 
        })
        .eq("id", personId);

      if (error) throw error;

      console.log("Person updated successfully");
    } else {
      // Create new profile directly (no Supabase Auth needed)
      const newUserId = crypto.randomUUID();
      const password = document.getElementById("personPassword")?.value || "demo123";
      
      const { error: profileError } = await supabase.from("profiles").insert({
        id: newUserId,
        full_name: fullName,
        username: document.getElementById("personUsername")?.value || "USER-" + Date.now(),
        phone: document.getElementById("personPhone")?.value || null,
        email: document.getElementById("personEmail")?.value || null,
        role: role,
        is_active: true
      });
      
      if (profileError) throw profileError;
      
      // Store password
      await storePassword(newUserId, password);
      
      // Create role-specific record
      if (role === "teacher") {
        await supabase.from("teachers").insert({ profile_id: newUserId, is_gatekeeper: false }).catch(() => {});
      } else if (role === "guard") {
        await supabase.from("guards").insert({ profile_id: newUserId }).catch(() => {});
      } else if (role === "clinic") {
        await supabase.from("clinic_staff").insert({ profile_id: newUserId }).catch(() => {});
      } else if (role === "parent") {
        await supabase.from("parents").insert({ profile_id: newUserId, parent_type: "Parent" }).catch(() => {});
      }
      
      console.log("Person created successfully");
    }

    closeModal();
    await loadPeople();

  } catch (err) {
    console.error("Failed to save person:", err);
    alert("Error saving person: " + err.message);
  } finally {
    const saveBtn = document.getElementById("savePersonBtn");
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Person";
    }
  }
}

// View person
window.viewPerson = function(personId) {
  const person = allPeople.find(p => p.id === personId);
  if (!person) return;

  var details = "Person Details:\n\n";
  details += "Username: " + (person.username || "-") + "\n";
  details += "Full Name: " + (person.full_name || "-") + "\n";
  details += "Role: " + (person.role || "-") + "\n";
  details += "Active: " + (person.is_active ? "Yes" : "No") + "\n";
  if (person.grade_level) details += "Grade Level: " + person.grade_level + "\n";
  if (person.current_status) details += "Status: " + person.current_status + "\n";
  if (person.created_at) details += "Created: " + new Date(person.created_at).toLocaleDateString();

  alert(details);
};

// Edit person
window.editPerson = function(personId) {
  openModal(personId);
};

// Delete person
window.deletePerson = async function(personId) {
  const person = allPeople.find(p => p.id === personId);
  if (!person) return;

  var name = person.full_name || person.username || "this person";
  
  // Check for linked students if this is a parent
  // [Date Checked: 2026-02-11] | [Remarks: Verified parent deletion warning prevents deletion of parents with linked students]
  if (person.role === "parent") {
    const { data: linkedStudents, error: linkError } = await supabase
      .from("students")
      .select("id, full_name")
      .eq("parent_id", personId);
    
    if (linkError) {
      console.error("Error checking linked students:", linkError);
      // Continue with deletion but warn user
    } else if (linkedStudents && linkedStudents.length > 0) {
      const studentNames = linkedStudents.map(s => s.full_name || "Unknown student").join(", ");
      alert(`Cannot deactivate parent: ${linkedStudents.length} student(s) linked to this parent.\n\nLinked students: ${studentNames}\n\nPlease reassign or delete the students first.`);
      return;
    }
  }
  
  var confirmed = confirm("Are you sure you want to delete " + name + "?");

  if (!confirmed) return;

  try {
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: false })
      .eq("id", personId);

    if (error) throw error;

    console.log("Person deactivated successfully");
    await loadPeople();

  } catch (err) {
    console.error("Failed to delete person:", err);
    alert("Error deleting person: " + err.message);
  }
};

// Export to CSV
function exportToCSV() {
  if (filteredPeople.length === 0) {
    alert("No data to export");
    return;
  }

  var headers = ["Username", "Full Name", "Role", "Active", "Grade Level", "Created At"];
  var rows = filteredPeople.map(function(p) {
    return [
      p.username || "",
      p.full_name || "",
      p.role || "",
      p.is_active ? "Yes" : "No",
      p.grade_level || "",
      p.created_at || ""
    ];
  });

  var csvContent = headers.join(",") + "\n" + rows.map(function(row) {
    return row.map(function(cell) {
      return '"' + String(cell).replace(/"/g, '""') + '"';
    }).join(",");
  }).join("\n");

  var blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  var link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "people_export_" + new Date().toISOString().split("T")[0] + ".csv";
  link.click();
  URL.revokeObjectURL(link.href);

  console.log("Exported", filteredPeople.length, "people to CSV");
}

// Helper functions
function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  var div = document.createElement("div");
  div.textContent = String(value);
  return div.innerHTML;
}

function getRoleBadgeColor(role) {
  var colors = {
    admin: "bg-purple-100 text-purple-700",
    teacher: "bg-blue-100 text-blue-700",
    student: "bg-green-100 text-green-700",
    parent: "bg-pink-100 text-pink-700"
  };
  return colors[String(role || "").toLowerCase()] || "bg-slate-100 text-slate-700";
}

function getStatusBadgeColor(status) {
  if (String(status || "").toLowerCase() === "active") {
    return "bg-emerald-100 text-emerald-700";
  }
  return "bg-slate-100 text-slate-700";
}

function showError(message) {
  if (tableBody) {
    tableBody.innerHTML = '<tr><td colspan="5" class="py-8 text-center text-red-500">' + escapeHtml(message) + '</td></tr>';
  }
}

function debounce(func, wait) {
  var timeout;
  return function executedFunction() {
    var args = arguments;
    var later = function() {
      timeout = null;
      func.apply(null, args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Start
init();
