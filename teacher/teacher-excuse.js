import { supabase } from "../core/core.js";
import { button, el, escapeHtml, formatLocalDateTime, openModal, textArea } from "../core/ui.js";
import { initAppShell } from "../core/shell.js";
import { initTeacherPage } from "./teacher-common.js";
import { registerPwa } from "../core/pwa.js";

initAppShell({ role: "teacher", active: "excuse" });

const excuseStatus = document.getElementById("excuseStatus");
const excuseApp = document.getElementById("excuseApp");

async function loadExcuseLetters() {
  const { data, error } = await supabase
    .from("excuse_letters")
    .select("id,student_id,parent_id,absent_date,reason,status,remarks,attachment_path,attachment_name,attachment_mime,created_at,students(full_name,grade_level,strand,class_id)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

async function upsertExcusedAbsence({ studentId, classId, dateStr, remarks }) {
  if (!dateStr) return;
  const { error } = await supabase.from("homeroom_attendance").upsert(
    {
      student_id: studentId,
      class_id: classId,
      date: dateStr,
      status: "excused_absent",
      remarks: remarks || null,
    },
    { onConflict: "student_id,date" }
  );
  if (error) throw error;
}

async function notifyParent({ teacherId, parentId, verb, object }) {
  if (!parentId) return;
  const { error } = await supabase.from("notifications").insert({
    recipient_id: parentId,
    actor_id: teacherId,
    verb,
    object,
    read: false,
  });
  if (error) throw error;
}

async function openAttachment(path) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from("excuse_letters").createSignedUrl(path, 600);
  if (error) throw error;
  return data?.signedUrl ?? null;
}

function openReviewModal({ profileId, item, onSaved }) {
  const content = el("div", "");
  content.appendChild(el("div", "text-lg font-semibold text-slate-900", "Review excuse letter"));

  const card = el("div", "mt-4 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200");
  const student = item.students?.full_name ?? "Student";
  const meta = `${item.absent_date || "—"} • ${item.status || "pending"}`;
  card.innerHTML = `
    <div class="text-sm font-semibold text-slate-900">${escapeHtml(student)}</div>
    <div class="mt-1 text-xs text-slate-600">${escapeHtml(meta)}</div>
    <div class="mt-3 text-sm text-slate-700"><span class="font-semibold">Reason:</span> ${escapeHtml(item.reason || "—")}</div>
  `;

  const actionsRow = el("div", "mt-4 flex flex-wrap gap-2");
  const openBtn = button("Open attachment", "secondary", "blue");
  openBtn.disabled = !item.attachment_path;
  openBtn.addEventListener("click", async () => {
    try {
      openBtn.disabled = true;
      const url = await openAttachment(item.attachment_path);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      excuseStatus.textContent = e?.message ?? "Failed to open attachment.";
    } finally {
      openBtn.disabled = false;
    }
  });
  actionsRow.appendChild(openBtn);

  const remarks = textArea({ value: item.remarks ?? "", placeholder: "Remarks (optional)", rows: 3 });
  const remarksWrap = el("div", "mt-4 space-y-1");
  remarksWrap.appendChild(el("label", "block text-sm font-medium text-slate-700", "Remarks"));
  remarksWrap.appendChild(remarks);

  const errorBox = el("div", "mt-4 hidden rounded-xl bg-red-50 p-3 text-sm text-red-700");
  const footer = el("div", "mt-5 flex flex-wrap justify-end gap-2");
  const closeBtn = button("Close", "ghost");
  const rejectBtn = button("Reject", "danger");
  const approveBtn = button("Approve", "primary", "blue");
  approveBtn.type = "button";
  closeBtn.addEventListener("click", () => overlay.remove());

  async function updateStatus(nextStatus) {
    errorBox.classList.add("hidden");
    approveBtn.disabled = true;
    rejectBtn.disabled = true;

    try {
      const { error } = await supabase
        .from("excuse_letters")
        .update({ status: nextStatus, remarks: remarks.value.trim() || null })
        .eq("id", item.id);
      if (error) throw error;

      if (nextStatus === "approved") {
        await upsertExcusedAbsence({
          studentId: item.student_id,
          classId: item.students?.class_id ?? null,
          dateStr: item.absent_date,
          remarks: remarks.value.trim() || "Excuse approved",
        });
      }

      await notifyParent({
        teacherId: profileId,
        parentId: item.parent_id,
        verb: nextStatus === "approved" ? "excuse_approved" : "excuse_rejected",
        object: { excuse_id: item.id, student_id: item.student_id, absent_date: item.absent_date, remarks: remarks.value.trim() || null },
      });

      overlay.remove();
      await onSaved();
    } catch (e) {
      errorBox.textContent = e?.message ?? "Failed to update excuse letter.";
      errorBox.classList.remove("hidden");
      approveBtn.disabled = false;
      rejectBtn.disabled = false;
    }
  }

  approveBtn.addEventListener("click", () => updateStatus("approved"));
  rejectBtn.addEventListener("click", () => updateStatus("rejected"));

  footer.appendChild(closeBtn);
  footer.appendChild(rejectBtn);
  footer.appendChild(approveBtn);

  content.appendChild(card);
  content.appendChild(actionsRow);
  content.appendChild(remarksWrap);
  content.appendChild(errorBox);
  content.appendChild(footer);

  const overlay = openModal(content, { maxWidthClass: "max-w-2xl" });
}

function statusPill(status) {
  const s = String(status ?? "pending").toLowerCase();
  if (s === "approved") return "bg-green-100 text-green-700";
  if (s === "rejected") return "bg-red-100 text-red-700";
  return "bg-yellow-100 text-yellow-800";
}

async function render(profileId) {
  excuseStatus.textContent = "Loading…";
  excuseApp.replaceChildren();

  const items = await loadExcuseLetters();
  const pending = items.filter((x) => String(x.status ?? "pending").toLowerCase() === "pending");

  const header = el("div", "flex flex-wrap items-center justify-between gap-2");
  header.appendChild(el("div", "text-sm text-slate-600", `Pending: ${pending.length} • Total: ${items.length}`));
  const refreshBtn = button("Refresh", "secondary", "blue");
  refreshBtn.addEventListener("click", () => render(profileId));
  header.appendChild(refreshBtn);
  excuseApp.appendChild(header);

  const list = el("div", "mt-4 space-y-3");
  if (!items.length) {
    list.appendChild(el("div", "text-sm text-slate-600", "No excuse letters yet."));
  } else {
    for (const it of items) {
      const student = it.students?.full_name ?? "Student";
      const meta = `${it.absent_date || "—"} • submitted ${formatLocalDateTime(it.created_at)}`;
      const card = el("div", "rounded-2xl bg-slate-50 p-4");
      card.innerHTML = `
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="text-sm font-semibold text-slate-900">${escapeHtml(student)}</div>
            <div class="mt-1 text-xs text-slate-600">${escapeHtml(meta)}</div>
          </div>
          <div class="flex items-center gap-2">
            <span class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${statusPill(it.status)}">${escapeHtml(it.status || "pending")}</span>
            <button class="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white">Review</button>
          </div>
        </div>
        <div class="mt-3 text-sm text-slate-700"><span class="font-semibold">Reason:</span> ${escapeHtml(it.reason || "—")}</div>
      `;
      const reviewBtn = card.querySelector("button");
      reviewBtn.addEventListener("click", () => openReviewModal({ profileId, item: it, onSaved: () => render(profileId) }));
      list.appendChild(card);
    }
  }

  excuseApp.appendChild(list);
  excuseStatus.textContent = "Ready.";
}

let channels = [];
function cleanup() {
  for (const ch of channels) supabase.removeChannel(ch);
  channels = [];
}

async function init() {
  registerPwa();
  const { profile, error } = await initTeacherPage();
  if (error) return;

  try {
    await render(profile.id);
  } catch (e) {
    excuseStatus.textContent = e?.message ?? "Failed to load excuse letters.";
    return;
  }

  cleanup();
  const ch = supabase
    .channel(`teacher-excuse-${profile.id}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "excuse_letters" }, async () => {
      await render(profile.id);
    })
    .subscribe();
  channels.push(ch);

  window.addEventListener("beforeunload", cleanup);
}

init();
