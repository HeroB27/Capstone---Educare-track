import { fetchUnreadNotificationsCount, supabase, redirectToDashboard, redirectToLogin, requireAuthAndProfile, signOut } from "../core/core.js";
import { button, el, escapeHtml, formatLocalDateTime, openModal, selectInput, textArea } from "../core/ui.js";
import { initAppShell, setShellNotificationsCount, setShellProfile } from "../core/shell.js";
import { createClinicVisit, notify, updateClinicPass, updateClinicVisit } from "../core/scan-actions.js";
import { registerPwa } from "../core/pwa.js";

initAppShell({ role: "clinic", active: "dashboard" });

const profileBadge = document.getElementById("profileBadge");
const signOutBtn = document.getElementById("signOutBtn");
const clinicStatus = document.getElementById("clinicStatus");
const clinicApp = document.getElementById("clinicApp");

signOutBtn?.addEventListener("click", async () => {
  await signOut();
  redirectToLogin();
});

async function loadPasses() {
  const { data, error } = await supabase
    .from("clinic_passes")
    .select("id,student_id,clinic_visit_id,issued_by,reason,status,issued_at,students(full_name,grade_level,strand,parent_id)")
    .order("issued_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

async function loadActiveVisits() {
  const { data, error } = await supabase
    .from("clinic_visits")
    .select("id,student_id,treated_by,status,visit_time,notes,students(full_name,grade_level,strand,parent_id)")
    .eq("status", "in_clinic")
    .order("visit_time", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

const createVisit = createClinicVisit;
const updatePass = updateClinicPass;
const updateVisit = updateClinicVisit;

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

function statusPill(status) {
  const s = String(status ?? "pending").toLowerCase();
  if (s === "approved" || s === "in_clinic") return "bg-yellow-100 text-yellow-800";
  if (s === "done") return "bg-green-100 text-green-700";
  return "bg-slate-100 text-slate-700";
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

function openDoneModal({ clinicId, pass, onSaved }) {
  const content = el("div", "");
  content.appendChild(el("div", "text-lg font-semibold text-slate-900", "Close clinic visit"));

  const notes = textArea({ placeholder: "Clinic notes (optional)", rows: 4 });
  const errorBox = el("div", "mt-4 hidden rounded-xl bg-red-50 p-3 text-sm text-red-700");
  const actions = el("div", "mt-5 flex justify-end gap-2");
  const cancelBtn = button("Cancel", "ghost");
  const doneBtn = button("Mark done", "primary", "red");
  doneBtn.type = "button";
  cancelBtn.addEventListener("click", () => overlay.remove());
  actions.appendChild(cancelBtn);
  actions.appendChild(doneBtn);

  doneBtn.addEventListener("click", async () => {
    errorBox.classList.add("hidden");
    doneBtn.disabled = true;
    try {
      if (pass.clinic_visit_id) {
        await updateVisit(pass.clinic_visit_id, { status: "done", notes: notes.value.trim() || null });
      }
      await updatePass(pass.id, { status: "done" });
      await notifyTeacher({
        clinicId,
        teacherId: pass.issued_by,
        verb: "clinic_visit_done",
        object: { pass_id: pass.id, student_id: pass.student_id, clinic_visit_id: pass.clinic_visit_id },
      });
      await notify({
        recipientId: pass.students?.parent_id,
        actorId: clinicId,
        verb: "clinic_visit_done",
        object: {
          pass_id: pass.id,
          student_id: pass.student_id,
          clinic_visit_id: pass.clinic_visit_id,
          timestamp: new Date().toISOString(),
          notes: notes.value.trim() || null,
        },
      });
      overlay.remove();
      await onSaved();
    } catch (e) {
      errorBox.textContent = e?.message ?? "Failed to close visit.";
      errorBox.classList.remove("hidden");
      doneBtn.disabled = false;
    }
  });

  content.appendChild(
    el(
      "div",
      "mt-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700 ring-1 ring-slate-200",
      `Student: ${escapeHtml(pass.students?.full_name ?? "Student")} • Status: ${escapeHtml(pass.status ?? "pending")}`
    )
  );
  content.appendChild(el("div", "mt-4 text-sm font-medium text-slate-700", "Notes"));
  content.appendChild(notes);
  content.appendChild(errorBox);
  content.appendChild(actions);
  const overlay = openModal(content, { maxWidthClass: "max-w-2xl" });
}

async function render(profileId) {
  if (clinicStatus) clinicStatus.textContent = "Loading…";
  clinicApp?.replaceChildren();

  // Fetch data
  const [visits, passes] = await Promise.all([loadActiveVisits(), loadPasses()]);
  
  // Calculate statistics
  const today = new Date().toISOString().slice(0, 10);
  const visitsToday = passes.filter(v => v.created_at?.startsWith(today)).length;
  const activeVisitsCount = visits.length;
  const pendingCount = passes.filter(p => String(p.status ?? "pending").toLowerCase() === "pending").length;
  const completedToday = passes.filter(p => 
    p.status?.toLowerCase() === "done" && p.updated_at?.startsWith(today)
  ).length;

  // Statistics Cards
  const statsSection = el("div", "grid grid-cols-2 md:grid-cols-4 gap-3 mb-6");
  
  const stats = [
    { label: "Active Visits", value: activeVisitsCount, icon: "🏥", color: "red" },
    { label: "Pending Passes", value: pendingCount, icon: "📋", color: "yellow" },
    { label: "Visits Today", value: visitsToday, icon: "📊", color: "blue" },
    { label: "Completed", value: completedToday, icon: "✅", color: "green" },
  ];
  
  for (const stat of stats) {
    const card = el("div", `rounded-xl bg-${stat.color}-50 p-4 border border-${stat.color}-100`);
    card.innerHTML = `
      <div class="flex items-center justify-between">
        <div>
          <div class="text-xs text-${stat.color}-700 font-medium">${stat.label}</div>
          <div class="text-2xl font-bold text-${stat.color}-900">${stat.value}</div>
        </div>
        <div class="text-2xl">${stat.icon}</div>
      </div>
    `;
    statsSection.appendChild(card);
  }
  clinicApp.appendChild(statsSection);

  const top = el("div", "flex flex-wrap items-center justify-between gap-2");
  top.appendChild(el("div", "text-sm text-slate-600", "Clinic overview: active visits and pending passes."));
  const controls = el("div", "flex items-center gap-2");
  const refreshBtn = button("Refresh", "secondary", "red");
  refreshBtn.className = "rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50";
  controls.appendChild(refreshBtn);
  top.appendChild(controls);
  clinicApp.appendChild(top);

  const passByVisitId = new Map(passes.filter((p) => p.clinic_visit_id).map((p) => [p.clinic_visit_id, p]));

  const visitsSection = el("div", "mt-4");
  visitsSection.appendChild(el("div", "text-sm font-semibold text-slate-900", "Active clinic visits"));
  const visitsList = el("div", "mt-2 space-y-3");
  if (!visits.length) {
    visitsList.appendChild(el("div", "text-sm text-slate-600", "No active visits."));
  } else {
    for (const v of visits) {
      const student = v.students?.full_name ?? "Student";
      const meta = `${formatLocalDateTime(v.visit_time)}${v.notes ? ` • ${escapeHtml(v.notes)}` : ""}`;
      const linkedPass = passByVisitId.get(v.id) ?? null;
      const card = el("div", "rounded-2xl bg-slate-50 p-4");
      card.innerHTML = `
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="text-sm font-semibold text-slate-900">${escapeHtml(student)}</div>
            <div class="mt-1 text-xs text-slate-600">${meta}</div>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <span class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${statusPill(v.status)}">${escapeHtml(v.status || "in_clinic")}</span>
            <button data-action="done" class="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white">Mark done</button>
          </div>
        </div>
      `;
      const doneBtn = card.querySelector('button[data-action="done"]');
      doneBtn.addEventListener("click", async () => {
        if (linkedPass) {
          openDoneModal({ clinicId: profileId, pass: linkedPass, onSaved: () => render(profileId) });
          return;
        }
        try {
          await updateVisit(v.id, { status: "done" });
          await render(profileId);
        } catch (e) {
          if (clinicStatus) clinicStatus.textContent = e?.message ?? "Failed to close visit.";
        }
      });
      visitsList.appendChild(card);
    }
  }
  visitsSection.appendChild(visitsList);
  clinicApp.appendChild(visitsSection);

  const pendingSection = el("div", "mt-6");
  pendingSection.appendChild(el("div", "text-sm font-semibold text-slate-900", "Pending clinic passes"));
  const pendingList = el("div", "mt-2 space-y-3");
  const pending = passes.filter((p) => String(p.status ?? "pending").toLowerCase() === "pending");
  if (!pending.length) {
    pendingList.appendChild(el("div", "text-sm text-slate-600", "No pending passes."));
  } else {
    for (const p of pending) {
      const student = p.students?.full_name ?? "Student";
      const meta = `${formatLocalDateTime(p.issued_at)} • ${p.reason ? escapeHtml(p.reason) : "—"}`;
      const card = el("div", "rounded-2xl bg-slate-50 p-4");
      card.innerHTML = `
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="text-sm font-semibold text-slate-900">${escapeHtml(student)}</div>
            <div class="mt-1 text-xs text-slate-600">${meta}</div>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <span class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${statusPill(p.status)}">${escapeHtml(p.status || "pending")}</span>
            <button data-action="approve" class="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white">Approve</button>
          </div>
        </div>
      `;
      const approveBtn = card.querySelector('button[data-action="approve"]');
      approveBtn.addEventListener("click", () => openApproveModal({ clinicId: profileId, pass: p, onSaved: () => render(profileId) }));
      pendingList.appendChild(card);
    }
  }
  pendingSection.appendChild(pendingList);
  clinicApp.appendChild(pendingSection);

  refreshBtn.addEventListener("click", () => render(profileId));
  if (clinicStatus) clinicStatus.textContent = `Loaded ${visits.length} active visit(s) and ${pending.length} pending pass(es).`;
}

let currentProfile = null;
let channels = [];

function cleanup() {
  for (const ch of channels) supabase.removeChannel(ch);
  channels = [];
}

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
  if (profileBadge) profileBadge.textContent = `${profile.full_name} • ${profile.role}`;
  if (profileBadge) profileBadge.classList.remove("hidden");
  setShellProfile({ fullName: profile.full_name, role: profile.role });
  const { count } = await fetchUnreadNotificationsCount(profile.id);
  setShellNotificationsCount(count ?? 0);

  try {
    await render(profile.id);
  } catch (e) {
    if (clinicStatus) clinicStatus.textContent = e?.message ?? "Failed to load clinic passes.";
  }

  cleanup();
  const passesCh = supabase
    .channel(`clinic-passes-${profile.id}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "clinic_passes" }, async () => {
      await render(profile.id);
    })
    .subscribe();
  channels.push(passesCh);

  const visitsCh = supabase
    .channel(`clinic-visits-${profile.id}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "clinic_visits" }, async () => {
      await render(profile.id);
    })
    .subscribe();
  channels.push(visitsCh);

  window.addEventListener("beforeunload", cleanup);
}

init();
