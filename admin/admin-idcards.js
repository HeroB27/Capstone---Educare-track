import { supabase } from "../core/core.js";
import { initAppShell } from "../core/shell.js";
import { initAdminPage } from "./admin-common.js";

initAppShell({ role: "admin", active: "people" });

// Defensive code for missing DOM elements
const idStatus = document.getElementById("idStatus") ?? document.createElement("div");
const idApp = document.getElementById("idApp") ?? document.getElementById("idCardsGrid");
if (!document.getElementById("idStatus")) {
  const host = document.getElementById("idApp") ?? document.getElementById("idCardsGrid");
  if (host?.parentElement) {
    idStatus.id = "idStatus";
    idStatus.className = "text-sm text-slate-600 mb-4";
    host.parentElement.insertBefore(idStatus, host);
  }
}

function escapeHtml(value) {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#039;');
}

function el(tag, className, html) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
}

function textInput(opts) {
  opts = opts || {};
  const i = document.createElement("input");
  i.type = opts.type || "text";
  i.value = opts.value || "";
  i.placeholder = opts.placeholder || "";
  i.className = "w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200";
  return i;
}

function selectInput(options, value) {
  const s = document.createElement("select");
  s.className = "w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200";
  for (const o of options) {
    const opt = document.createElement("option");
    opt.value = o.value;
    opt.textContent = o.label;
    if (o.value === value) opt.selected = true;
    s.appendChild(opt);
  }
  return s;
}

function button(label, variant) {
  const b = document.createElement("button");
  b.type = "button";
  if (variant === "primary") {
    b.className = "rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700";
  } else if (variant === "ghost") {
    b.className = "rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50";
  } else if (variant === "danger") {
    b.className = "rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700";
  } else {
    b.className = "rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50";
  }
  b.textContent = label;
  return b;
}

function openModal(contentEl) {
  const overlay = el("div", "fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4");
  const card = el("div", "w-full max-w-2xl rounded-2xl bg-white p-5 shadow-lg");
  card.appendChild(contentEl);
  overlay.appendChild(card);
  overlay.addEventListener("click", function(e) {
    if (e.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
  return overlay;
}

async function loadAllStudents() {
  const { data, error } = await supabase.from("students")
    .select("id,full_name,lrn,class_id,grade_level")
    .order("full_name", { ascending: true });
  if (error) throw error;
  return data || [];
}

async function loadStudentIds() {
  const { data, error } = await supabase
    .from("student_ids")
    .select("id,student_id,qr_code,is_active,created_at,student:students(id,full_name,lrn,grade_level,class_id)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

function openIssueModal(studentsWithoutId, onSaved) {
  const content = el("div", "");
  content.appendChild(el("div", "text-lg font-semibold text-slate-900", "Issue new ID card"));

  const studentSelect = selectInput(
    [{ value: "", label: "Select student" }].concat(
      studentsWithoutId.map(function(s) {
        return { 
          value: s.id, 
          label: s.full_name + " (" + (s.grade_level || "-") + ")" + (s.lrn ? " - LRN: " + s.lrn : "") 
        };
      })
    ),
    ""
  );

  const form = el("form", "mt-4 grid gap-4");
  const wrap = el("div", "space-y-1");
  wrap.appendChild(el("label", "block text-sm font-medium text-slate-700", "Student"));
  wrap.appendChild(studentSelect);
  form.appendChild(wrap);

  form.appendChild(el("div", "mt-4 p-3 bg-slate-50 rounded-xl text-sm text-slate-700", 
    "A unique QR code will be generated automatically for this student ID."));

  const errorBox = el("div", "hidden mt-4 p-3 bg-red-50 rounded-xl text-sm text-red-700");
  const successBox = el("div", "hidden mt-4 p-3 bg-green-50 rounded-xl text-sm text-green-700");
  
  const actions = el("div", "mt-5 flex justify-end gap-2");
  const cancelBtn = button("Cancel", "ghost");
  const saveBtn = button("Issue ID", "primary");
  saveBtn.type = "submit";
  
  actions.appendChild(cancelBtn);
  actions.appendChild(saveBtn);

  const overlay = openModal(content);
  cancelBtn.addEventListener("click", function() { overlay.remove(); });
  
  content.appendChild(form);
  content.appendChild(errorBox);
  content.appendChild(successBox);
  content.appendChild(actions);

  form.addEventListener("submit", async function(e) {
    e.preventDefault();
    errorBox.classList.add("hidden");
    successBox.classList.add("hidden");
    saveBtn.disabled = true;
    saveBtn.textContent = "Issuing...";

    if (!studentSelect.value) {
      errorBox.textContent = "Student is required.";
      errorBox.classList.remove("hidden");
      saveBtn.disabled = false;
      saveBtn.textContent = "Issue ID";
      return;
    }

    try {
      const studentId = studentSelect.value;
      
      // Get student info
      const { data: student, error: studentError } = await supabase
        .from("students")
        .select("id,full_name,lrn")
        .eq("id", studentId)
        .single();
      
      if (studentError) throw studentError;

      // Generate QR code
      const qrCode = "EDU-" + (student.lrn || student.id.substring(0, 8)).toUpperCase() + "-" + Date.now().toString(36).toUpperCase();

      // Create student_id record
      const { error: insertError } = await supabase.from("student_ids").insert({
        student_id: student.id,
        qr_code: qrCode,
        is_active: true
      });

      if (insertError) throw insertError;

      successBox.innerHTML = "<b>ID Issued Successfully!</b><br>Student: " + escapeHtml(student.full_name) + "<br>QR Code: " + qrCode;
      successBox.classList.remove("hidden");
      saveBtn.textContent = "Done!";
      saveBtn.disabled = true;

      setTimeout(function() {
        overlay.remove();
        onSaved();
      }, 1500);

    } catch (error) {
      errorBox.textContent = error.message || "Failed to issue ID.";
      errorBox.classList.remove("hidden");
      saveBtn.disabled = false;
      saveBtn.textContent = "Issue ID";
    }
  });
}

async function reissueId(studentId, studentName, onSaved) {
  if (!confirm("Re-issue ID for " + studentName + "? This will deactivate the current ID and create a new one.")) return;

  try {
    // Deactivate old ID
    await supabase.from("student_ids").update({ is_active: false }).eq("student_id", studentId);

    // Get student info
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("id,full_name,lrn")
      .eq("id", studentId)
      .single();
    
    if (studentError) throw studentError;

    // Generate new QR code
    const qrCode = "EDU-" + (student.lrn || student.id.substring(0, 8)).toUpperCase() + "-" + Date.now().toString(36).toUpperCase();

    // Create new student_id record
    const { error: insertError } = await supabase.from("student_ids").insert({
      student_id: student.id,
      qr_code: qrCode,
      is_active: true
    });

    if (insertError) throw insertError;

    idStatus.textContent = "Re-issued ID for " + studentName + ". New QR: " + qrCode;
    await onSaved();

  } catch (error) {
    idStatus.textContent = error.message || "Failed to re-issue ID.";
  }
}

async function render() {
  idStatus.textContent = "Loading...";
  idApp.replaceChildren();

  const [students, ids] = await Promise.all([loadAllStudents(), loadStudentIds()]);
  const activeIdsByStudent = new Map(ids.filter(function(i) { return i.is_active; }).map(function(i) { return [i.student_id, i]; }));
  const studentsWithoutId = students.filter(function(s) { return !activeIdsByStudent.has(s.id); });

  // Header with search and buttons
  const header = el("div", "mb-6");
  const headerRow = el("div", "flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4");
  
  const left = el("div", "flex-1 max-w-xl");
  const search = textInput({ placeholder: "Search by name, LRN, or QR code..." });
  search.className = "w-full rounded-xl border border-slate-300 px-4 py-3 text-sm";
  left.appendChild(search);

  const filterRow = el("div", "flex gap-2 mt-2");
  const filterAll = button("All", "secondary");
  const filterActive = button("Active", "secondary");
  const filterInactive = button("Inactive", "secondary");
  filterAll.className = filterActive.className = filterInactive.className = "px-3 py-1 rounded-lg text-xs border border-slate-300";
  
  let currentFilter = "all";
  filterAll.addEventListener("click", function() { currentFilter = "all"; applyFilter(); });
  filterActive.addEventListener("click", function() { currentFilter = "active"; applyFilter(); });
  filterInactive.addEventListener("click", function() { currentFilter = "inactive"; applyFilter(); });
  
  filterRow.appendChild(filterAll);
  filterRow.appendChild(filterActive);
  filterRow.appendChild(filterInactive);
  left.appendChild(filterRow);

  const right = el("div", "flex gap-2");
  const issueBtn = button("+ Issue New ID", "primary");
  const printBtn = button("Print Cards", "secondary");
  issueBtn.addEventListener("click", function() {
    if (!studentsWithoutId.length) {
      idStatus.textContent = "All students already have IDs.";
      return;
    }
    openIssueModal(studentsWithoutId, render);
  });
  printBtn.addEventListener("click", function() {
    window.location.href = "./admin-idcards-print.html";
  });
  right.appendChild(issueBtn);
  right.appendChild(printBtn);

  headerRow.appendChild(left);
  headerRow.appendChild(right);
  header.appendChild(headerRow);
  idApp.appendChild(header);

  // Stats row
  const statsRow = el("div", "flex gap-4 mb-4 text-sm");
  const activeCount = ids.filter(function(i) { return i.is_active; }).length;
  const inactiveCount = ids.filter(function(i) { return !i.is_active; }).length;
  statsRow.innerHTML = 
    '<span class="px-3 py-1 bg-green-100 text-green-700 rounded-full">' + activeCount + ' Active</span>' +
    '<span class="px-3 py-1 bg-slate-100 text-slate-600 rounded-full">' + inactiveCount + ' Inactive</span>' +
    '<span class="px-3 py-1 bg-blue-100 text-blue-700 rounded-full">' + studentsWithoutId.length + ' Without ID</span>';
  idApp.appendChild(statsRow);

  const tableBox = el("div", "overflow-x-auto bg-white rounded-xl border border-slate-200");
  idApp.appendChild(tableBox);

  function applyFilter() {
    const q = search.value.trim().toLowerCase();
    
    // Update filter button styles
    filterAll.className = currentFilter === "all" ? "px-3 py-1 rounded-lg text-xs bg-violet-100 text-violet-700 border border-violet-300" : "px-3 py-1 rounded-lg text-xs border border-slate-300";
    filterActive.className = currentFilter === "active" ? "px-3 py-1 rounded-lg text-xs bg-green-100 text-green-700 border border-green-300" : "px-3 py-1 rounded-lg text-xs border border-slate-300";
    filterInactive.className = currentFilter === "inactive" ? "px-3 py-1 rounded-lg text-xs bg-slate-200 text-slate-700 border border-slate-400" : "px-3 py-1 rounded-lg text-xs border border-slate-300";

    const rows = ids.filter(function(i) {
      // Apply filter
      if (currentFilter === "active" && !i.is_active) return false;
      if (currentFilter === "inactive" && i.is_active) return false;
      
      // Apply search
      if (!q) return true;
      const name = String(i.student?.full_name || "").toLowerCase();
      const lrn = String(i.student?.lrn || "").toLowerCase();
      const qr = String(i.qr_code || "").toLowerCase();
      return name.includes(q) || lrn.includes(q) || qr.includes(q);
    });

    if (!rows.length) {
      tableBox.replaceChildren(el("div", "p-8 text-center text-slate-600", "No ID records found."));
      idStatus.textContent = "No results.";
      return;
    }

    const table = el("table", "w-full text-sm");
    table.innerHTML = 
      '<thead class="bg-slate-50 text-xs uppercase text-slate-500">' +
      '<tr>' +
      '<th class="py-3 px-4 text-left">Student</th>' +
      '<th class="py-3 px-4 text-left">LRN</th>' +
      '<th class="py-3 px-4 text-left">Grade</th>' +
      '<th class="py-3 px-4 text-left">QR Code</th>' +
      '<th class="py-3 px-4 text-center">Status</th>' +
      '<th class="py-3 px-4 text-right">Actions</th>' +
      '</tr></thead>';
      
    const tbody = el("tbody", "divide-y divide-slate-200");

    for (const r of rows) {
      const tr = el("tr", "hover:bg-slate-50");
      const studentName = r.student?.full_name || "—";
      const studentLrn = r.student?.lrn || "—";
      const grade = r.student?.grade_level || "—";
      const statusClass = r.is_active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600";
      const statusText = r.is_active ? "Active" : "Inactive";
      
      tr.innerHTML = 
        '<td class="py-3 px-4 font-medium text-slate-900">' + escapeHtml(studentName) + '</td>' +
        '<td class="py-3 px-4 font-mono text-xs text-slate-600">' + escapeHtml(studentLrn) + '</td>' +
        '<td class="py-3 px-4 text-slate-600">' + escapeHtml(grade) + '</td>' +
        '<td class="py-3 px-4 font-mono text-xs text-violet-600">' + escapeHtml(r.qr_code) + '</td>' +
        '<td class="py-3 px-4 text-center"><span class="px-2 py-1 rounded-full text-xs font-medium ' + statusClass + '">' + statusText + '</span></td>' +
        '<td class="py-3 px-4 text-right"></td>';

      const actionsDiv = el("div", "flex gap-1 justify-end");
      
      // Re-issue button (only for active IDs)
      if (r.is_active) {
        const reissueBtn = button("Re-issue", "secondary");
        reissueBtn.className = "px-3 py-1 rounded-lg text-xs border border-violet-300 text-violet-700 hover:bg-violet-50";
        reissueBtn.addEventListener("click", function() { reissueId(r.student_id, studentName, render); });
        actionsDiv.appendChild(reissueBtn);
      } else {
        // Re-activate button (for inactive IDs)
        const reactivateBtn = button("Re-activate", "secondary");
        reactivateBtn.className = "px-3 py-1 rounded-lg text-xs border border-green-300 text-green-700 hover:bg-green-50";
        reactivateBtn.addEventListener("click", async function() {
          try {
            await supabase.from("student_ids").update({ is_active: true }).eq("id", r.id);
            idStatus.textContent = "ID re-activated for " + studentName + ".";
            await render();
          } catch (error) {
            idStatus.textContent = error.message;
          }
        });
        actionsDiv.appendChild(reactivateBtn);
      }

      // Print single card button
      const printBtn2 = button("Print", "ghost");
      printBtn2.className = "px-3 py-1 rounded-lg text-xs border border-slate-300 hover:bg-slate-50";
      printBtn2.addEventListener("click", function() {
        window.open("./admin-idcards-print.html?student_id=" + r.student_id, '_blank');
      });
      actionsDiv.appendChild(printBtn2);

      tr.lastChild.appendChild(actionsDiv);
      tbody.appendChild(tr);
    }

    table.appendChild(tbody);
    tableBox.replaceChildren(table);
    idStatus.textContent = "Showing " + rows.length + " of " + ids.length + " ID records.";
  }

  search.addEventListener("input", applyFilter);
  applyFilter();
}

async function init() {
  const { error } = await initAdminPage();
  if (error) return;
  try {
    await render();
  } catch (e) {
    idStatus.textContent = e?.message || "Failed to load IDs.";
  }
}

init();
