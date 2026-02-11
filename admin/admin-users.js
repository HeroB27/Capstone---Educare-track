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
// ADM-currentyear-last4digitsPhone-XXXX
// TCH-currentyear-last4digitsPhone-XXXX
// CLC-currentyear-last4digitsPhone-XXXX
// GRD-currentyear-last4digitsPhone-XXXX
function generateUserId(role, phone) {
  const prefix = role === "admin" ? "ADM" : role === "teacher" ? "TCH" : role === "clinic" ? "CLC" : "GRD";
  return prefix + "-" + currentYear() + "-" + lastFourDigits(phone) + "-" + randomFourDigits();
}

// Generate Student ID
// EDU-currentyear-last4digitsLRN-XXXX
function generateStudentId(lrn) {
  const lrnDigits = lrn ? String(lrn).replace(/\D/g, "").slice(-4).padStart(4, "0") : "0000";
  return "EDU-" + currentYear() + "-" + lrnDigits + "-" + randomFourDigits();
}

// Generate QR data with security
function generateQRData(studentId, parentPhone) {
  const timestamp = Date.now().toString(36);
  const securityHash = btoa(studentId + parentPhone + timestamp).slice(0, 8);
  return JSON.stringify({
    sid: studentId,
    ph: parentPhone.slice(-4),
    ts: timestamp,
    sh: securityHash
  });
}

// ============================================
// MODAL: ADD PARENT + STUDENT(S)
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

  // Progress bar
  const progressBar = el("div", "h-1 bg-slate-200 rounded-full mb-4 overflow-hidden");
  progressBar.innerHTML = '<div class="h-full bg-violet-600 transition-all" id="progressBar" style="width: 25%"></div>';
  content.appendChild(progressBar);

  // Step containers
  const step1 = el("div", ""); // Parent Info
  const step2 = el("div", "hidden"); // Account Creation
  const step3 = el("div", "hidden"); // Students Info
  const step4 = el("div", "hidden"); // ID Card Preview

  // STEP 1: Parent Information
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

  // STEP 2: Account Creation
  const parentUsername = textInput({ placeholder: "Username (auto-generated)" });
  const parentPassword = textInput({ placeholder: "Password *", type: "password" });
  const confirmPassword = textInput({ placeholder: "Confirm Password *", type: "password" });

  // Auto-generate username on phone change
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

  // STEP 3: Students Information
  const studentsContainer = el("div", "space-y-4");
  let studentCount = 0;

  function createStudentFields(index) {
    const studentDiv = el("div", "p-4 bg-white rounded-xl border border-slate-200");
    studentDiv.appendChild(el("div", "flex justify-between items-center mb-3", [
      el("div", "font-semibold text-slate-900", "Student " + (index + 1)),
      index > 0 ? el("button", "text-red-500 text-xs hover:underline", "Remove") : el("div", "")
    ][1]));

    // Auto-generate student ID on LRN change
    const sLrn = textInput({ placeholder: "LRN (12 digits, optional)", type: "tel" });
    const sName = textInput({ placeholder: "Student Full Name *" });
    const sGrade = textInput({ placeholder: "Grade Level (Kinder, 1-12, or SHS Grade 11/12) *" });
    const sStrand = textInput({ placeholder: "Strand (for SHS only: ABM, STEM, HUMSS, TVL-ICT)" });
    const sAddress = textInput({ placeholder: "Address (same as parent if empty)" });
    const sEmergency = textInput({ placeholder: "Emergency Contact (same as parent if empty)", type: "tel" });

    // Show strand field only for SHS grades
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
    sStudentId.className = "w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none bg-slate-50";

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

    // Remove button for additional students
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

  // STEP 4: ID Card Preview
  const idCardPreview = el("div", "");
  step4.appendChild(el("div", "font-semibold text-slate-900 mb-3", "Student ID Card(s)"));
  step4.appendChild(idCardPreview);

  // Navigation buttons
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

  // Step management
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
      // Validate step 1
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
      // Validate step 2
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
      // Validate step 3 - at least one student
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
      
      const qrData = generateQRData(studentId, parentPhone.value);
      
      const idCard = el("div", "bg-white rounded-xl border-2 border-slate-200 p-4 mb-4 max-w-md");
      idCard.innerHTML = `
        <div class="flex items-center gap-4">
          <div class="w-20 h-20 bg-slate-100 rounded-lg flex items-center justify-center">
            <svg class="w-16 h-16 text-slate-300" viewBox="0 0 100 100">
              <rect x="5" y="5" width="90" height="90" rx="5" fill="white" stroke="#e2e8f0" stroke-width="2"/>
              <rect x="15" y="15" width="70" height="25" rx="2" fill="#6366f1"/>
              <rect x="15" y="45" width="70" height="15" rx="1" fill="#e2e8f0"/>
              <rect x="15" y="65" width="50" height="10" rx="1" fill="#e2e8f0"/>
              <rect x="15" y="80" width="35" height="8" rx="1" fill="#e2e8f0"/>
              <text x="50" y="32" text-anchor="middle" font-size="8" font-weight="bold" fill="white">${escapeHtml(studentId)}</text>
            </svg>
          </div>
          <div class="flex-1">
            <p class="font-bold text-slate-900">${escapeHtml(name)}</p>
            <p class="text-sm text-slate-600">${escapeHtml(grade)}${strand ? ' - ' + escapeHtml(strand) : ''}</p>
            <p class="text-xs text-slate-500 mt-1">Parent: ${escapeHtml(parentName.value)}</p>
            <p class="text-xs text-slate-500">Phone: ${escapeHtml(parentPhone.value)}</p>
          </div>
        </div>
      `;
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

      // Create parent profile
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

      // Store password
      await storePassword(parentId, parentPass);

      // Create students
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
// MODAL: ADD STAFF (Teacher, Clinic, Guard)
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

  // Auto-generate username on phone change
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

  // Confirmation section (hidden initially)
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

    if (phoneVal.replace(/\D/g, "").length < 10) {
      errorBox.textContent = "Phone number must be at least 10 digits.";
      errorBox.classList.remove("hidden");
      saveBtn.disabled = false;
      saveBtn.textContent = "Create Account";
      return;
    }

    try {
      const newUserId = generateUUID();

      // Create profile directly in Supabase
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

      // Create role-specific record
      if (role.value === "teacher") {
        await supabase.from("teachers").insert({ profile_id: newUserId, is_gatekeeper: false }).catch(function() {});
      } else if (role.value === "guard") {
        await supabase.from("guards").insert({ profile_id: newUserId }).catch(function() {});
      } else if (role.value === "clinic") {
        await supabase.from("clinic_staff").insert({ profile_id: newUserId }).catch(function() {});
      }

      // Store password in Supabase
      await storePassword(newUserId, pass);

      // Show confirmation
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
// MODAL: PASSWORD RESET REQUEST
// ============================================

async function openPasswordResetRequestModal(onSaved) {
  const content = el("div", "");
  content.appendChild(el("div", "text-lg font-semibold text-slate-900 mb-1", "Password Reset Request"));
  content.appendChild(el("div", "text-sm text-slate-600 mb-4", "Parent/student requests password reset. Admin will be notified."));

  const form = el("form", "mt-4 grid gap-4");
  
  const userType = selectInput([
    { value: "parent", label: "Parent" },
    { value: "student", label: "Student" },
  ], "parent");

  const username = textInput({ placeholder: "User ID (e.g., TCH-2026-1234-5678)" });
  const requestReason = textInput({ placeholder: "Reason for reset (e.g., Forgot password)" });
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
  form.appendChild(inputRow("Reason", requestReason));
  form.appendChild(inputRow("New Password *", newPassword));
  form.appendChild(inputRow("Confirm Password *", confirmNewPassword));

  const errorBox = el("div", "mt-3 hidden rounded-xl bg-red-50 p-3 text-sm text-red-700");
  const successBox = el("div", "mt-3 hidden rounded-xl bg-green-50 p-3 text-sm text-green-700");

  const actions = el("div", "mt-5 flex justify-end gap-2");
  const cancelBtn = button("Cancel", "ghost");
  const submitBtn = button("Submit Request", "primary");
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
    submitBtn.textContent = "Submitting...";

    const userId = username.value.trim().toUpperCase();
    const newPass = newPassword.value;
    const confirmPass = confirmNewPassword.value;

    if (!userId || !newPass || !confirmPass) {
      errorBox.textContent = "User ID and new password are required.";
      errorBox.classList.remove("hidden");
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit Request";
      return;
    }

    if (newPass !== confirmPass) {
      errorBox.textContent = "Passwords do not match.";
      errorBox.classList.remove("hidden");
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit Request";
      return;
    }

    if (newPass.length < 6) {
      errorBox.textContent = "Password must be at least 6 characters.";
      errorBox.classList.remove("hidden");
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit Request";
      return;
    }

    try {
      // Find profile by username
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", userId)
        .single();

      if (profileError || !profiles) {
        errorBox.textContent = "User not found with that User ID.";
        errorBox.classList.remove("hidden");
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit Request";
        return;
      }

      // Update password
      await storePassword(profiles.id, newPass);

      // Log the reset request
      await supabase.from("password_resets").insert({
        profile_id: profiles.id,
        username: userId,
        user_type: userType.value,
        reason: requestReason.value.trim() || "Forgot password",
        requested_at: new Date().toISOString(),
        status: "completed"
      }).catch(function() {});

      successBox.innerHTML = "<b>✅ Password Reset Complete!</b><br><br>User ID: " + userId + "<br>New password has been set.<br><br>User can now login with the new password.";
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
      submitBtn.textContent = "Submit Request";
    }
  });
}

// ============================================
// MODAL: EDIT PROFILE
// ============================================

function openEditProfileModal(profile, onSaved) {
  const content = el("div", "");
  content.appendChild(el("div", "text-lg font-semibold text-slate-900", "Edit User"));
  content.appendChild(el("div", "mt-1 text-sm text-slate-600", "ID: " + escapeHtml(profile.username)));

  const form = el("form", "mt-4 grid gap-4 md:grid-cols-2");
  const fullName = textInput({ value: profile.full_name || "", placeholder: "Full name" });
  const phone = textInput({ value: profile.phone || "", placeholder: "Phone" });
  const address = textInput({ value: profile.address || "", placeholder: "Address" });
  const email = textInput({ value: profile.email || "", placeholder: "Email (optional)" });
  
  const role = selectInput([
    { value: "admin", label: "Admin" },
    { value: "teacher", label: "Teacher" },
    { value: "parent", label: "Parent" },
    { value: "guardian", label: "Guardian" },
    { value: "guard", label: "Guard" },
    { value: "clinic", label: "Clinic" },
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
  form.appendChild(inputRow("Active", active));
  form.appendChild(inputRow("Phone", phone));
  form.appendChild(inputRow("Email (optional)", email));
  form.appendChild(el("div", "md:col-span-2"));
  form.appendChild(inputRow("Address", address));

  const errorBox = el("div", "mt-3 hidden rounded-xl bg-red-50 p-3 text-sm text-red-700");
  const successBox = el("div", "mt-3 hidden rounded-xl bg-green-50 p-3 text-sm text-green-700");
  const actions = el("div", "mt-5 flex justify-between gap-2");
  
  const deleteBtn = button("🗑️ Delete", "danger");
  const cancelBtn = button("Cancel", "ghost");
  const saveBtn = button("Save Changes", "primary");
  saveBtn.type = "submit";
  
  actions.appendChild(deleteBtn);
  actions.appendChild(cancelBtn);
  actions.appendChild(saveBtn);

  const overlay = openModal(content);
  cancelBtn.addEventListener("click", function() { overlay.remove(); });
  content.appendChild(form);
  content.appendChild(errorBox);
  content.appendChild(successBox);
  content.appendChild(actions);

  // Delete handler
  deleteBtn.addEventListener("click", async function() {
    if (!confirm("Are you sure you want to delete this user? This action cannot be undone.")) return;
    
    try {
      const { error } = await supabase.from("profiles").delete().eq("id", profile.id);
      if (error) throw error;
      overlay.remove();
      onSaved();
    } catch (error) {
      errorBox.textContent = "Failed to delete: " + error.message;
      errorBox.classList.remove("hidden");
    }
  });

  form.addEventListener("submit", async function(e) {
    e.preventDefault();
    errorBox.classList.add("hidden");
    successBox.classList.add("hidden");
    saveBtn.disabled = true;

    try {
      const { error } = await supabase.from("profiles").update({
        full_name: fullName.value.trim(),
        phone: phone.value.trim() || null,
        address: address.value.trim() || null,
        email: email.value.trim() || null,
        role: role.value,
        is_active: active.value === "true"
      }).eq("id", profile.id);

      if (error) throw error;
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
// RENDER USER TABLE
// ============================================

function renderUsersTable(profiles, onEdit, onToggleActive) {
  const wrap = el("div", "overflow-x-auto");
  const table = el("table", "w-full min-w-[900px] text-left text-sm");
  
  table.innerHTML = '<thead class="text-xs uppercase text-slate-500 bg-slate-50"><tr><th class="py-3 px-4">User</th><th class="py-3 px-4">User ID</th><th class="py-3 px-4">Role</th><th class="py-3 px-4">Status</th><th class="py-3 px-4">Contact</th><th class="py-3 px-4 text-right">Actions</th></tr></thead>';

  const tbody = el("tbody", "divide-y divide-slate-200");

  if (profiles.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="py-8 text-center text-slate-500">No users found</td></tr>';
  }

  for (const p of profiles) {
    const tr = el("tr", "hover:bg-slate-50 transition-colors");
    const addr = p.address || '';
    tr.innerHTML = '<td class="py-3 px-4"><div class="font-medium text-slate-900">' + escapeHtml(p.full_name) + '</div><div class="text-xs text-slate-500">' + (addr ? escapeHtml(addr.substring(0, 30)) + '...' : '-') + '</div></td><td class="py-3 px-4 font-mono text-xs">' + escapeHtml(p.username) + '</td><td class="py-3 px-4"></td><td class="py-3 px-4"></td><td class="py-3 px-4 text-xs text-slate-600"><div>' + (p.phone || '-') + '</div><div>' + (p.email || '-') + '</div></td><td class="py-3 px-4 text-right"></td>';
    
    tr.children[2].appendChild(rolePill(p.role));
    
    const statusSpan = el("span", "px-2 py-1 rounded-full text-xs font-medium " + (p.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'));
    statusSpan.textContent = p.is_active ? 'Active' : 'Inactive';
    tr.children[3].appendChild(statusSpan);

    const actionsDiv = el("div", "flex gap-1 justify-end");
    
    const editBtn = button("Edit", "secondary");
    editBtn.className = "px-3 py-1 rounded-lg border border-slate-300 text-xs hover:bg-slate-50";
    editBtn.addEventListener("click", function() { onEdit(p); });
    actionsDiv.appendChild(editBtn);

    const toggleBtn = button(p.is_active ? 'Deactivate' : 'Activate', "secondary");
    toggleBtn.className = "px-3 py-1 rounded-lg border border-slate-300 text-xs hover:bg-slate-50";
    toggleBtn.addEventListener("click", function() { onToggleActive(p); });
    actionsDiv.appendChild(toggleBtn);

    tr.children[5].appendChild(actionsDiv);
    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}

// ============================================
// LOAD DATA & RENDER
// ============================================

async function loadProfiles() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,full_name,username,phone,address,email,role,is_active,created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

// Generate valid UUID using crypto API
function generateUUID() {
  return crypto.randomUUID();
}

async function toggleActive(profile) {
  const newStatus = !profile.is_active;
  const { error } = await supabase.from("profiles").update({ is_active: newStatus }).eq("id", profile.id);
  if (error) {
    usersStatus.textContent = error.message;
    return;
  }
  await render();
}

// Main render function
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

  // Header with buttons
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

  // Info banner
  const infoBanner = el("div", "mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800");
  infoBanner.innerHTML = "<b>Supabase XAMPP Style:</b> Users login with User ID and password. Passwords are stored in Supabase. Created accounts work from any device.";
  usersApp.appendChild(infoBanner);

  // Table
  const table = renderUsersTable(profilesCache, openEditProfileModal, toggleActive);
  usersApp.appendChild(table);

  usersStatus.textContent = "Showing " + profilesCache.length + " users.";

  // Event listeners
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
      tableEl.replaceWith(renderUsersTable(filtered, openEditProfileModal, toggleActive));
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
    
    // Auto-refresh when window gets focus (to pick up Supabase changes)
    window.addEventListener("focus", function() {
      render();
    });
    
  } catch (e) {
    usersStatus.textContent = e?.message || "Failed to load users.";
  }
}

init();
