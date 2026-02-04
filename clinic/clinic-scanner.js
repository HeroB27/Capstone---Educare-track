import { redirectToDashboard, redirectToLogin, requireAuthAndProfile, signOut } from "../core/core.js";
import { initCameraScanner } from "../core/qr-camera.js";
import { lookupStudentByQr, recordClinicArrival } from "../core/scan-actions.js";
import { registerPwa } from "../core/pwa.js";

const videoEl = document.getElementById("camera");
const notes = document.getElementById("notes");
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

    const res = await recordClinicArrival({
      clinicStaffId: currentProfile.id,
      student,
      notes: notes.value.trim() || null,
    });

    const passInfo = res.pass?.id ? ` • pass: ${res.pass.status}` : "";
    setStatus(`Clinic arrival recorded: ${student.full_name}${passInfo}`);
  } catch (e) {
    setStatus(e?.message ?? "Failed to record clinic arrival.");
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

  if (profile.role !== "clinic") {
    redirectToDashboard(profile.role);
    return;
  }

  currentProfile = profile;
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

