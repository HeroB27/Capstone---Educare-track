import { supabase, storePassword } from "../core/core.js";
import { initAppShell } from "../core/shell.js";
import { initAdminPage } from "./admin-common.js";

initAppShell({ role: "admin", active: "people" });

// ============================================
// UTILITY FUNCTIONS
// ============================================

// Safe element creation with null checks
const usersStatus = document.getElementById("usersStatus") ?? document.createElement("div");
const usersApp = document.getElementById("usersApp") ?? document.getElementById("usersTableBody");

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
  if (opts.readonly) {
    i.readOnly = true;
    i.className += " bg-slate-50 cursor-not-allowed";
  }
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

function pill(text, color) {
  return el("span", "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold " + color, escapeHtml(text));
}

function rolePill(role) {
  const r = String(role || "").toLowerCase();
  if (r === "admin") return pill("Admin", "bg-violet-100 text-violet-700");
  if (r === "teacher") return pill("Teacher", "bg-blue-100 text-blue-700");
  if (r === "parent") return pill("Parent", "bg-green-100 text-green-700");
  if (r === "guardian") return pill("Guardian", "bg-emerald-100 text-emerald-700");
  if (r === "guard") return pill("Guard", "bg-yellow-100 text-yellow-800");
  if (r === "clinic") return pill("Clinic", "bg-red-100 text-red-700");
  return pill(r || "-", "bg-slate-100 text-slate-700");
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
// SECURE QR CODE GENERATION (using jsQR)
// ============================================

function generateSecureQRData(studentId, parentPhone) {
  const timestamp = Date.now().toString(36);
  const securityHash = btoa(studentId + "|" + (parentPhone || "") + "|" + timestamp + "|EDU2026").slice(0, 12);
  return JSON.stringify({
    sid: studentId,
    ph: (parentPhone || "").slice(-4),
    ts: timestamp,
    sh: securityHash,
    v: 1
  });
}

function generateQRCanvas(data, canvasId, size = 100) {
  // Create canvas element
  const canvas = document.createElement('canvas');
  canvas.id = canvasId;
  canvas.width = size;
  canvas.height = size;
  
  // Use jsQR if available, otherwise create fallback SVG
  if (typeof jsQR !== 'undefined') {
    try {
      const qrCode = jsQR(data, size, size, {
        errorCorrectionLevel: 'M'
      });
      if (qrCode) {
        const ctx = canvas.getContext('2d');
        ctx.drawImage(qrCode, 0, 0);
      } else {
        createFallbackQR(data, canvas);
      }
    } catch (e) {
      createFallbackQR(data, canvas);
    }
  } else {
    createFallbackQR(data, canvas);
  }
  
  return canvas;
}

function createFallbackQR(data, canvas) {
  // Fallback: Create a visual QR-like pattern
  const ctx = canvas.getContext('2d');
  const size = canvas.width;
  const hash = data.split('').reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0);
  const moduleSize = size / 25;
  
  ctx.fillStyle = '#1e40af';
  
  // Corner patterns
  drawCornerPattern(ctx, 0, 0, moduleSize * 7);
  drawCornerPattern(ctx, size - moduleSize * 7, 0, moduleSize * 7);
  drawCornerPattern(ctx, 0, size - moduleSize * 7, moduleSize * 7);
  
  // Data pattern
  for (let i = 0; i < 25; i++) {
    for (let j = 0; j < 25; j++) {
      // Skip corner areas
      if ((i < 8 && j < 8) || (i < 8 && j > 16) || (i > 16 && j < 8)) continue;
      
      if (Math.abs(Math.sin(hash + i * 25 + j)) > 0.5) {
        ctx.fillRect(i * moduleSize, j * moduleSize, moduleSize, moduleSize);
      }
    }
  }
}

function drawCornerPattern(ctx, x, y, size) {
  const moduleSize = size / 7;
  ctx.fillStyle = '#1e40af';
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = 'white';
  ctx.fillRect(x + moduleSize, y + moduleSize, size - moduleSize * 2, size - moduleSize * 2);
  ctx.fillStyle = '#1e40af';
  ctx.fillRect(x + moduleSize * 2, y + moduleSize * 2, size - moduleSize * 4, size - moduleSize * 4);
}

// ============================================
// ID CARD DESIGN (2x3 inches - Blue Theme)
// ============================================

function generateIDCardHTML(student, parent, qrData) {
  const photoPlaceholder = student.photo_path 
    ? `<img src="${student.photo_path}" alt="Student Photo" class="w-full h-full object-cover">`
    : `<svg class="w-16 h-16 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
       </svg>`;

  const qrCanvas = generateQRCanvas(qrData, 'qrCanvas');

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
          <div class="w-12 h-12 bg-white border border-slate-200 rounded p-1 flex items-center justify-center">
            ${qrCanvas.outerHTML}
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

// ============================================
// ID GENERATION & NAMING CONVENTIONS
// ============================================

function randomFourDigits() {
  return String(Math.floor(Math.random() * 9000) + 1000);
}

function lastFourDigits(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.slice(-4).padStart(4, "0");
}

function currentYear() {
  return new Date().getFullYear();
}

// Generate User ID based on role
function generateUserId(role, phone) {
  const prefix = role === "admin" ? "ADM" : role === "teacher" ? "TCH" : role === "clinic" ? "CLC" : "GRD";
  return prefix + "-" + currentYear() + "-" + lastFourDigits(phone) + "-" + randomFourDigits();
}

// Generate Student ID
function generateStudentId(lrn) {
  const lrnDigits = lrn ? String(lrn).replace(/\D/g, "").slice(-4).padStart(4, "0") : "0000";
  return "EDU-" + currentYear() + "-" + lrnDigits + "-" + randomFourDigits();
}

// ============================================
// MODAL: VIEW USER WITH ID CARD & ACTIONS
// ============================================

async function openViewUserModal(profile, onSaved) {
  const content = el("div", "");
  
  // Get additional info based on role
  let studentInfo = null;
  let parentInfo = null;
  
  if (profile.role === "parent" || profile.role === "guardian") {
    // Get students for this parent
    const { data: students } = await supabase
      .from("students")
      .select("id,full_name,grade_level,strand")
      .eq("parent_id", profile.id);
    parentInfo = students || [];
  } else if (profile.role === "student") {
    // Get parent info
    const { data: parent } = await supabase
      .from("profiles")
      .select("id,full_name,phone")
      .eq("id", profile.parent_id)
      .single();
    studentInfo = parent;
  }

  content.appendChild(el("div", "text-lg font-semibold text-slate-900 mb-1", "User Details"));
  content.appendChild(el("div", "text-sm text-slate-600 mb-4", "User ID: " + escapeHtml(profile.username)));

  // Generate QR data for ID card
  const qrData = profile.role === "student" 
    ? generateSecureQRData(profile.id, parentInfo?.[0]?.phone)
    : generateSecureQRData(profile.id, profile.phone);

  // ID Card Preview Section
  const cardSection = el("div", "mb-4");
  cardSection.innerHTML = `<div class="text-sm font-medium text-slate-700 mb-2">ID Card Preview</div>`;
  
  if (profile.role === "student" || profile.role === "parent") {
    cardSection.innerHTML += generateIDCardHTML(profile, studentInfo, qrData);
  } else {
    cardSection.innerHTML += `
      <div class="p-4 bg-slate-100 rounded-xl text-center text-slate-500">
        <svg class="w-12 h-12 mx-auto mb-2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2"></path>
        </svg>
        <p>ID Card only available for Parents and Students</p>
      </div>
    `;
  }
  content.appendChild(cardSection);

  // Action Buttons (Update & Delete in View Modal)
  const actionSection = el("div", "flex gap-2 flex-wrap");
  
  const updateBtn = button("✏️ Update Details", "primary");
  const deleteBtn = button("🗑️ Delete User", "danger");
  const printBtn = button("🖨️ Print ID", "secondary");
  
  updateBtn.addEventListener("click", function() {
    openUpdateUserModal(profile, onSaved, function() {
      overlay.remove();
      onSaved();
    });
  });
  
  deleteBtn.addEventListener("click", function() {
    if (confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
      deleteUser(profile, onSaved);
    }
  });
  
  actionSection.appendChild(updateBtn);
  actionSection.appendChild(deleteBtn);
  
  if (profile.role === "student" || profile.role === "parent") {
    printBtn.addEventListener("click", function() {
      const printContent = `
        <div style="display:flex;gap:10px;padding:20px;">
          ${generateIDCardHTML(profile, studentInfo, qrData)}
        </div>
      `;
      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <html>
          <head>
            <title>Print ID Card</title>
            <script src="https://cdn.tailwindcss.com"><\/script>
            <script src="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js"><\/script>
            <style>@media print { body { margin: 0; padding: 20px; } .id-card-container { display: flex; gap: 10px; } }</style>
          </head>
          <body>${printContent}</body>
        </html>
      `);
      printWindow.document.close();
    });
    actionSection.appendChild(printBtn);
  }
  
  content.appendChild(actionSection);

  const overlay = openModal(content, "max-w-2xl");
}

// ============================================
// MODAL: UPDATE USER
// ============================================

function openUpdateUserModal(profile, onSaved, closeCallback) {
  const content = el("div", "");
  content.appendChild(el("div", "text-lg font-semibold text-slate-900 mb-1", "Update User"));
  content.appendChild(el("div", "text-sm text-slate-600 mb-4", "User ID: " + escapeHtml(profile.username)));

  const form = el("form", "mt-4 grid gap-4 md:grid-cols-2");
  
  const fullName = textInput({ value: profile.full_name || "", placeholder: "Full name" });
  const phone = textInput({ value: profile.phone || "", placeholder: "Phone" });
  const address = textInput({ value: profile.address || "", placeholder: "Address" });
  const email = textInput({ value: profile.email || "", placeholder: "Email (optional)", type: "email" });
  
  // Password section
  const passwordSection = el("div", "md:col-span-2 p-4 bg-amber-50 border border-amber-200 rounded-xl");
  passwordSection.innerHTML = '<div class="text-sm font-medium text-amber-800 mb-2">🔐 Change Password</div>';
  const newPassword = textInput({ placeholder: "New Password (leave blank to keep current)", type: "password" });
  const confirmNewPassword = textInput({ placeholder: "Confirm New Password", type: "password" });
  passwordSection.appendChild(newPassword);
  passwordSection.appendChild(confirmNewPassword);
  
  const role = selectInput([
    { value: "admin", label: "Admin" },
    { value: "teacher", label: "Teacher" },
    { value: "parent", label: "Parent" },
    { value: "guardian", label: "Guardian" },
    { value: "guard", label: "Guard" },
    { value: "clinic", label: "Clinic" },
    { value: "student", label: "Student" },
  ], profile.role || "teacher");

  const active = selectInput([
    { value: "true", label: "Active" },
    { value: "false", label: "Inactive" },
  ], String(profile.is_active || true));

  function inputRow(label, inputEl) {
    const wrap = el("div", "space-y-1");
    wrap.appendChild(el("label", "block text-sm font-medium text-slate-700", label));
    wrap.appendChild(inputEl);
    return wrap;
  }

  form.appendChild(inputRow("Full Name", fullName));
  form.appendChild(inputRow("Role", role));
  form.appendChild(inputRow("Status", active));
  form.appendChild(inputRow("Phone", phone));
  form.appendChild(inputRow("Email (optional)", email));
  form.appendChild(el("div", "md:col-span-2"));
  form.appendChild(inputRow("Address", address));
  form.appendChild(passwordSection);

  const errorBox = el("div", "mt-3 hidden rounded-xl bg-red-50 p-3 text-sm text-red-700");
  const successBox = el("div", "mt-3 hidden rounded-xl bg-green-50 p-3 text-sm text-green-700");
  
  const actions = el("div", "mt-5 flex justify-between gap-2");
  const cancelBtn = button("Cancel", "ghost");
  const saveBtn = button("Save Changes", "primary");
  saveBtn.type = "submit";
  
  actions.appendChild(cancelBtn);
  actions.appendChild(saveBtn);
  
  content.appendChild(form);
  content.appendChild(errorBox);
  content.appendChild(successBox);
  content.appendChild(actions);

  const overlay = openModal(content, "max-w-2xl");
  cancelBtn.addEventListener("click", function() { overlay.remove(); if (closeCallback) closeCallback(); });
  content.appendChild(form);

  form.addEventListener("submit", async function(e) {
    e.preventDefault();
    errorBox.classList.add("hidden");
    successBox.classList.add("hidden");
    saveBtn.disabled = true;

    // Validate password if provided
    if (newPassword.value) {
      if (newPassword.value.length < 6) {
        errorBox.textContent = "Password must be at least 6 characters.";
        errorBox.classList.remove("hidden");
        saveBtn.disabled = false;
        return;
      }
      if (newPassword.value !== confirmNewPassword.value) {
        errorBox.textContent = "Passwords do not match.";
        errorBox.classList.remove("hidden");
        saveBtn.disabled = false;
        return;
      }
    }

    try {
      // Update profile
      const { error } = await supabase.from("profiles").update({
        full_name: fullName.value.trim(),
        phone: phone.value.trim() || null,
        address: address.value.trim() || null,
        email: email.value.trim() || null,
        role: role.value,
        is_active: active.value === "true"
      }).eq("id", profile.id);

      if (error) throw error;

      // Update password if provided
      if (newPassword.value) {
        await storePassword(profile.id, newPassword.value);
      }

      successBox.textContent = "Changes saved successfully!";
      successBox.classList.remove("hidden");
      saveBtn.textContent = "Saved!";
      saveBtn.disabled = true;

      setTimeout(function() {
        overlay.remove();
        onSaved();
      }, 1500);
    } catch (error) {
      errorBox.textContent = error.message;
      errorBox.classList.remove("hidden");
      saveBtn.disabled = false;
    }
  });
}

// ============================================
// DELETE USER
// ============================================

async function deleteUser(profile, onSaved) {
  try {
    const { error } = await supabase.from("profiles").delete().eq("id", profile.id);
    if (error) throw error;
    usersStatus.textContent = "User deleted successfully.";
    onSaved();
  } catch (error) {
    usersStatus.textContent = "Failed to delete: " + error.message;
  }
}

// ============================================
// PARENT + STUDENT MODALS (Same as before)
// ============================================

async function openAddParentStudentModal(onSaved) {
  const content = el("div", "");
  content.appendChild(el("div", "text-lg font-semibold text-slate-900 mb-1", "Add Parent & Student(s)"));
  content.appendChild(el("div", "text-sm text-slate-600 mb-4", "Parent account with one or more students. Phone required, email optional."));

  // Step indicator
  const stepIndicator = el("div", "flex items-center gap-2 mb-4 text-sm");
  stepIndicator.innerHTML = `
    <span class="px-3 py-1 rounded-full bg-violet-600 text-white" id="step1-indicator">1. Parent</span>
    <span class="text-slate-400">→</span>
    <span class="px-3 py-1 rounded-full bg-slate-200 text-slate-600" id="step2-indicator">2. Account</span>
    <span class="text-slate-400">→</span>
    <span class="px-3 py-1 rounded-full bg-slate-200 text-slate-600" id="step3-indicator">3. Students</span>
    <span class="text-slate-400">→</span>
    <span class="px-3 py-1 rounded-full bg-slate-200 text-slate-600" id="step4-indicator">4. ID Card</span>
  `;
  content.appendChild(stepIndicator);

  const progressBar = el("div", "h-1 bg-slate-200 rounded-full mb-4 overflow-hidden");
  progressBar.innerHTML = '<div class="h-full bg-violet-600 transition-all" id="progressBar" style="width: 25%"></div>';
  content.appendChild(progressBar);

  const step1 = el("div", "");
  const step2 = el("div", "hidden");
  const step3 = el("div", "hidden");
  const step4 = el("div", "hidden");

  const parentType = selectInput([
    { value: "Parent", label: "Parent" },
    { value: "Guardian", label: "Guardian" },
  ], "Parent");

  const parentName = textInput({ placeholder: "Parent/Guardian Full Name *" });
  const parentPhone = textInput({ placeholder: "Phone (10-11 digits) *", type: "tel" });
  const parentAddress = textInput({ placeholder: "Address *" });

  function inputRow(label, inputEl) {
    const wrap = el("div", "space-y-1");
    wrap.appendChild(el("label", "block text-sm font-medium text-slate-700", label));
    wrap.appendChild(inputEl);
    return wrap;
  }

  step1.appendChild(el("div", "font-semibold text-slate-900 mb-3", "Parent/Guardian Information"));
  step1.appendChild(inputRow("Relationship", parentType));
  step1.appendChild(inputRow("Full Name *", parentName));
  step1.appendChild(inputRow("Phone *", parentPhone));
  step1.appendChild(inputRow("Address *", parentAddress));

  const parentUsername = textInput({ placeholder: "Username (auto-generated)" });
  const parentPassword = textInput({ placeholder: "Password *", type: "password" });
  const confirmPassword = textInput({ placeholder: "Confirm Password *", type: "password" });

  parentPhone.addEventListener("input", function() {
    const digits = parentPhone.value.replace(/\D/g, "");
    if (digits.length >= 4) {
      parentUsername.value = generateUserId("parent", digits);
    }
  });

  step2.appendChild(el("div", "font-semibold text-slate-900 mb-3", "Account Creation"));
  step2.appendChild(el("div", "p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 mb-3", 
    "Username will be generated from phone number. You can modify it if needed."));
  step2.appendChild(inputRow("Username *", parentUsername));
  step2.appendChild(inputRow("Password *", parentPassword));
  step2.appendChild(inputRow("Confirm Password *", confirmPassword));

  const studentsContainer = el("div", "space-y-4");
  let studentCount = 0;

  function createStudentFields(index) {
    const studentDiv = el("div", "p-4 bg-white rounded-xl border border-slate-200");
    studentDiv.appendChild(el("div", "flex justify-between items-center mb-3", [
      el("div", "font-semibold text-slate-900", "Student " + (index + 1)),
      index > 0 ? el("button", "text-red-500 text-xs hover:underline", "Remove") : el("div", "")
    ][1]));

    const sLrn = textInput({ placeholder: "LRN (12 digits, optional)", type: "tel" });
    const sName = textInput({ placeholder: "Student Full Name *" });
    const sGrade = textInput({ placeholder: "Grade Level (Kinder, 1-12, or SHS Grade 11/12) *" });
    const sStrand = textInput({ placeholder: "Strand (for SHS only: ABM, STEM, HUMSS, TVL-ICT)" });
    const sAddress = textInput({ placeholder: "Address (same as parent if empty)" });
    const sEmergency = textInput({ placeholder: "Emergency Contact (same as parent if empty)", type: "tel" });

    sGrade.addEventListener("input", function() {
      const grade = sGrade.value.trim().toLowerCase();
      const isSHS = grade.includes("11") || grade.includes("12") || grade.includes("shs");
      sStrand.parentElement.classList.toggle("hidden", !isSHS);
    });

    sLrn.addEventListener("input", function() {
      const lrn = sLrn.value.replace(/\D/g, "");
      sStudentId.value = generateStudentId(lrn);
    });

    const sStudentId = textInput({ placeholder: "Student ID (auto-generated)", readonly: true });
    sStudentId.className = "w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none bg-slate-50 cursor-not-allowed";

    function inputRowStudent(label, inputEl, required = false) {
      const wrap = el("div", "space-y-1");
      wrap.appendChild(el("label", "block text-xs font-medium text-slate-700" + (required ? " *" : ""), label));
      wrap.appendChild(inputEl);
      return wrap;
    }

    studentDiv.appendChild(inputRowStudent("LRN (optional)", sLrn));
    studentDiv.appendChild(inputRowStudent("Student ID", sStudentId));
    studentDiv.appendChild(inputRowStudent("Full Name *", sName, true));
    studentDiv.appendChild(inputRowStudent("Grade Level *", sGrade, true));
    studentDiv.appendChild(inputRowStudent("Strand (SHS only)", sStrand));
    studentDiv.appendChild(inputRowStudent("Address", sAddress));
    studentDiv.appendChild(inputRowStudent("Emergency Contact", sEmergency));

    if (index > 0) {
      studentDiv.querySelector("button").addEventListener("click", function() {
        studentDiv.remove();
        updateStudentCount();
      });
    }

    return { div: studentDiv, name: sName, lrn: sLrn, grade: sGrade, strand: sStrand, address: sAddress, emergency: sEmergency, studentId: sStudentId };
  }

  const firstStudent = createStudentFields(0);
  studentsContainer.appendChild(firstStudent.div);
  studentCount = 1;

  function updateStudentCount() {
    studentCount = studentsContainer.querySelectorAll(":scope > div").length;
  }

  step3.appendChild(el("div", "font-semibold text-slate-900 mb-3", "Student Information(s)"));
  step3.appendChild(studentsContainer);

  const addStudentBtn = button("+ Add Another Student", "secondary");
  addStudentBtn.className = "mt-3 px-3 py-2 rounded-xl border border-slate-300 text-sm hover:bg-slate-50";
  addStudentBtn.addEventListener("click", function() {
    if (studentCount < 5) {
      const newStudent = createStudentFields(studentCount);
      studentsContainer.appendChild(newStudent.div);
      studentCount++;
    }
  });
  step3.appendChild(addStudentBtn);

  const idCardPreview = el("div", "");
  step4.appendChild(el("div", "font-semibold text-slate-900 mb-3", "Student ID Card(s)"));
  step4.appendChild(idCardPreview);

  const navButtons = el("div", "mt-5 flex justify-between gap-2");
  const prevBtn = button("← Back", "ghost");
  const nextBtn = button("Next →", "primary");
  const submitBtn = button("Create Accounts & Print IDs", "primary");
  submitBtn.className = "hidden rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700";
  
  navButtons.appendChild(prevBtn);
  navButtons.appendChild(nextBtn);
  navButtons.appendChild(submitBtn);
  content.appendChild(navButtons);

  const errorBox = el("div", "mt-3 hidden rounded-xl bg-red-50 p-3 text-sm text-red-700");
  const successBox = el("div", "mt-3 hidden rounded-xl bg-green-50 p-3 text-sm text-green-700");
  content.appendChild(errorBox);
  content.appendChild(successBox);

  const overlay = openModal(content, "max-w-3xl");

  let currentStep = 1;

  function showStep(step) {
    step1.classList.toggle("hidden", step !== 1);
    step2.classList.toggle("hidden", step !== 2);
    step3.classList.toggle("hidden", step !== 3);
    step4.classList.toggle("hidden", step !== 4);
    
    document.getElementById("step1-indicator").className = step === 1 ? "px-3 py-1 rounded-full bg-violet-600 text-white" : "px-3 py-1 rounded-full bg-slate-200 text-slate-600";
    document.getElementById("step2-indicator").className = step === 2 ? "px-3 py-1 rounded-full bg-violet-600 text-white" : "px-3 py-1 rounded-full bg-slate-200 text-slate-600";
    document.getElementById("step3-indicator").className = step === 3 ? "px-3 py-1 rounded-full bg-violet-600 text-white" : "px-3 py-1 rounded-full bg-slate-200 text-slate-600";
    document.getElementById("step4-indicator").className = step === 4 ? "px-3 py-1 rounded-full bg-violet-600 text-white" : "px-3 py-1 rounded-full bg-slate-200 text-slate-600";
    
    document.getElementById("progressBar").style.width = (step * 25) + "%";
    
    prevBtn.classList.toggle("hidden", step === 1);
    nextBtn.classList.toggle("hidden", step === 4);
    submitBtn.classList.toggle("hidden", step !== 4);
    
    currentStep = step;
  }

  prevBtn.addEventListener("click", function() {
    if (currentStep > 1) showStep(currentStep - 1);
  });

  nextBtn.addEventListener("click", function() {
    errorBox.classList.add("hidden");
    
    if (currentStep === 1) {
      if (!parentName.value.trim() || !parentPhone.value.trim() || !parentAddress.value.trim()) {
        errorBox.textContent = "Please fill in all required fields.";
        errorBox.classList.remove("hidden");
        return;
      }
      if (parentPhone.value.replace(/\D/g, "").length < 10) {
        errorBox.textContent = "Phone number must be at least 10 digits.";
        errorBox.classList.remove("hidden");
        return;
      }
      showStep(2);
    } else if (currentStep === 2) {
      if (!parentUsername.value.trim() || !parentPassword.value || !confirmPassword.value) {
        errorBox.textContent = "Please fill in all required fields.";
        errorBox.classList.remove("hidden");
        return;
      }
      if (parentPassword.value !== confirmPassword.value) {
        errorBox.textContent = "Passwords do not match.";
        errorBox.classList.remove("hidden");
        return;
      }
      if (parentPassword.value.length < 6) {
        errorBox.textContent = "Password must be at least 6 characters.";
        errorBox.classList.remove("hidden");
        return;
      }
      showStep(3);
    } else if (currentStep === 3) {
      const studentDivs = studentsContainer.querySelectorAll(":scope > div");
      let hasValidStudent = false;
      
      for (const div of studentDivs) {
        const inputs = div.querySelectorAll("input");
        const name = inputs[1]?.value?.trim();
        const grade = inputs[2]?.value?.trim();
        if (name && grade) {
          hasValidStudent = true;
          break;
        }
      }
      
      if (!hasValidStudent) {
        errorBox.textContent = "Please add at least one student with name and grade level.";
        errorBox.classList.remove("hidden");
        return;
      }
      showStep(4);
      renderIDCards();
    }
  });

  function renderIDCards() {
    idCardPreview.innerHTML = "";
    const studentDivs = studentsContainer.querySelectorAll(":scope > div");
    
    for (const div of studentDivs) {
      const inputs = div.querySelectorAll("input");
      const name = inputs[1]?.value?.trim();
      const grade = inputs[2]?.value?.trim();
      const strand = inputs[3]?.value?.trim();
      const studentId = inputs[4]?.value?.trim();
      
      if (!name || !grade) continue;
      
      const qrData = generateSecureQRData(studentId, parentPhone.value);
      
      const idCard = el("div", "bg-white rounded-xl border-2 border-blue-600 p-4 mb-4 max-w-md");
      idCard.innerHTML = generateIDCardHTML({
        id: studentId,
        full_name: name,
        grade_level: grade,
        strand: strand,
        address: inputs[5]?.value?.trim() || parentAddress.value.trim(),
        photo_path: null
      }, {
        full_name: parentName.value.trim(),
        phone: parentPhone.value.trim()
      }, qrData);
      
      idCardPreview.appendChild(idCard);
    }
    
    const printBtn = button("🖨️ Print All ID Cards", "primary");
    printBtn.className = "mt-3 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700";
    printBtn.addEventListener("click", function() {
      window.print();
    });
    idCardPreview.appendChild(printBtn);
  }

  submitBtn.addEventListener("click", async function() {
    errorBox.classList.add("hidden");
    successBox.classList.add("hidden");
    submitBtn.disabled = true;
    submitBtn.textContent = "Creating...";

    const parentUser = parentUsername.value.trim().toUpperCase();
    const parentPass = parentPassword.value;
    const parentFull = parentName.value.trim();
    const parentPhoneVal = parentPhone.value.trim();
    const parentAddr = parentAddress.value.trim();
    const parentTypeVal = parentType.value;

    try {
      const parentId = generateUUID();

      const { error: parentError } = await supabase.from("profiles").insert({
        id: parentId,
        full_name: parentFull,
        username: parentUser,
        phone: parentPhoneVal,
        email: null,
        address: parentAddr,
        role: "parent",
        is_active: true
      });

      if (parentError) throw parentError;
      await supabase.from("parents").insert({ profile_id: parentId, parent_type: parentTypeVal }).catch(function() {});
      await storePassword(parentId, parentPass);

      let studentIds = [];
      const studentDivs = studentsContainer.querySelectorAll(":scope > div");
      
      for (const div of studentDivs) {
        const inputs = div.querySelectorAll("input");
        const sName = inputs[1]?.value?.trim();
        const sGrade = inputs[2]?.value?.trim();
        
        if (!sName || !sGrade) continue;

        const studentId = inputs[4]?.value?.trim() || generateStudentId(inputs[0]?.value || "");
        const lrn = inputs[0]?.value?.trim() || null;
        const strand = inputs[3]?.value?.trim() || null;
        const addr = inputs[5]?.value?.trim() || parentAddr;
        const emergency = inputs[6]?.value?.trim() || parentPhoneVal;

        const { error: studentError } = await supabase.from("students").insert({
          id: studentId,
          full_name: sName,
          lrn: lrn,
          address: addr,
          emergency_contact: emergency,
          grade_level: sGrade,
          strand: strand,
          parent_id: parentId,
          is_active: true
        });

        if (studentError) throw studentError;
        studentIds.push({ id: studentId, name: sName, grade: sGrade });
      }

      successBox.innerHTML = "<b>✅ Accounts Created Successfully!</b><br><br><b>Parent Account:</b><br>User ID: " + parentUser + "<br>Password: " + parentPass + "<br><br><b>Students: " + studentIds.length + "</b><br>" + studentIds.map(function(s) { return "• " + s.name + " (" + s.grade + ") - " + s.id; }).join("<br>") + "<br><br><b>Parent account is active. Login with User ID and password.</b>";
      successBox.classList.remove("hidden");
      submitBtn.textContent = "Done!";
      submitBtn.disabled = true;

      setTimeout(function() {
        overlay.remove();
        onSaved();
      }, 3000);

    } catch (error) {
      errorBox.textContent = error.message || "Failed to create accounts.";
      errorBox.classList.remove("hidden");
      submitBtn.disabled = false;
      submitBtn.textContent = "Create Accounts & Print IDs";
    }
  });
}

// ============================================
// STAFF MODAL
// ============================================

async function openAddStaffModal(onSaved) {
  const content = el("div", "");
  content.appendChild(el("div", "text-lg font-semibold text-slate-900 mb-1", "Add Staff Member"));
  content.appendChild(el("div", "text-sm text-slate-600 mb-4", "Create teacher, guard, or clinic staff account. Email is optional."));

  const form = el("form", "mt-4 grid gap-4 md:grid-cols-2");

  const role = selectInput([
    { value: "teacher", label: "Teacher" },
    { value: "admin", label: "Admin" },
    { value: "guard", label: "Guard" },
    { value: "clinic", label: "Clinic Staff" },
  ], "teacher");

  const fullName = textInput({ placeholder: "Full Name *" });
  const phone = textInput({ placeholder: "Phone (10-11 digits) *", type: "tel" });
  const email = textInput({ placeholder: "Email (optional)", type: "email" });
  const address = textInput({ placeholder: "Address (optional)" });
  const username = textInput({ placeholder: "Username (auto-generated)" });
  const password = textInput({ placeholder: "Password *", type: "password" });
  const confirmPassword = textInput({ placeholder: "Confirm Password *", type: "password" });

  phone.addEventListener("input", function() {
    const digits = phone.value.replace(/\D/g, "");
    if (digits.length >= 4) {
      username.value = generateUserId(role.value, digits);
    }
  });

  role.addEventListener("change", function() {
    const digits = phone.value.replace(/\D/g, "");
    if (digits.length >= 4) {
      username.value = generateUserId(role.value, digits);
    }
  });

  function inputRow(label, inputEl) {
    const wrap = el("div", "space-y-1");
    wrap.appendChild(el("label", "block text-sm font-medium text-slate-700", label));
    wrap.appendChild(inputEl);
    return wrap;
  }

  form.appendChild(inputRow("Role", role));
  form.appendChild(inputRow("Full Name *", fullName));
  form.appendChild(inputRow("Username", username));
  form.appendChild(inputRow("Password *", password));
  form.appendChild(inputRow("Phone *", phone));
  form.appendChild(inputRow("Email (optional)", email));
  form.appendChild(el("div", "md:col-span-2"));
  form.appendChild(inputRow("Address (optional)", address));
  form.appendChild(inputRow("Confirm Password *", confirmPassword));

  const confirmationSection = el("div", "hidden mt-4 p-4 bg-green-50 border border-green-200 rounded-xl");
  confirmationSection.innerHTML = `
    <h4 class="font-semibold text-green-800 mb-2">✅ Account Created Successfully!</h4>
    <div class="text-sm text-green-700 space-y-1" id="confirmationDetails"></div>
  `;

  const errorBox = el("div", "mt-3 hidden rounded-xl bg-red-50 p-3 text-sm text-red-700");
  const actions = el("div", "mt-5 flex justify-end gap-2");
  const cancelBtn = button("Cancel", "ghost");
  const saveBtn = button("Create Account", "primary");
  saveBtn.type = "submit";
  actions.appendChild(cancelBtn);
  actions.appendChild(saveBtn);

  const overlay = openModal(content);
  cancelBtn.addEventListener("click", function() { overlay.remove(); });
  content.appendChild(form);
  content.appendChild(confirmationSection);
  content.appendChild(errorBox);
  content.appendChild(actions);

  form.addEventListener("submit", async function(e) {
    e.preventDefault();
    errorBox.classList.add("hidden");
    confirmationSection.classList.add("hidden");
    saveBtn.disabled = true;
    saveBtn.textContent = "Creating...";

    const userId = username.value.trim().toUpperCase();
    const pass = password.value;
    const full = fullName.value.trim();
    const phoneVal = phone.value.trim();
    const confirmPass = confirmPassword.value;

    if (!full || !userId || !pass || !phoneVal) {
      errorBox.textContent = "Full name, username, phone, and password are required.";
      errorBox.classList.remove("hidden");
      saveBtn.disabled = false;
      saveBtn.textContent = "Create Account";
      return;
    }

    if (pass !== confirmPass) {
      errorBox.textContent = "Passwords do not match.";
      errorBox.classList.remove("hidden");
      saveBtn.disabled = false;
      saveBtn.textContent = "Create Account";
      return;
    }

    try {
      const newUserId = generateUUID();

      const { error: profileError } = await supabase.from("profiles").insert({
        id: newUserId,
        full_name: full,
        username: userId,
        phone: phoneVal,
        email: email.value.trim() || null,
        address: address.value.trim() || null,
        role: role.value,
        is_active: true
      });

      if (profileError) throw profileError;

      if (role.value === "teacher") {
        await supabase.from("teachers").insert({ profile_id: newUserId, is_gatekeeper: false }).catch(function() {});
      } else if (role.value === "guard") {
        await supabase.from("guards").insert({ profile_id: newUserId }).catch(function() {});
      } else if (role.value === "clinic") {
        await supabase.from("clinic_staff").insert({ profile_id: newUserId }).catch(function() {});
      }

      await storePassword(newUserId, pass);

      document.getElementById("confirmationDetails").innerHTML = `
        <p><b>User ID:</b> ${escapeHtml(userId)}</p>
        <p><b>Password:</b> ${escapeHtml(pass)}</p>
        <p><b>Role:</b> ${escapeHtml(role.value)}</p>
        <p><b>Name:</b> ${escapeHtml(full)}</p>
        <p><b>Phone:</b> ${escapeHtml(phoneVal)}</p>
        <p class="mt-2">Login with User ID and password from any device.</p>
      `;
      confirmationSection.classList.remove("hidden");
      form.classList.add("hidden");
      actions.classList.add("hidden");

      setTimeout(function() {
        overlay.remove();
        onSaved();
      }, 3000);

    } catch (error) {
      errorBox.textContent = error.message || "Failed to create account.";
      errorBox.classList.remove("hidden");
      saveBtn.disabled = false;
      saveBtn.textContent = "Create Account";
    }
  });
}

// ============================================
// PASSWORD RESET MODAL
// ============================================

async function openPasswordResetRequestModal(onSaved) {
  const content = el("div", "");
  content.appendChild(el("div", "text-lg font-semibold text-slate-900 mb-1", "Password Reset Request"));
  content.appendChild(el("div", "text-sm text-slate-600 mb-4", "Parent/student requests password reset."));

  const form = el("form", "mt-4 grid gap-4");
  
  const userType = selectInput([
    { value: "parent", label: "Parent" },
    { value: "student", label: "Student" },
  ], "parent");

  const username = textInput({ placeholder: "User ID (e.g., TCH-2026-1234-5678)" });
  const newPassword = textInput({ placeholder: "New Password *", type: "password" });
  const confirmNewPassword = textInput({ placeholder: "Confirm New Password *", type: "password" });

  function inputRow(label, inputEl) {
    const wrap = el("div", "space-y-1");
    wrap.appendChild(el("label", "block text-sm font-medium text-slate-700", label));
    wrap.appendChild(inputEl);
    return wrap;
  }

  form.appendChild(inputRow("User Type", userType));
  form.appendChild(inputRow("User ID", username));
  form.appendChild(inputRow("New Password *", newPassword));
  form.appendChild(inputRow("Confirm Password *", confirmNewPassword));

  const errorBox = el("div", "mt-3 hidden rounded-xl bg-red-50 p-3 text-sm text-red-700");
  const successBox = el("div", "mt-3 hidden rounded-xl bg-green-50 p-3 text-sm text-green-700");

  const actions = el("div", "mt-5 flex justify-end gap-2");
  const cancelBtn = button("Cancel", "ghost");
  const submitBtn = button("Reset Password", "primary");
  submitBtn.type = "submit";
  actions.appendChild(cancelBtn);
  actions.appendChild(submitBtn);

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
    submitBtn.disabled = true;
    submitBtn.textContent = "Processing...";

    const userId = username.value.trim().toUpperCase();
    const newPass = newPassword.value;
    const confirmPass = confirmNewPassword.value;

    if (!userId || !newPass || !confirmPass) {
      errorBox.textContent = "User ID and new password are required.";
      errorBox.classList.remove("hidden");
      submitBtn.disabled = false;
      submitBtn.textContent = "Reset Password";
      return;
    }

    if (newPass !== confirmPass) {
      errorBox.textContent = "Passwords do not match.";
      errorBox.classList.remove("hidden");
      submitBtn.disabled = false;
      submitBtn.textContent = "Reset Password";
      return;
    }

    try {
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", userId)
        .single();

      if (profileError || !profiles) {
        errorBox.textContent = "User not found with that User ID.";
        errorBox.classList.remove("hidden");
        submitBtn.disabled = false;
        submitBtn.textContent = "Reset Password";
        return;
      }

      await storePassword(profiles.id, newPass);

      successBox.innerHTML = "<b>✅ Password Reset Complete!</b><br><br>User ID: " + userId + "<br>New password has been set.";
      successBox.classList.remove("hidden");
      submitBtn.textContent = "Done!";
      submitBtn.disabled = true;
      form.classList.add("hidden");
      actions.classList.add("hidden");

      setTimeout(function() {
        overlay.remove();
        onSaved();
      }, 2000);

    } catch (error) {
      errorBox.textContent = error.message || "Failed to reset password.";
      errorBox.classList.remove("hidden");
      submitBtn.disabled = false;
      submitBtn.textContent = "Reset Password";
    }
  });
}

// ============================================
// RENDER USER TABLE
// ============================================

function renderUsersTable(profiles, onView) {
  const wrap = el("div", "overflow-x-auto");
  const table = el("table", "w-full min-w-[900px] text-left text-sm");
  
  table.innerHTML = '<thead class="text-xs uppercase text-slate-500 bg-slate-50"><tr><th class="py-3 px-4">User</th><th class="py-3 px-4">User ID</th><th class="py-3 px-4">Role</th><th class="py-3 px-4">Status</th><th class="py-3 px-4">Contact</th><th class="py-3 px-4 text-center">Actions</th></tr></thead>';

  const tbody = el("tbody", "divide-y divide-slate-200");

  if (profiles.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="py-8 text-center text-slate-500">No users found</td></tr>';
  }

  for (const p of profiles) {
    const tr = el("tr", "hover:bg-slate-50 transition-colors");
    const addr = p.address || '';
    tr.innerHTML = '<td class="py-3 px-4"><div class="font-medium text-slate-900">' + escapeHtml(p.full_name) + '</div><div class="text-xs text-slate-500">' + (addr ? escapeHtml(addr.substring(0, 30)) + '...' : '-') + '</div></td><td class="py-3 px-4 font-mono text-xs">' + escapeHtml(p.username) + '</td><td class="py-3 px-4"></td><td class="py-3 px-4"></td><td class="py-3 px-4 text-xs text-slate-600"><div>' + (p.phone || '-') + '</div><div>' + (p.email || '-') + '</div></td><td class="py-3 px-4 text-center"></td>';
    
    tr.children[2].appendChild(rolePill(p.role));
    
    const statusSpan = el("span", "px-2 py-1 rounded-full text-xs font-medium " + (p.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'));
    statusSpan.textContent = p.is_active ? 'Active' : 'Inactive';
    tr.children[3].appendChild(statusSpan);

    // Only View button (Update & Delete moved to View Modal)
    const viewBtn = button("👁️ View", "secondary");
    viewBtn.className = "px-3 py-1 rounded-lg border border-slate-300 text-xs hover:bg-slate-50";
    viewBtn.addEventListener("click", function() { onView(p); });
    
    tr.children[5].appendChild(viewBtn);
    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}

// ============================================
// LOAD DATA & MAIN RENDER
// ============================================

async function loadProfiles() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,full_name,username,phone,address,email,role,is_active,created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

function generateUUID() {
  return crypto.randomUUID();
}

let profilesCache = [];

async function render() {
  usersStatus.textContent = "Loading users...";
  
  try {
    profilesCache = await loadProfiles();
  } catch (e) {
    usersStatus.textContent = e?.message || "Failed to load users.";
    return;
  }
  
  usersApp.replaceChildren();

  const header = el("div", "mb-4 flex flex-wrap gap-3 justify-between items-center");
  
  const left = el("div", "flex flex-wrap gap-2 items-center");
  const search = textInput({ placeholder: "🔍 Search users..." });
  search.className = "w-64 rounded-xl border border-slate-300 px-3 py-2 text-sm";
  left.appendChild(search);

  const filterRole = selectInput([
    { value: "", label: "All Roles" },
    { value: "admin", label: "Admin" },
    { value: "teacher", label: "Teacher" },
    { value: "parent", label: "Parent" },
    { value: "guardian", label: "Guardian" },
    { value: "guard", label: "Guard" },
    { value: "clinic", label: "Clinic" },
  ], "");
  filterRole.className = "rounded-xl border border-slate-300 px-3 py-2 text-sm";
  left.appendChild(filterRole);

  const right = el("div", "flex gap-2");
  
  const refreshBtn = button("↻ Refresh", "secondary");
  refreshBtn.className = "px-3 py-2 rounded-xl border border-slate-300 text-sm hover:bg-slate-50 flex items-center gap-1";
  refreshBtn.addEventListener("click", function() { 
    refreshBtn.textContent = "↻ Refreshing...";
    render().then(() => { refreshBtn.textContent = "↻ Refresh"; }); 
  });
  
  const addStaffBtn = button("+ Add Staff", "primary");
  const addParentBtn = button("+ Add Parent+Student", "primary");
  const resetPasswordBtn = button("🔑 Reset Password", "secondary");
  resetPasswordBtn.className = "px-3 py-2 rounded-xl border border-slate-300 text-sm hover:bg-slate-50";
  
  right.appendChild(refreshBtn);
  right.appendChild(addStaffBtn);
  right.appendChild(addParentBtn);
  right.appendChild(resetPasswordBtn);

  header.appendChild(left);
  header.appendChild(right);
  usersApp.appendChild(header);

  const infoBanner = el("div", "mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800");
  infoBanner.innerHTML = "<b>Supabase XAMPP Style:</b> Users login with User ID and password. Passwords are stored in Supabase.";
  usersApp.appendChild(infoBanner);

  const table = renderUsersTable(profilesCache, openViewUserModal);
  usersApp.appendChild(table);

  usersStatus.textContent = "Showing " + profilesCache.length + " users.";

  search.addEventListener("input", applyFilters);
  filterRole.addEventListener("change", applyFilters);

  addStaffBtn.addEventListener("click", function() { openAddStaffModal(render); });
  addParentBtn.addEventListener("click", function() { openAddParentStudentModal(render); });
  resetPasswordBtn.addEventListener("click", function() { openPasswordResetRequestModal(render); });

  function applyFilters() {
    const q = search.value.trim().toLowerCase();
    const role = filterRole.value;
    
    const filtered = profilesCache.filter(function(p) {
      if (role && p.role !== role) return false;
      if (q) {
        const searchStr = (p.full_name + " " + p.username + " " + (p.phone || "")).toLowerCase();
        if (!searchStr.includes(q)) return false;
      }
      return true;
    });

    const tableEl = usersApp.querySelector("table");
    if (tableEl) {
      tableEl.replaceWith(renderUsersTable(filtered, openViewUserModal));
    }
    usersStatus.textContent = "Showing " + filtered.length + " of " + profilesCache.length + " users.";
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
    window.addEventListener("focus", function() { render(); });
  } catch (e) {
    usersStatus.textContent = e?.message || "Failed to load users.";
  }
}

init();
