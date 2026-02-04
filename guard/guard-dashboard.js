import { fetchUnreadNotificationsCount, supabase, redirectToDashboard, redirectToLogin, requireAuthAndProfile, signOut } from "../core/core.js";
import { button, el, escapeHtml, isoDate, selectInput, textInput } from "../core/ui.js";
import { initAppShell, setShellNotificationsCount, setShellProfile } from "../core/shell.js";
import { lookupStudentByQr as lookupStudentByQrShared, recordTap } from "../core/scan-actions.js";
import { registerPwa } from "../core/pwa.js";

initAppShell({ role: "guard", active: "dashboard" });

const profileBadge = document.getElementById("profileBadge");
const signOutBtn = document.getElementById("signOutBtn");
const tapStatus = document.getElementById("tapStatus");
const tapApp = document.getElementById("tapApp");
const recentStatus = document.getElementById("recentStatus");
const recentApp = document.getElementById("recentApp");

signOutBtn.addEventListener("click", async () => {
  await signOut();
  redirectToLogin();
});

async function loadAttendanceRules(gradeLevel) {
  const { data, error } = await supabase
    .from("attendance_rules")
    .select("grade_level,entry_time,grace_until,late_until")
    .eq("grade_level", gradeLevel)
    .single();
  if (error) return null;
  return data ?? null;
}

function parseTimeToMinutes(value) {
  const s = String(value ?? "");
  const [hh, mm] = s.split(":");
  const h = Number(hh);
  const m = Number(mm);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function nowMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function computeArrivalStatus(rule) {
  if (!rule) return "present";
  const grace = parseTimeToMinutes(rule.grace_until);
  const lateUntil = parseTimeToMinutes(rule.late_until);
  const current = nowMinutes();
  if (grace === null || lateUntil === null) return "present";
  if (current <= grace) return "present";
  if (current <= lateUntil) return "late";
  return "late";
}

async function lookupStudentByQr(qr) {
  return await lookupStudentByQrShared(qr);
}

async function upsertHomeroomTapIn({ student, status }) {
  const dateStr = isoDate();
  const { error } = await supabase.from("homeroom_attendance").upsert(
    {
      student_id: student.id,
      class_id: student.class_id,
      date: dateStr,
      tap_in_time: new Date().toISOString(),
      status,
    },
    { onConflict: "student_id,date" }
  );
  if (error) throw error;
}

async function setTapOut({ student }) {
  const dateStr = isoDate();
  const { data, error } = await supabase
    .from("homeroom_attendance")
    .update({ tap_out_time: new Date().toISOString() })
    .eq("student_id", student.id)
    .eq("date", dateStr)
    .select("id")
    .limit(1);
  if (!error && (data?.length ?? 0) > 0) return;
  const { error: insErr } = await supabase.from("homeroom_attendance").insert({
    student_id: student.id,
    class_id: student.class_id,
    date: dateStr,
    tap_out_time: new Date().toISOString(),
    status: "present",
  });
  if (insErr) throw insErr;
}

async function insertTapLog({ studentId, guardId, tapType }) {
  const { error } = await supabase.from("tap_logs").insert({
    student_id: studentId,
    gatekeeper_id: guardId,
    tap_type: tapType,
    timestamp: new Date().toISOString(),
    status: "ok",
  });
  if (error) throw error;
}

async function updateStudentCurrentStatus({ studentId, status }) {
  const { error } = await supabase.from("students").update({ current_status: status }).eq("id", studentId);
  if (error) throw error;
}

async function notifyParent({ guardId, parentId, studentId, tapType }) {
  if (!parentId) return;
  const { error } = await supabase.from("notifications").insert({
    recipient_id: parentId,
    actor_id: guardId,
    verb: tapType === "in" ? "tap_in" : "tap_out",
    object: { student_id: studentId, timestamp: new Date().toISOString() },
    read: false,
  });
  if (error) throw error;
}

async function loadRecentTaps(profileId) {
  const { data, error } = await supabase
    .from("tap_logs")
    .select("id,student_id,tap_type,timestamp,students(full_name,grade_level,strand)")
    .eq("gatekeeper_id", profileId)
    .order("timestamp", { ascending: false })
    .limit(20);
  if (error) throw error;
  return data ?? [];
}

function renderRecent(rows) {
  recentApp.replaceChildren();
  if (!rows.length) {
    recentApp.appendChild(el("div", "text-sm text-slate-600", "No taps yet."));
    return;
  }
  const list = el("div", "space-y-2");
  for (const r of rows) {
    const student = r.students?.full_name ?? "Student";
    const meta = `${r.tap_type?.toUpperCase?.() ?? ""} • ${new Date(r.timestamp).toLocaleString()}`;
    const card = el("div", "rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200");
    card.innerHTML = `
      <div class="text-sm font-semibold text-slate-900">${escapeHtml(student)}</div>
      <div class="mt-1 text-xs text-slate-600">${escapeHtml(meta)}</div>
    `;
    list.appendChild(card);
  }
  recentApp.appendChild(list);
}

function renderForm({ profile }) {
  tapApp.replaceChildren();
  const form = el("form", "space-y-4");
  const qr = textInput({ placeholder: "Scan or type QR code" });
  const tapType = selectInput(
    [
      { value: "in", label: "Tap in" },
      { value: "out", label: "Tap out" },
    ],
    "in"
  );
  const actions = el("div", "flex justify-end");
  const submit = button("Submit", "primary", "slate");
  submit.type = "submit";
  submit.className = "rounded-xl bg-yellow-500 px-4 py-2 text-sm font-semibold text-white hover:bg-yellow-600";
  actions.appendChild(submit);

  const row = (label, inputEl) => {
    const w = el("div", "space-y-1");
    w.appendChild(el("label", "block text-sm font-medium text-slate-700", escapeHtml(label)));
    w.appendChild(inputEl);
    return w;
  };
  form.appendChild(row("QR code", qr));
  form.appendChild(row("Action", tapType));

  const msg = el("div", "hidden rounded-xl bg-slate-50 p-3 text-sm text-slate-700 ring-1 ring-slate-200");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.classList.add("hidden");
    submit.disabled = true;
    const qrValue = qr.value.trim();
    if (!qrValue) {
      msg.textContent = "QR code is required.";
      msg.classList.remove("hidden");
      submit.disabled = false;
      return;
    }

    try {
      const student = await lookupStudentByQr(qrValue);
      if (!student) throw new Error("Student not found.");

      const res = await recordTap({ gatekeeperId: profile.id, student, tapType: tapType.value });
      if (res.result === "duplicate") {
        msg.textContent = `Duplicate ignored: ${student.full_name}`;
      } else if (tapType.value === "in") {
        msg.textContent = `Tap in recorded: ${student.full_name}${res.arrival ? ` (${res.arrival})` : ""}`;
      } else {
        msg.textContent = `Tap out recorded: ${student.full_name}`;
      }

      msg.classList.remove("hidden");
      qr.value = "";
      await refresh(profile.id);
    } catch (err) {
      msg.textContent = err?.message ?? "Failed to record tap.";
      msg.classList.remove("hidden");
    } finally {
      submit.disabled = false;
    }
  });

  tapApp.appendChild(form);
  tapApp.appendChild(msg);
}

let currentProfile = null;
let channel = null;

async function refresh(profileId) {
  const rows = await loadRecentTaps(profileId);
  recentStatus.textContent = `Loaded ${rows.length} tap(s).`;
  renderRecent(rows);
}

async function init() {
  registerPwa();
  const { profile, error } = await requireAuthAndProfile();
  if (error) {
    redirectToLogin();
    return;
  }
  if (profile.role !== "guard") {
    redirectToDashboard(profile.role);
    return;
  }
  currentProfile = profile;
  profileBadge.textContent = `${profile.full_name} • ${profile.role}`;
  profileBadge.classList.remove("hidden");
  setShellProfile({ fullName: profile.full_name, role: profile.role });
  const { count } = await fetchUnreadNotificationsCount(profile.id);
  setShellNotificationsCount(count ?? 0);

  renderForm({ profile });
  tapStatus.textContent = "Ready.";
  try {
    await refresh(profile.id);
  } catch (e) {
    recentStatus.textContent = e?.message ?? "Failed to load recent taps.";
  }

  if (channel) supabase.removeChannel(channel);
  channel = supabase
    .channel(`guard-taps-${profile.id}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "tap_logs", filter: `gatekeeper_id=eq.${profile.id}` }, async () => {
      await refresh(profile.id);
    })
    .subscribe();
}

init();
