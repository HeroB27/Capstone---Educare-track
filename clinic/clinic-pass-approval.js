import { fetchUnreadNotificationsCount, supabase, redirectToDashboard, redirectToLogin, requireAuthAndProfile, signOut } from "../core/core.js";
import { initAppShell, setShellNotificationsCount, setShellProfile } from "../core/shell.js";
import { button, el, escapeHtml, formatLocalDateTime, openModal, textArea } from "../core/ui.js";
import { createClinicVisit, notify, updateClinicPass } from "../core/scan-actions.js";
import { registerPwa } from "../core/pwa.js";

initAppShell({ role: "clinic", active: "pass-approval" });

const approvalStatus = document.getElementById("approvalStatus");
const approvalApp = document.getElementById("approvalApp");
const profileBadge = document.getElementById("profileBadge");
const signOutBtn = document.getElementById("signOutBtn");

async function loadPendingPasses() {
  const { data, error } = await supabase
    .from("clinic_passes")
    .select("id,student_id,clinic_visit_id,issued_by,reason,status,issued_at,students(full_name,grade_level,strand,parent_id)")
    .eq("status", "pending")
    .order("issued_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}

const createVisit = createClinicVisit;
const updatePass = updateClinicPass;

async function notifyTeacher({ clinicId, teacherId, verb, object }) {
  if (!teacherId) return;
  const { error } = await supabase.from("notifications").insert({
    recipient_id: teacherId,
    actor_id: clinicId,
    verb,
    object,
    read: false,
  });
  if (error) throw error;
}

function openApproveModal({ clinicId, pass, onSaved }) {
  const content = el("div", "");
  content.appendChild(el("div", "text-lg font-semibold text-slate-900", "Approve clinic pass"));

  const notes = textArea({ placeholder: "Clinic notes (optional)", rows: 4 });
  const errorBox = el("div", "mt-4 hidden rounded-xl bg-red-50 p-3 text-sm text-red-700");
  const actions = el("div", "mt-5 flex justify-end gap-2");
  const cancelBtn = button("Cancel", "ghost");
  const approveBtn = button("Approve", "primary", "red");
  approveBtn.type = "button";
  cancelBtn.addEventListener("click", () => overlay.remove());
  actions.appendChild(cancelBtn);
  actions.appendChild(approveBtn);

  approveBtn.addEventListener("click", async () => {
    errorBox.classList.add("hidden");
    approveBtn.disabled = true;
    try {
      const visitId = await createVisit({
        clinicId,
        studentId: pass.student_id,
        reason: pass.reason,
        notes: notes.value.trim(),
      });
      await updatePass(pass.id, { status: "approved", clinic_visit_id: visitId });
      await notifyTeacher({
        clinicId,
        teacherId: pass.issued_by,
        verb: "clinic_pass_approved",
        object: { pass_id: pass.id, student_id: pass.student_id, clinic_visit_id: visitId },
      });
      await notify({
        recipientId: pass.students?.parent_id,
        actorId: clinicId,
        verb: "clinic_pass_approved",
        object: { pass_id: pass.id, student_id: pass.student_id, clinic_visit_id: visitId, timestamp: new Date().toISOString() },
      });
      overlay.remove();
      await onSaved();
    } catch (e) {
      errorBox.textContent = e?.message ?? "Failed to approve pass.";
      errorBox.classList.remove("hidden");
      approveBtn.disabled = false;
    }
  });

  content.appendChild(
    el(
      "div",
      "mt-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700 ring-1 ring-slate-200",
      `Student: ${escapeHtml(pass.students?.full_name ?? "Student")} • Reason: ${escapeHtml(pass.reason ?? "—")}`
    )
  );
  content.appendChild(el("div", "mt-4 text-sm font-medium text-slate-700", "Notes"));
  content.appendChild(notes);
  content.appendChild(errorBox);
  content.appendChild(actions);
  const overlay = openModal(content, { maxWidthClass: "max-w-2xl" });
}

/**
 * Open reject modal for clinic pass
 */
function openRejectModal({ clinicId, pass, onSaved }) {
  const content = el("div", "");
  content.appendChild(el("div", "text-lg font-semibold text-red-700", "Reject clinic pass"));

  const rejectionReason = textArea({ placeholder: "Please provide a reason for rejection (required)", rows: 4 });
  const errorBox = el("div", "mt-4 hidden rounded-xl bg-red-50 p-3 text-sm text-red-700");
  const actions = el("div", "mt-5 flex justify-end gap-2");
  const cancelBtn = button("Cancel", "ghost");
  const rejectBtn = button("Reject", "danger", "red");
  rejectBtn.type = "button";
  cancelBtn.addEventListener("click", () => overlay.remove());
  actions.appendChild(cancelBtn);
  actions.appendChild(rejectBtn);

  rejectBtn.addEventListener("click", async () => {
    const reason = rejectionReason.value.trim();
    if (!reason) {
      errorBox.textContent = "Rejection reason is required.";
      errorBox.classList.remove("hidden");
      return;
    }

    errorBox.classList.add("hidden");
    rejectBtn.disabled = true;

    try {
      await updatePass(pass.id, { 
        status: "rejected", 
        rejection_reason: reason,
        rejected_at: new Date().toISOString()
      });
      
      // Notify issuing teacher
      await notifyTeacher({
        clinicId,
        teacherId: pass.issued_by,
        verb: "clinic_pass_rejected",
        object: { 
          pass_id: pass.id, 
          student_id: pass.student_id, 
          rejection_reason: reason,
          rejected_at: new Date().toISOString() 
        },
      });
      
      // Notify parent
      await notify({
        recipientId: pass.students?.parent_id,
        actorId: clinicId,
        verb: "clinic_pass_rejected",
        object: { 
          pass_id: pass.id, 
          student_id: pass.student_id, 
          rejection_reason: reason,
          rejected_at: new Date().toISOString() 
        },
      });
      
      overlay.remove();
      await onSaved();
    } catch (e) {
      errorBox.textContent = e?.message ?? "Failed to reject pass.";
      errorBox.classList.remove("hidden");
      rejectBtn.disabled = false;
    }
  });

  content.appendChild(
    el(
      "div",
      "mt-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700 ring-1 ring-slate-200",
      `Student: ${escapeHtml(pass.students?.full_name ?? "Student")} • Reason: ${escapeHtml(pass.reason ?? "—")}`
    )
  );
  content.appendChild(el("div", "mt-4 text-sm font-medium text-slate-700", "Rejection Reason *"));
  content.appendChild(rejectionReason);
  content.appendChild(errorBox);
  content.appendChild(actions);
  const overlay = openModal(content, { maxWidthClass: "max-w-2xl" });
}

async function render(profile) {
  approvalStatus.textContent = "Loading…";
  approvalApp.replaceChildren();

  const passes = await loadPendingPasses();
  if (!passes.length) {
    approvalApp.appendChild(el("div", "text-sm text-slate-600", "No pending passes."));
    approvalStatus.textContent = "Ready.";
    return;
  }

  const list = el("div", "space-y-3");
  for (const p of passes) {
    const student = p.students?.full_name ?? "Student";
    const meta = `${formatLocalDateTime(p.issued_at)} • ${p.reason ? escapeHtml(p.reason) : "—"}`;
    const card = el("div", "rounded-2xl bg-slate-50 p-4");
    card.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="text-sm font-semibold text-slate-900">${escapeHtml(student)}</div>
          <div class="mt-1 text-xs text-slate-600">${meta}</div>
        </div>
        <div class="flex items-center gap-2">
          <button data-action="reject" class="rounded-xl border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50">Reject</button>
          <button data-action="approve" class="rounded-xl border border-green-300 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-50">Approve</button>
        </div>
      </div>
    `;
    const approveBtn = card.querySelector('button[data-action="approve"]');
    const rejectBtn = card.querySelector('button[data-action="reject"]');
    approveBtn.addEventListener("click", () => openApproveModal({ clinicId: profile.id, pass: p, onSaved: () => init() }));
    rejectBtn.addEventListener("click", () => openRejectModal({ clinicId: profile.id, pass: p, onSaved: () => init() }));
    list.appendChild(card);
  }

  approvalApp.appendChild(list);
  approvalStatus.textContent = `Loaded ${passes.length} pending pass(es).`;
}

let currentProfile = null;
let channel = null;

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
  if (profileBadge) {
    profileBadge.textContent = `${profile.full_name} • ${profile.role}`;
    profileBadge.classList.remove("hidden");
  }
  setShellProfile({ fullName: profile.full_name, role: profile.role });
  const { count } = await fetchUnreadNotificationsCount(profile.id);
  setShellNotificationsCount(count ?? 0);
  if (signOutBtn) {
    signOutBtn.addEventListener("click", async () => {
      await signOut();
      redirectToLogin();
    });
  }
  try {
    await render(profile);
  } catch (e) {
    approvalStatus.textContent = e?.message ?? "Failed to load clinic passes.";
  }

  if (channel) supabase.removeChannel(channel);
  channel = supabase
    .channel(`clinic-approval-${profile.id}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "clinic_passes" }, async () => {
      await render(profile);
    })
    .subscribe();
}

init();
