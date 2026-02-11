import { supabase } from "../core/core.js";
import { button, el, escapeHtml, selectInput, textArea, textInput } from "../core/ui.js";
import { initAppShell } from "../core/shell.js";
import { initParentPage } from "./parent-common.js";
import { registerPwa } from "../core/pwa.js";

initAppShell({ role: "parent", active: "excuse-upload" });

const uploadStatus = document.getElementById("uploadStatus");
const uploadApp = document.getElementById("uploadApp");

function sanitizeFilename(value) {
  return String(value ?? "").replaceAll(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 120);
}

function isAllowedFile(file) {
  if (!file) return { ok: false, message: "File is required." };
  const maxBytes = 8 * 1024 * 1024;
  if (file.size > maxBytes) return { ok: false, message: "File is too large (max 8MB)." };
  const type = String(file.type ?? "");
  if (type === "application/pdf") return { ok: true };
  if (type.startsWith("image/")) return { ok: true };
  return { ok: false, message: "Only PDF or image files are allowed." };
}

async function loadChildren(profileId) {
  const { data, error } = await supabase
    .from("students")
    .select("id,full_name,class_id,grade_level,strand,parent_id")
    .eq("parent_id", profileId)
    .order("full_name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function findHomeroomTeacherIdForClass(classId) {
  if (!classId) return null;
  const { data, error } = await supabase.from("classes").select("id,homeroom_teacher_id").eq("id", classId).single();
  if (error) throw error;
  return data?.homeroom_teacher_id ?? null;
}

async function notifyTeacher({ parentId, teacherId, studentId, absentDate }) {
  if (!teacherId) return;
  const { error } = await supabase.from("notifications").insert({
    recipient_id: teacherId,
    actor_id: parentId,
    verb: "excuse_submitted",
    object: { student_id: studentId, absent_date: absentDate },
    read: false,
  });
  if (error) throw error;
}

async function uploadFile({ parentId, studentId, file }) {
  const name = sanitizeFilename(file.name || "excuse");
  const path = `${parentId}/${studentId}/${Date.now()}_${name}`;
  const { error } = await supabase.storage.from("excuse_letters").upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) throw error;
  return path;
}

async function createExcuseLetter({ parentId, studentId, absentDate, reason }) {
  const { data, error } = await supabase
    .from("excuse_letters")
    .insert({
      student_id: studentId,
      parent_id: parentId,
      absent_date: absentDate,
      reason,
      status: "pending",
    })
    .select("id")
    .limit(1);
  if (error) throw error;
  return data?.[0]?.id ?? null;
}

async function render(profileId) {
  uploadStatus.textContent = "Loading…";

  const children = await loadChildren(profileId);
  if (!children.length) {
    document.getElementById("uploadApp").innerHTML = `
      <div class="rounded-2xl bg-yellow-50 p-4 text-sm text-yellow-900 ring-1 ring-yellow-200">
        No linked children found. Ask the admin to link your account to your student(s).
      </div>
    `;
    uploadStatus.textContent = "Ready.";
    return;
  }

  // Get HTML elements - ensure they exist before accessing
  await new Promise(resolve => setTimeout(resolve, 100)); // Brief delay to ensure DOM is ready
  
  const childSelect = document.getElementById("childSelect");
  const absenceDate = document.getElementById("absenceDate");
  const reasonSelect = document.getElementById("reasonSelect");
  const description = document.getElementById("description");
  const fileInput = document.getElementById("fileInput");
  const dropZone = document.getElementById("dropZone");
  const filePreview = document.getElementById("filePreview");
  const fileName = document.getElementById("fileName");
  const removeFile = document.getElementById("removeFile");
  const submitBtn = document.getElementById("submitBtn");
  const errorBox = document.getElementById("errorBox") || createErrorBox();
  const okBox = document.getElementById("okBox") || createOkBox();
  
  // Check if all required elements exist
  if (!childSelect || !absenceDate || !reasonSelect || !fileInput || !submitBtn) {
    console.error("Missing form elements:", { childSelect, absenceDate, reasonSelect, fileInput, submitBtn });
    uploadStatus.textContent = "Form elements not found. Please refresh the page.";
    return;
  }

  // Populate child select
  childSelect.innerHTML = '';
  children.forEach(child => {
    const option = document.createElement("option");
    option.value = child.id;
    option.textContent = child.full_name;
    childSelect.appendChild(option);
  });

  // Set current date as default
  absenceDate.value = new Date().toISOString().split('T')[0];

  // Load recent excuses on initial render
  await loadRecentExcuses(profileId);

  // File upload handling
  dropZone.addEventListener("click", () => fileInput.click());
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("border-violet-500", "bg-violet-50");
  });
  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("border-violet-500", "bg-violet-50");
  });
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("border-violet-500", "bg-violet-50");
    if (e.dataTransfer.files.length > 0) {
      fileInput.files = e.dataTransfer.files;
      handleFileSelect();
    }
  });

  fileInput.addEventListener("change", handleFileSelect);
  removeFile.addEventListener("click", () => {
    fileInput.value = "";
    filePreview.classList.add("hidden");
  });

  function handleFileSelect() {
    const file = fileInput.files[0];
    if (file) {
      fileName.textContent = file.name;
      filePreview.classList.remove("hidden");
    } else {
      filePreview.classList.add("hidden");
    }
  }

  // Form submission
  submitBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    errorBox.classList.add("hidden");
    okBox.classList.add("hidden");
    submitBtn.disabled = true;

    const selectedChildId = childSelect.value;
    const selectedChild = children.find(c => c.id === selectedChildId);
    
    if (!selectedChildId) {
      showError("Please select a child");
      return;
    }
    if (!absenceDate.value) {
      showError("Please select a date of absence");
      return;
    }
    if (!reasonSelect.value) {
      showError("Please select a reason");
      return;
    }

    const file = fileInput.files[0];
    const valid = isAllowedFile(file);
    if (file && !valid.ok) {
      showError(valid.message);
      return;
    }

    try {
      let attachmentPath = null;
      if (file) {
        attachmentPath = await uploadFile({ parentId: profileId, studentId: selectedChildId, file });
      }

      const excuseId = await createExcuseLetter({
        parentId: profileId,
        studentId: selectedChildId,
        absentDate: absenceDate.value,
        reason: reasonSelect.value + (description.value ? ": " + description.value : ""),
      });

      const teacherId = await findHomeroomTeacherIdForClass(selectedChild.class_id);
      await notifyTeacher({ parentId: profileId, teacherId, studentId: selectedChildId, absentDate: absenceDate.value });

      showSuccess(`Excuse submitted successfully!${excuseId ? ` Reference: ${excuseId}` : ""}`);
      
      // Reset form
      absenceDate.value = new Date().toISOString().split('T')[0];
      reasonSelect.value = "illness";
      description.value = "";
      fileInput.value = "";
      filePreview.classList.add("hidden");
      
      // Load recent excuses
      await loadRecentExcuses(profileId, selectedChildId);
      
    } catch (err) {
      showError(err?.message ?? "Failed to submit excuse letter");
    } finally {
      submitBtn.disabled = false;
    }
  });

  function showError(message) {
    errorBox.textContent = message;
    errorBox.classList.remove("hidden");
    submitBtn.disabled = false;
  }

  function showSuccess(message) {
    okBox.textContent = message;
    okBox.classList.remove("hidden");
  }

  uploadStatus.textContent = "Ready.";
}

function createErrorBox() {
  const errorBox = document.createElement("div");
  errorBox.id = "errorBox";
  errorBox.className = "hidden rounded-xl bg-red-50 p-3 text-sm text-red-700 mt-4";
  document.getElementById("uploadApp").appendChild(errorBox);
  return errorBox;
}

function createOkBox() {
  const okBox = document.createElement("div");
  okBox.id = "okBox";
  okBox.className = "hidden rounded-xl bg-green-50 p-3 text-sm text-green-800 ring-1 ring-green-200 mt-4";
  document.getElementById("uploadApp").appendChild(okBox);
  return okBox;
}

async function loadRecentExcuses(parentId, studentId = null) {
  const recentExcusesEl = document.getElementById("recentExcuses");
  if (!recentExcusesEl) return;

  try {
    recentExcusesEl.innerHTML = '<p class="text-slate-500 text-center py-4">Loading recent excuses...</p>';

    let query = supabase
      .from("excuse_letters")
      .select(`
        id,
        student_id,
        absent_date,
        reason,
        status,
        created_at,
        attachment_name,
        attachment_path,
        students (full_name)
      `)
      .eq("parent_id", parentId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (studentId) {
      query = query.eq("student_id", studentId);
    }

    const { data, error } = await query;
    
    if (error) throw error;

    if (!data || data.length === 0) {
      recentExcusesEl.innerHTML = '<p class="text-slate-500 text-center py-8">No recent excuses found.</p>';
      return;
    }

    recentExcusesEl.innerHTML = data.map(excuse => `
      <div class="rounded-xl bg-white p-4 border border-slate-200 hover:border-slate-300 transition-colors">
        <div class="flex items-start justify-between mb-2">
          <div>
            <div class="font-medium text-slate-900">${escapeHtml(excuse.students?.full_name || 'Unknown Student')}</div>
            <div class="text-sm text-slate-500">${new Date(excuse.absent_date).toLocaleDateString()}</div>
          </div>
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            excuse.status === 'approved' ? 'bg-green-100 text-green-800' :
            excuse.status === 'rejected' ? 'bg-red-100 text-red-800' :
            'bg-yellow-100 text-yellow-800'
          }">
            ${excuse.status}
          </span>
        </div>
        <div class="text-sm text-slate-700 mb-3">${escapeHtml(excuse.reason || 'No reason provided')}</div>
        ${excuse.attachment_path ? `
          <div class="flex items-center text-sm text-slate-500">
            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            ${escapeHtml(excuse.attachment_name || 'Attachment')}
          </div>
        ` : ''}
        <div class="text-xs text-slate-400 mt-2">Submitted ${new Date(excuse.created_at).toLocaleDateString()}</div>
      </div>
    `).join('');

  } catch (error) {
    console.error("Failed to load recent excuses:", error);
    recentExcusesEl.innerHTML = '<p class="text-red-500 text-center py-4">Failed to load recent excuses.</p>';
  }
}

async function init() {
  registerPwa();
  const { profile, error } = await initParentPage();
  if (error) return;
  try {
    await render(profile.id);
  } catch (e) {
    uploadStatus.textContent = e?.message ?? "Failed to load.";
  }
}

init();
