import { supabase, storePassword } from "../core/core.js";
import { initAppShell } from "../core/shell.js";
import { initAdminPage } from "./admin-common.js";

initAppShell({ role: "admin", active: "people" });

// Defensive code for missing DOM elements
const usersStatus = document.getElementById("usersStatus") ?? document.createElement("div");
const usersApp = document.getElementById("usersApp") ?? document.getElementById("usersTableBody");
if (!document.getElementById("usersStatus") && usersApp?.parentElement) {
  usersStatus.id = "usersStatus";
  usersStatus.className = "text-sm text-slate-600 mb-4";
  usersApp.parentElement.insertBefore(usersStatus, usersApp);
}

// Utility functions
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
  if (r === "guard") return pill("Guard", "bg-yellow-100 text-yellow-800");
  if (r === "clinic") return pill("Clinic", "bg-red-100 text-red-700");
  return pill(r || "-", "bg-slate-100 text-slate-700");
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

// User ID generators
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

function generateStaffUserId(prefix, phone) {
  return prefix + "-" + currentYear() + "-" + lastFourDigits(phone) + "-" + randomFourDigits();
}

function generateParentUserId(phone) {
  return "PAR-" + currentYear() + "-" + lastFourDigits(phone) + "-" + randomFourDigits();
}

// Load functions
async function loadProfiles() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,full_name,username,phone,address,email,role,is_active,created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

// Generate UUID
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    return c === 'x' ? r : (r & 0x3 | 0x8).toString(16);
  });
}

// Modal: Quick Add User (Staff)
async function openAddStaffModal(onSaved) {
  const content = el("div", "");
  content.appendChild(el("div", "text-lg font-semibold text-slate-900", "Add Staff Member"));
  content.appendChild(el("div", "mt-1 text-sm text-slate-600", "Create teacher, guard, clinic, or admin account. Email is optional."));

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
  
  // Auto-generate username on phone change
  phone.addEventListener("input", function() {
    const digits = phone.value.replace(/\D/g, "");
    if (digits.length >= 4) {
      const prefix = role.value === "teacher" ? "TCH" : role.value === "admin" ? "ADM" : role.value === "guard" ? "GRD" : "CLC";
      username.value = generateStaffUserId(prefix, digits);
    }
  });

  role.addEventListener("change", function() {
    const digits = phone.value.replace(/\D/g, "");
    if (digits.length >= 4) {
      const prefix = role.value === "teacher" ? "TCH" : role.value === "admin" ? "ADM" : role.value === "guard" ? "GRD" : "CLC";
      username.value = generateStaffUserId(prefix, digits);
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

  const errorBox = el("div", "mt-3 hidden rounded-xl bg-red-50 p-3 text-sm text-red-700");
  const successBox = el("div", "mt-3 hidden rounded-xl bg-green-50 p-3 text-sm text-green-700");
  const actions = el("div", "mt-5 flex justify-end gap-2");
  const cancelBtn = button("Cancel", "ghost");
  const saveBtn = button("Create Account", "primary");
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
    saveBtn.textContent = "Creating...";

    const userId = username.value.trim().toUpperCase();
    const pass = password.value;
    const full = fullName.value.trim();
    const phoneVal = phone.value.trim();

    if (!full || !userId || !pass) {
      errorBox.textContent = "Full name, username, and password are required.";
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
        phone: phoneVal || null,
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

      // Store password in Supabase (not localStorage)
      await storePassword(newUserId, pass);

      successBox.innerHTML = "<b>Account Created Successfully!</b><br>User ID: " + userId + "<br>Password: " + pass + "<br><br>Login with User ID and this password.";
      successBox.classList.remove("hidden");
      saveBtn.textContent = "Created!";
      saveBtn.disabled = true;

      setTimeout(function() {
        overlay.remove();
        onSaved();
      }, 2000);

    } catch (error) {
      errorBox.textContent = error.message || "Failed to create account.";
      errorBox.classList.remove("hidden");
      saveBtn.disabled = false;
      saveBtn.textContent = "Create Account";
    }
  });
}

// Modal: Add Parent + Student(s)
async function openAddParentStudentModal(onSaved) {
  const content = el("div", "");
  content.appendChild(el("div", "text-lg font-semibold text-slate-900", "Add Parent & Student(s)"));
  content.appendChild(el("div", "mt-1 text-sm text-slate-600", "Parent account with one or more students. Phone required, email optional."));

  const form = el("form", "mt-4 grid gap-4");
  
  // Parent Section
  const parentSection = el("div", "p-4 bg-slate-50 rounded-xl");
  parentSection.appendChild(el("div", "font-semibold text-slate-900 mb-3", "Parent Information"));
  
  const parentType = selectInput([
    { value: "Parent", label: "Parent" },
    { value: "Guardian", label: "Guardian" },
  ], "Parent");
  
  const parentName = textInput({ placeholder: "Parent/Guardian Full Name *" });
  const parentPhone = textInput({ placeholder: "Phone (10-11 digits) *", type: "tel" });
  const parentAddress = textInput({ placeholder: "Address *" });
  
  // Auto-generate parent username
  parentPhone.addEventListener("input", function() {
    const digits = parentPhone.value.replace(/\D/g, "");
    if (digits.length >= 4) {
      parentUsername.value = generateParentUserId(digits);
    }
  });

  const parentUsername = textInput({ placeholder: "Username (auto-generated)" });
  const parentPassword = textInput({ placeholder: "Password *", type: "password" });

  function inputRow(label, inputEl) {
    const wrap = el("div", "space-y-1");
    wrap.appendChild(el("label", "block text-sm font-medium text-slate-700", label));
    wrap.appendChild(inputEl);
    return wrap;
  }

  parentSection.appendChild(inputRow("Relationship", parentType));
  parentSection.appendChild(inputRow("Full Name *", parentName));
  parentSection.appendChild(inputRow("Phone *", parentPhone));
  parentSection.appendChild(inputRow("Address *", parentAddress));
  parentSection.appendChild(inputRow("Username", parentUsername));
  parentSection.appendChild(inputRow("Password *", parentPassword));

  // Students Section
  const studentsSection = el("div", "p-4 bg-blue-50 rounded-xl mt-4");
  studentsSection.appendChild(el("div", "flex justify-between items-center mb-3", 
    el("div", "font-semibold text-slate-900", "Student Information(s)"),
    button("+ Add Another Student", "secondary")
  ));

  const studentsContainer = el("div", "space-y-4");
  
  function createStudentFields(index) {
    const studentDiv = el("div", "p-3 bg-white rounded-lg border border-slate-200");
    studentDiv.appendChild(el("div", "text-xs font-medium text-slate-500 mb-2", "Student " + (index + 1)));
    
    const sName = textInput({ placeholder: "Student Full Name *" });
    const sLrn = textInput({ placeholder: "LRN (12 digits, optional)", type: "tel" });
    const sGrade = textInput({ placeholder: "Grade Level (Kinder, 1-12, or SHS Grade 11/12) *" });
    const sStrand = textInput({ placeholder: "Strand (for SHS only: ABM, STEM, HUMSS, TVL-ICT)" });
    const sAddress = textInput({ placeholder: "Address (same as parent if empty)" });
    
    // Photo upload for student
    const photoWrap = el("div", "space-y-1 mt-2");
    photoWrap.appendChild(el("label", "block text-xs font-medium text-slate-700", "Photo (optional)"));
    const photoInput = document.createElement("input");
    photoInput.type = "file";
    photoInput.accept = "image/*";
    photoInput.className = "text-xs text-slate-600";
    photoWrap.appendChild(photoInput);
    
    const photoPreview = el("div", "mt-2 hidden");
    photoPreview.innerHTML = '<img src="" alt="Photo preview" class="w-16 h-16 rounded-lg object-cover border border-slate-200">';
    
    photoInput.addEventListener("change", async function(e) {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function(evt) {
          photoPreview.querySelector("img").src = evt.target.result;
          photoPreview.classList.remove("hidden");
        };
        reader.readAsDataURL(file);
      }
    });

    function inputRowStudent(label, inputEl) {
      const wrap = el("div", "space-y-1");
      wrap.appendChild(el("label", "block text-xs font-medium text-slate-700", label));
      wrap.appendChild(inputEl);
      return wrap;
    }

    studentDiv.appendChild(inputRowStudent("Full Name *", sName));
    studentDiv.appendChild(inputRowStudent("LRN (optional)", sLrn));
    studentDiv.appendChild(inputRowStudent("Grade Level *", sGrade));
    studentDiv.appendChild(inputRowStudent("Strand (SHS only)", sStrand));
    studentDiv.appendChild(inputRowStudent("Address", sAddress));
    studentDiv.appendChild(photoWrap);
    studentDiv.appendChild(photoPreview);

    return { div: studentDiv, name: sName, lrn: sLrn, grade: sGrade, strand: sStrand, address: sAddress, photoInput };
  }

  const firstStudent = createStudentFields(0);
  studentsContainer.appendChild(firstStudent.div);
  
  let studentCount = 1;
  studentsSection.querySelector("button").addEventListener("click", function() {
    if (studentCount < 5) {
      const newStudent = createStudentFields(studentCount);
      studentsContainer.appendChild(newStudent.div);
      studentCount++;
    }
  });

  studentsSection.appendChild(studentsContainer);

  form.appendChild(parentSection);
  form.appendChild(studentsSection);

  const errorBox = el("div", "mt-3 hidden rounded-xl bg-red-50 p-3 text-sm text-red-700");
  const successBox = el("div", "mt-3 hidden rounded-xl bg-green-50 p-3 text-sm text-green-700");
  const actions = el("div", "mt-5 flex justify-end gap-2");
  const cancelBtn = button("Cancel", "ghost");
  const saveBtn = button("Create Accounts & Generate IDs", "primary");
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
    saveBtn.textContent = "Creating...";

    const parentUser = parentUsername.value.trim() || parentUsername.value;
    const parentPass = parentPassword.value;
    const parentFull = parentName.value.trim();
    const parentPhoneVal = parentPhone.value.trim();
    const parentAddr = parentAddress.value.trim();

    if (!parentFull || !parentUser || !parentPass || !parentAddr) {
      errorBox.textContent = "Parent name, username, password, and address are required.";
      errorBox.classList.remove("hidden");
      saveBtn.disabled = false;
      saveBtn.textContent = "Create Accounts & Generate IDs";
      return;
    }

    try {
      const parentId = generateUUID();

      const { error: parentError } = await supabase.from("profiles").insert({
        id: parentId,
        full_name: parentFull,
        username: parentUser.toUpperCase(),
        phone: parentPhoneVal,
        email: null,
        address: parentAddr,
        role: "parent",
        is_active: true
      });

      if (parentError) throw parentError;
      await supabase.from("parents").insert({ profile_id: parentId, parent_type: parentType.value }).catch(function() {});

      // Store password in Supabase (not localStorage)
      await storePassword(parentId, parentPass);

      // Create students
      let studentIds = [];
      const studentDivs = studentsContainer.querySelectorAll(":scope > div");
      
      for (let i = 0; i < studentDivs.length; i++) {
        const div = studentDivs[i];
        const inputs = div.querySelectorAll("input");
        const sName = inputs[0]?.value?.trim();
        const sGrade = inputs[2]?.value?.trim();

        if (!sName || !sGrade) continue;

        const studentId = generateUUID();
        const lrn = inputs[1]?.value?.trim() || null;
        const strand = inputs[3]?.value?.trim() || null;
        const addr = inputs[4]?.value?.trim() || parentAddr;
        const photoFile = inputs[5]?.files?.[0] || null;

        // Upload photo if provided
        let photoPath = null;
        if (photoFile) {
          const fileName = studentId + "-" + Date.now() + "-" + photoFile.name.replace(/[^a-zA-Z0-9.]/g, "");
          const { error: uploadError } = await supabase.storage
            .from("student-photos")
            .upload(fileName, photoFile);
          if (!uploadError) {
            photoPath = fileName;
          }
        }

        const { error: studentError } = await supabase.from("students").insert({
          id: studentId,
          full_name: sName,
          lrn: lrn,
          address: addr,
          grade_level: sGrade,
          strand: strand,
          parent_id: parentId,
          photo_path: photoPath,
          is_active: true
        });

        if (studentError) throw studentError;
        studentIds.push({ id: studentId, name: sName, grade: sGrade });
      }

      successBox.innerHTML = "<b>Accounts Created Successfully!</b><br><br><b>Parent Account:</b><br>User ID: " + parentUser.toUpperCase() + "<br>Password: " + parentPass + "<br><br><b>Students: " + studentIds.length + "</b><br>" + studentIds.map(function(s) { return s.name + " (" + s.grade + ")"; }).join("<br>") + "<br><br><b>Parent account can login immediately.</b>";
      successBox.classList.remove("hidden");
      saveBtn.textContent = "Done!";
      saveBtn.disabled = true;

      setTimeout(function() {
        overlay.remove();
        onSaved();
      }, 3000);

    } catch (error) {
      errorBox.textContent = error.message || "Failed to create accounts.";
      errorBox.classList.remove("hidden");
      saveBtn.disabled = false;
      saveBtn.textContent = "Create Accounts & Generate IDs";
    }
  });
}

// Modal: Edit Profile
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
  const actions = el("div", "mt-5 flex justify-end gap-2");
  const cancelBtn = button("Cancel", "ghost");
  const saveBtn = button("Save Changes", "primary");
  saveBtn.type = "submit";
  actions.appendChild(cancelBtn);
  actions.appendChild(saveBtn);

  const overlay = openModal(content);
  cancelBtn.addEventListener("click", function() { overlay.remove(); });
  content.appendChild(form);
  content.appendChild(errorBox);
  content.appendChild(actions);

  form.addEventListener("submit", async function(e) {
    e.preventDefault();
    errorBox.classList.add("hidden");
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
      overlay.remove();
      onSaved();
    } catch (error) {
      errorBox.textContent = error.message;
      errorBox.classList.remove("hidden");
      saveBtn.disabled = false;
    }
  });
}

// Render main user table
function renderUsersTable(profiles, onEdit, onToggleActive) {
  const wrap = el("div", "overflow-x-auto");
  const table = el("table", "w-full min-w-[800px] text-left text-sm");
  
  table.innerHTML = '<thead class="text-xs uppercase text-slate-500 bg-slate-50"><tr><th class="py-3 px-4">User</th><th class="py-3 px-4">User ID</th><th class="py-3 px-4">Role</th><th class="py-3 px-4">Status</th><th class="py-3 px-4">Contact</th><th class="py-3 px-4 text-right">Actions</th></tr></thead>';

  const tbody = el("tbody", "divide-y divide-slate-200");

  for (const p of profiles) {
    const tr = el("tr", "hover:bg-slate-50");
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
  
  profilesCache = await loadProfiles();
  
  usersApp.replaceChildren();

  // Header with buttons
  const header = el("div", "mb-4 flex flex-wrap gap-3 justify-between items-center");
  
  const left = el("div", "flex flex-wrap gap-2 items-center");
  const search = textInput({ placeholder: "Search users..." });
  search.className = "w-64 rounded-xl border border-slate-300 px-3 py-2 text-sm";
  left.appendChild(search);

  const filterRole = selectInput([
    { value: "", label: "All Roles" },
    { value: "admin", label: "Admin" },
    { value: "teacher", label: "Teacher" },
    { value: "parent", label: "Parent" },
    { value: "guard", label: "Guard" },
    { value: "clinic", label: "Clinic" },
  ], "");
  filterRole.className = "rounded-xl border border-slate-300 px-3 py-2 text-sm";
  left.appendChild(filterRole);

  const right = el("div", "flex gap-2");
  const addStaffBtn = button("+ Add Staff", "primary");
  const addParentBtn = button("+ Add Parent+Student", "primary");
  
  right.appendChild(addStaffBtn);
  right.appendChild(addParentBtn);

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

async function init() {
  const { error } = await initAdminPage();
  if (error) return;

  try {
    await render();
  } catch (e) {
    usersStatus.textContent = e?.message || "Failed to load users.";
  }
}

init();
