import { supabase } from "../core/core.js";
import { initAppShell } from "../core/shell.js";
import { initAdminPage } from "./admin-common.js";

initAppShell({ role: "admin", active: "idcards" });

// ============================================
// UTILITY FUNCTIONS
// ============================================

const idStatus = document.getElementById("idStatus") ?? document.createElement("div");
const idApp = document.getElementId("idApp") ?? document.getElementById("idCardsGrid");

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
  i.className = "w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100";
  return i;
}

function selectInput(options, value) {
  const s = document.createElement("select");
  s.className = "w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100";
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
    b.className = "rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700";
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

function openModal(contentEl, size = "max-w-2xl") {
  const overlay = el("div", "fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4");
  const card = el("div", "w-full " + size + " rounded-2xl bg-white p-5 shadow-lg max-h-[90vh] overflow-y-auto");
  card.appendChild(contentEl);
  overlay.appendChild(card);
  overlay.addEventListener("click", function(e) {
    if (e.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
  return overlay;
}

// ============================================
// ID CARD DESIGN (2x3 inches - Blue Theme)
// ============================================

function generateIDCard(student, parent, qrData) {
  const photoPlaceholder = student.photo_path 
    ? `<img src="${student.photo_path}" alt="Student Photo" class="w-full h-full object-cover">`
    : `<svg class="w-16 h-16 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
       </svg>`;

  // Generate QR code as SVG
  const qrSVG = generateQRSVG(qrData);

  return `
    <div class="id-card-container flex gap-2 print:gap-4">
      <!-- FRONT SIDE -->
      <div class="id-card-front bg-gradient-to-br from-blue-600 to-blue-800 text-white rounded-xl p-3 w-48 print:w-64 print:p-4 shadow-lg print:shadow-none">
        <div class="text-center mb-2">
          <div class="text-xs font-bold tracking-wider opacity-90">EDUCARE COLLEGES INC</div>
          <div class="text-[10px] opacity-75">Purok 4 Irisan Baguio City</div>
        </div>
        
        <div class="bg-white/90 rounded-lg p-1 mb-2">
          <div class="h-24 bg-blue-50 rounded flex items-center justify-center overflow-hidden">
            ${photoPlaceholder}
          </div>
        </div>
        
        <div class="text-center">
          <div class="font-bold text-sm leading-tight mb-1">${escapeHtml(student.full_name || "Student Name")}</div>
          <div class="text-[10px] opacity-80 mb-1">${escapeHtml(student.address || "Address")}</div>
          <div class="bg-white/20 rounded-full px-2 py-0.5 text-[10px] inline-block">
            Grade: ${escapeHtml(student.grade_level || "-")}${student.strand ? ' - ' + escapeHtml(student.strand) : ''}
          </div>
        </div>
      </div>
      
      <!-- BACK SIDE -->
      <div class="id-card-back bg-white border-2 border-blue-600 rounded-xl p-3 w-48 print:w-64 print:p-4 shadow-lg print:shadow-none">
        <div class="flex items-start justify-between mb-2">
          <div>
            <div class="text-[10px] text-slate-500">Student ID</div>
            <div class="font-mono text-xs font-bold text-blue-700">${escapeHtml(student.id)}</div>
          </div>
          <div class="w-12 h-12 bg-white border border-slate-200 rounded p-1">
            ${qrSVG}
          </div>
        </div>
        
        <div class="border-t border-slate-200 pt-2 mb-2">
          <div class="text-[10px] text-slate-500">Parent/Guardian</div>
          <div class="text-xs font-medium text-slate-800">${escapeHtml(parent?.full_name || "—")}</div>
          <div class="text-xs text-slate-600">${escapeHtml(parent?.phone || "—")}</div>
        </div>
        
        <div class="bg-red-50 border border-red-200 rounded-lg p-1.5 text-center">
          <div class="text-[9px] text-red-600 font-medium">⚠️ IF FOUND, PLEASE RETURN TO:</div>
          <div class="text-[9px] text-red-500">EDUCARE COLLEGES INC</div>
          <div class="text-[8px] text-red-400">Purok 4 Irisan Baguio City</div>
        </div>
      </div>
    </div>
  `;
}

function generateQRSVG(data) {
  // Simple QR-like pattern for visual representation
  const size = 10;
  const hash = data.split('').reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0);
  
  let pattern = '';
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      const val = Math.abs(Math.sin(hash + i * size + j)) > 0.5;
      if (val) {
        pattern += `<rect x="${j * 2.5}" y="${i * 2.5}" width="2.5" height="2.5" fill="#1e40af"/>`;
      }
    }
  }
  
  return `<svg viewBox="0 0 25 25" class="w-full h-full">
    ${pattern}
    <rect x="0" y="0" width="7.5" height="7.5" fill="#1e40af"/>
    <rect x="1.5" y="1.5" width="2" height="2" fill="white"/>
    <rect x="4.5" y="1.5" width="2" height="2" fill="white"/>
    <rect x="1.5" y="4.5" width="2" height="2" fill="white"/>
    <rect x="17.5" y="0" width="7.5" height="7.5" fill="#1e40af"/>
    <rect x="19" y="1.5" width="2" height="2" fill="white"/>
    <rect x="22" y="1.5" width="2" height="2" fill="white"/>
    <rect x="19" y="4.5" width="2" height="2" fill="white"/>
    <rect x="0" y="17.5" width="7.5" height="7.5" fill="#1e40af"/>
    <rect x="1.5" y="19" width="2" height="2" fill="white"/>
    <rect x="4.5" y="19" width="2" height="2" fill="white"/>
    <rect x="1.5" y="22" width="2" height="2" fill="white"/>
  </svg>`;
}

function generateQRData(studentId, parentPhone) {
  const timestamp = Date.now().toString(36);
  const securityHash = btoa(studentId + (parentPhone || "") + timestamp).slice(0, 8);
  return JSON.stringify({
    sid: studentId,
    ph: (parentPhone || "").slice(-4),
    ts: timestamp,
    sh: securityHash
  });
}

// ============================================
// LOAD DATA
// ============================================

async function loadStudents() {
  const { data, error } = await supabase
    .from("students")
    .select("id,full_name,lrn,address,grade_level,strand,parent_id,photo_path,is_active")
    .order("full_name", { ascending: true });
  if (error) throw error;
  return data || [];
}

async function loadParents() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,full_name,phone,role")
    .in("role", ["parent", "guardian"]);
  if (error) throw error;
  return data || [];
}

async function loadStudentIds() {
  const { data, error } = await supabase
    .from("student_ids")
    .select("id,student_id,qr_code,is_active,created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

// ============================================
// MODAL: SEARCH STUDENT FOR RE-ISSUE
// ============================================

function openSearchReissueModal(students, parents, onSaved) {
  const content = el("div", "");
  content.appendChild(el("div", "text-lg font-semibold text-slate-900 mb-1", "Search Student to Re-issue ID"));
  content.appendChild(el("div", "text-sm text-slate-600 mb-4", "Search by student name, ID, or LRN to reprint or re-issue an ID card."));

  const search = textInput({ placeholder: "🔍 Search student name, ID, or LRN..." });
  search.className = "w-full rounded-xl border border-slate-300 px-4 py-3 text-sm mb-3";
  content.appendChild(search);

  const resultsContainer = el("div", "max-h-96 overflow-y-auto space-y-2");
  content.appendChild(resultsContainer);

  function renderResults(query) {
    resultsContainer.innerHTML = "";
    const q = query.toLowerCase().trim();
    
    const filtered = students.filter(s => {
      if (!s.is_active) return false;
      const name = (s.full_name || "").toLowerCase();
      const id = (s.id || "").toLowerCase();
      const lrn = (s.lrn || "").toLowerCase();
      return name.includes(q) || id.includes(q) || lrn.includes(q);
    });

    if (!filtered.length) {
      resultsContainer.innerHTML = '<div class="text-center text-slate-500 py-4">No students found matching your search.</div>';
      return;
    }

    for (const student of filtered) {
      const parent = parents.find(p => p.id === student.parent_id);
      const div = el("div", "p-3 bg-slate-50 rounded-xl hover:bg-blue-50 cursor-pointer transition-colors border border-slate-200");
      div.innerHTML = `
        <div class="flex items-center justify-between">
          <div>
            <div class="font-medium text-slate-900">${escapeHtml(student.full_name)}</div>
            <div class="text-xs text-slate-500">ID: ${escapeHtml(student.id)} | Grade: ${escapeHtml(student.grade_level || "-")}</div>
            <div class="text-xs text-slate-400">LRN: ${escapeHtml(student.lrn || "—")}</div>
          </div>
          <div class="flex gap-2">
            <button class="view-btn px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs hover:bg-blue-200" data-action="view">View ID</button>
            <button class="reissue-btn px-3 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs hover:bg-amber-200" data-action="reissue">Re-issue</button>
          </div>
        </div>
      `;
      
      div.querySelector(".view-btn").addEventListener("click", function(e) {
        e.stopPropagation();
        openIDCardModal(student, parent);
      });
      
      div.querySelector(".reissue-btn").addEventListener("click", function(e) {
        e.stopPropagation();
        openReissueConfirmModal(student, parent, onSaved);
      });
      
      resultsContainer.appendChild(div);
    }
  }

  search.addEventListener("input", function() {
    renderResults(search.value);
  });

  renderResults(""); // Show all initially

  const overlay = openModal(content, "max-w-2xl");
}

// ============================================
// MODAL: VIEW ID CARD
// ============================================

function openIDCardModal(student, parent) {
  const content = el("div", "");
  content.appendChild(el("div", "text-lg font-semibold text-slate-900 mb-3", "Student ID Card"));
  
  const qrData = generateQRData(student.id, parent?.phone);
  content.innerHTML += generateIDCard(student, parent, qrData);
  
  const actions = el("div", "mt-4 flex justify-end gap-2");
  const closeBtn = button("Close", "ghost");
  const printBtn = button("🖨️ Print ID", "primary");
  
  actions.appendChild(closeBtn);
  actions.appendChild(printBtn);
  content.appendChild(actions);
  
  const overlay = openModal(content, "max-w-3xl");
  closeBtn.addEventListener("click", function() { overlay.remove(); });
  
  printBtn.addEventListener("click", function() {
    const printContent = `
      <div style="display:flex;gap:10px;padding:20px;">
        ${generateIDCard(student, parent, qrData)}
      </div>
      <script>
        window.onload = function() {
          window.print();
          window.onload = null;
        };
      <\/script>
    `;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Print ID Card</title>
          <script src="https://cdn.tailwindcss.com"><\/script>
          <style>
            @media print {
              body { margin: 0; padding: 20px; }
              .id-card-container { display: flex; gap: 10px; }
            }
          </style>
        </head>
        <body>${printContent}</body>
      </html>
    `);
    printWindow.document.close();
  });
}

// ============================================
// MODAL: RE-ISSUE CONFIRMATION
// ============================================

function openReissueConfirmModal(student, parent, onSaved) {
  const content = el("div", "");
  content.appendChild(el("div", "text-lg font-semibold text-slate-900 mb-2", "Re-issue ID Card"));
  content.appendChild(el("div", "text-sm text-slate-600 mb-4", `This will deactivate the current ID for <b>${escapeHtml(student.full_name)}</b> and generate a new one.`));
  
  const reason = textInput({ placeholder: "Reason for re-issue (e.g., Lost ID, Damaged)" });
  content.appendChild(reason);
  
  const errorBox = el("div", "hidden mt-3 p-3 bg-red-50 rounded-xl text-sm text-red-700");
  const successBox = el("div", "hidden mt-3 p-3 bg-green-50 rounded-xl text-sm text-green-700");
  
  const actions = el("div", "mt-4 flex justify-end gap-2");
  const cancelBtn = button("Cancel", "ghost");
  const confirmBtn = button("Re-issue ID", "primary");
  
  actions.appendChild(cancelBtn);
  actions.appendChild(confirmBtn);
  content.appendChild(actions);
  content.appendChild(errorBox);
  content.appendChild(successBox);
  
  const overlay = openModal(content);
  cancelBtn.addEventListener("click", function() { overlay.remove(); });
  
  confirmBtn.addEventListener("click", async function() {
    errorBox.classList.add("hidden");
    successBox.classList.add("hidden");
    confirmBtn.disabled = true;
    confirmBtn.textContent = "Processing...";
    
    try {
      // Deactivate old ID
      await supabase.from("student_ids").update({ is_active: false }).eq("student_id", student.id);
      
      // Generate new QR code
      const newQRData = generateQRData(student.id, parent?.phone);
      const qrCode = "EDU-" + student.id.substring(0, 8).toUpperCase() + "-" + Date.now().toString(36).toUpperCase();
      
      // Create new student_id record
      await supabase.from("student_ids").insert({
        student_id: student.id,
        qr_code: qrCode,
        is_active: true
      });
      
      successBox.innerHTML = `<b>✅ ID Re-issued Successfully!</b><br>Student: ${escapeHtml(student.full_name)}<br>New QR: ${qrCode}<br>Reason: ${escapeHtml(reason.value) || "Not specified"}`;
      successBox.classList.remove("hidden");
      confirmBtn.textContent = "Done!";
      confirmBtn.disabled = true;
      
      setTimeout(function() {
        overlay.remove();
        onSaved();
      }, 2000);
      
    } catch (error) {
      errorBox.textContent = error.message || "Failed to re-issue ID.";
      errorBox.classList.remove("hidden");
      confirmBtn.disabled = false;
      confirmBtn.textContent = "Re-issue ID";
    }
  });
}

// ============================================
// MAIN RENDER FUNCTION
// ============================================

async function render() {
  idStatus.textContent = "Loading...";
  
  try {
    const [students, parents, ids] = await Promise.all([
      loadStudents(),
      loadParents(),
      loadStudentIds()
    ]);
    
    idApp.replaceChildren();
    
    // Header
    const header = el("div", "mb-6");
    const headerRow = el("div", "flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4");
    
    const left = el("div", "flex-1 max-w-xl");
    const search = textInput({ placeholder: "🔍 Search student name, ID, or LRN..." });
    search.className = "w-full rounded-xl border border-slate-300 px-4 py-3 text-sm";
    left.appendChild(search);
    
    const right = el("div", "flex gap-2 flex-wrap");
    const searchBtn = button("🔍 Find Student", "secondary");
    const newIssueBtn = button("+ New ID Issue", "primary");
    
    searchBtn.addEventListener("click", function() {
      openSearchReissueModal(students, parents, render);
    });
    
    right.appendChild(searchBtn);
    right.appendChild(newIssueBtn);
    
    headerRow.appendChild(left);
    headerRow.appendChild(right);
    header.appendChild(headerRow);
    idApp.appendChild(header);
    
    // Stats
    const statsRow = el("div", "flex gap-4 mb-6 flex-wrap");
    const activeCount = ids.filter(i => i.is_active).length;
    const inactiveCount = ids.filter(i => !i.is_active).length;
    const studentsWithId = new Set(ids.filter(i => i.is_active).map(i => i.student_id));
    const withoutId = students.filter(s => !studentsWithId.has(s.id)).length;
    
    statsRow.innerHTML = `
      <div class="px-4 py-2 bg-blue-100 text-blue-700 rounded-xl text-sm">
        <span class="font-bold">${activeCount}</span> Active IDs
      </div>
      <div class="px-4 py-2 bg-amber-100 text-amber-700 rounded-xl text-sm">
        <span class="font-bold">${withoutId}</span> Without ID
      </div>
      <div class="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm">
        <span class="font-bold">${students.length}</span> Total Students
      </div>
    `;
    idApp.appendChild(statsRow);
    
    // ID Cards Grid
    const grid = el("div", "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6");
    idApp.appendChild(grid);
    
    // Show sample/active ID cards
    const activeIds = ids.filter(i => i.is_active).slice(0, 12);
    
    if (!activeIds.length) {
      grid.innerHTML = `
        <div class="col-span-full text-center py-12 bg-slate-50 rounded-xl">
          <svg class="w-16 h-16 mx-auto text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2""></path>
          </svg>
          <p class="text-slate-500">No ID cards issued yet.</p>
          <p class="text-slate-400 text-sm">Use "New ID Issue" to create the first ID card.</p>
        </div>
      `;
    } else {
      for (const idRecord of activeIds) {
        const student = students.find(s => s.id === idRecord.student_id);
        if (!student) continue;
        
        const parent = parents.find(p => p.id === student.parent_id);
        const qrData = idRecord.qr_code || generateQRData(student.id, parent?.phone);
        
        const cardEl = el("div", "bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow");
        cardEl.innerHTML = generateIDCard(student, parent, qrData);
        
        const actions = el("div", "p-3 bg-slate-50 border-t border-slate-100 flex justify-between");
        actions.innerHTML = `
          <button class="view-btn px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs hover:bg-blue-200">View</button>
          <button class="print-btn px-3 py-1 bg-slate-200 text-slate-700 rounded-lg text-xs hover:bg-slate-300">Print</button>
        `;
        
        actions.querySelector(".view-btn").addEventListener("click", function() {
          openIDCardModal(student, parent);
        });
        
        actions.querySelector(".print-btn").addEventListener("click", function() {
          openIDCardModal(student, parent);
        });
        
        cardEl.appendChild(actions);
        grid.appendChild(cardEl);
      }
    }
    
    idStatus.textContent = `Showing ${activeIds.length} of ${ids.length} ID cards.`;
    
    // Filter function
    search.addEventListener("input", function() {
      const q = search.value.toLowerCase().trim();
      const cards = grid.querySelectorAll(":scope > div:not(:last-child)");
      
      for (const card of cards) {
        const studentName = card.querySelector(".id-card-front .font-bold")?.textContent?.toLowerCase() || "";
        const studentId = card.querySelector(".id-card-back .font-mono")?.textContent?.toLowerCase() || "";
        card.style.display = (studentName.includes(q) || studentId.includes(q)) ? "block" : "none";
      }
    });
    
  } catch (e) {
    idStatus.textContent = e?.message || "Failed to load ID cards.";
  }
}

// ============================================
// INITIALIZE
// ============================================

async function init() {
  const { error } = await initAdminPage();
  if (error) return;
  
  try {
    await render();
  } catch (e) {
    idStatus.textContent = e?.message || "Failed to initialize.";
  }
}

init();
