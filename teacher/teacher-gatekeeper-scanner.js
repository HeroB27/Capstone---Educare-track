import { redirectToDashboard, redirectToLogin, requireAuthAndProfile, signOut, supabase } from "../core/core.js";
import { initCameraScanner } from "../core/qr-camera.js";
import { lookupStudentByQr, recordTap } from "../core/scan-actions.js";
import { registerPwa } from "../core/pwa.js";

const videoEl = document.getElementById("camera");
const tapType = document.getElementById("tapType");
const statusBox = document.getElementById("statusBox");
const manualQr = document.getElementById("manualQr");
const manualBtn = document.getElementById("manualBtn");
const signOutBtn = document.getElementById("signOutBtn");

let currentProfile = null;
let scanner = null;

signOutBtn.addEventListener("click", async () => {
  await signOut();
  redirectToLogin();
});

function setStatus(message) {
  statusBox.textContent = message;
}

async function isTeacherGatekeeper(profileId) {
  const { data, error } = await supabase
    .from("system_settings")
    .select("id,key,value")
    .eq("key", "teacher_gatekeepers")
    .maybeSingle();
  if (error) throw error;
  const ids = Array.isArray(data?.value?.teacher_ids) ? data.value.teacher_ids : [];
  return ids.includes(profileId);
}

async function handleQr(data) {
  if (!currentProfile) return;

  const qr = String(data ?? "").trim();
  if (!qr) return;

  setStatus("Processing…");
  try {
    const student = await lookupStudentByQr(qr);
    if (!student) {
      setStatus("Student not found for that QR.");
      return;
    }

    const res = await recordTap({
      gatekeeperId: currentProfile.id,
      student,
      tapType: tapType.value,
    });

    if (res.result === "duplicate") {
      setStatus(`Duplicate ignored: ${student.full_name}`);
      return;
    }

    if (tapType.value === "in") {
      setStatus(`Tap in recorded: ${student.full_name}${res.arrival ? ` (${res.arrival})` : ""}`);
    } else {
      setStatus(`Tap out recorded: ${student.full_name}`);
    }
  } catch (e) {
    setStatus(e?.message ?? "Failed to record tap.");
  }
}

manualBtn.addEventListener("click", async () => {
  await handleQr(manualQr.value);
});

manualQr.addEventListener("keydown", async (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    await handleQr(manualQr.value);
  }
});

async function init() {
  registerPwa();
  const { profile, error } = await requireAuthAndProfile();
  if (error) {
    redirectToLogin();
    return;
  }

  if (profile.role !== "teacher") {
    redirectToDashboard(profile.role);
    return;
  }

  currentProfile = profile;

  try {
    const ok = await isTeacherGatekeeper(profile.id);
    if (!ok) {
      setStatus("Not authorized. Ask admin to enable Teacher Gatekeepers in Settings.");
      return;
    }
  } catch (e) {
    setStatus(e?.message ?? "Failed to check gatekeeper setting.");
    return;
  }

  setStatus("Starting camera…");
  try {
    scanner = await initCameraScanner({
      videoEl,
      onCode: async ({ data }) => {
        await handleQr(data);
      },
      onState: (s) => {
        if (s.status === "requesting_camera") setStatus("Requesting camera permission…");
        if (s.status === "scanning") setStatus("Ready. Point camera at a QR code.");
        if (s.status === "stopped") setStatus("Camera stopped.");
      },
    });
  } catch (e) {
    setStatus((e?.message ?? "Failed to start camera.") + " Use manual fallback below.");
  }

  window.addEventListener("beforeunload", () => scanner?.stop?.());
}

init();

