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

async function createExcuseLetter({ parentId, studentId, absentDate, reason, attachment }) {
  const { data, error } = await supabase
    .from("excuse_letters")
    .insert({
      student_id: studentId,
      parent_id: parentId,
      absent_date: absentDate,
      reason,
      status: "pending",
      attachment_path: attachment.path,
      attachment_name: attachment.name,
      attachment_mime: attachment.mime,
    })
    .select("id")
    .limit(1);
  if (error) throw error;
  return data?.[0]?.id ?? null;
}

async function render(profileId) {
  uploadStatus.textContent = "Loading…";
  uploadApp.replaceChildren();

  const children = await loadChildren(profileId);
  if (!children.length) {
    uploadApp.appendChild(
      el(
        "div",
        "rounded-2xl bg-yellow-50 p-4 text-sm text-yellow-900 ring-1 ring-yellow-200",
        "No linked children found. Ask the admin to link your account to your student(s)."
      )
    );
    uploadStatus.textContent = "Ready.";
    return;
  }

  const form = el("form", "grid gap-4");
  const childSel = selectInput(children.map((c) => ({ value: c.id, label: c.full_name })), children[0].id);
  const date = textInput({ type: "date", value: "" });
  const reason = textArea({ placeholder: "Reason for absence", rows: 4 });
  const file = document.createElement("input");
  file.type = "file";
  file.accept = "application/pdf,image/*";
  file.className =
    "block w-full cursor-pointer rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-700";

  const row = (label, inputEl) => {
    const w = el("div", "space-y-1");
    w.appendChild(el("label", "block text-sm font-medium text-slate-700", escapeHtml(label)));
    w.appendChild(inputEl);
    return w;
  };

  form.appendChild(row("Child", childSel));
  form.appendChild(row("Date of absence", date));
  form.appendChild(row("Reason", reason));
  form.appendChild(row("Attachment (PDF / Image)", file));

  const errorBox = el("div", "hidden rounded-xl bg-red-50 p-3 text-sm text-red-700");
  const okBox = el("div", "hidden rounded-xl bg-green-50 p-3 text-sm text-green-800 ring-1 ring-green-200");
  const actions = el("div", "flex justify-end");
  const submit = button("Submit", "primary", "green");
  submit.type = "submit";
  actions.appendChild(submit);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorBox.classList.add("hidden");
    okBox.classList.add("hidden");
    submit.disabled = true;

    const selected = children.find((c) => c.id === childSel.value);
    if (!selected) {
      errorBox.textContent = "Child is required.";
      errorBox.classList.remove("hidden");
      submit.disabled = false;
      return;
    }
    if (!date.value) {
      errorBox.textContent = "Date is required.";
      errorBox.classList.remove("hidden");
      submit.disabled = false;
      return;
    }
    if (!reason.value.trim()) {
      errorBox.textContent = "Reason is required.";
      errorBox.classList.remove("hidden");
      submit.disabled = false;
      return;
    }

    const picked = file.files?.[0] ?? null;
    const valid = isAllowedFile(picked);
    if (!valid.ok) {
      errorBox.textContent = valid.message;
      errorBox.classList.remove("hidden");
      submit.disabled = false;
      return;
    }

    try {
      const attachmentPath = await uploadFile({ parentId: profileId, studentId: selected.id, file: picked });
      const excuseId = await createExcuseLetter({
        parentId: profileId,
        studentId: selected.id,
        absentDate: date.value,
        reason: reason.value.trim(),
        attachment: { path: attachmentPath, name: picked.name, mime: picked.type || null },
      });

      const teacherId = await findHomeroomTeacherIdForClass(selected.class_id);
      await notifyTeacher({ parentId: profileId, teacherId, studentId: selected.id, absentDate: date.value });

      okBox.textContent = `Submitted successfully.${excuseId ? ` Ref: ${excuseId}` : ""}`;
      okBox.classList.remove("hidden");
      date.value = "";
      reason.value = "";
      file.value = "";
    } catch (err) {
      errorBox.textContent = err?.message ?? "Failed to submit excuse letter.";
      errorBox.classList.remove("hidden");
    } finally {
      submit.disabled = false;
    }
  });

  uploadApp.appendChild(form);
  uploadApp.appendChild(errorBox);
  uploadApp.appendChild(okBox);
  uploadStatus.textContent = "Ready.";
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
