import { redirectToDashboard, redirectToLogin, requireAuthAndProfile, signOut } from "../core/core.js";
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
let confirmationOverlay = null;
let scanningLocked = false;

/**
 * Show confirmation overlay with student info after successful scan
 */
function showConfirmation({ student, tapType, arrivalStatus }) {
  // Remove existing overlay if any
  if (confirmationOverlay) {
    confirmationOverlay.remove();
  }
  
  const overlay = document.createElement("div");
  overlay.className = "fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm";
  
  const isTapIn = tapType === "in";
  const statusColor = arrivalStatus === "late" ? "text-red-400" : "text-green-400";
  const statusText = arrivalStatus === "late" ? "(Late)" : "";
  
  overlay.innerHTML = `
    <div class="bg-white rounded-3xl shadow-2xl p-8 max-w-sm mx-4 text-center transform transition-all duration-300 scale-100">
      <div class="w-20 h-20 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center">
        <svg class="w-10 h-10 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
      </div>
      
      <div class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">${isTapIn ? "Tap In" : "Tap Out"} Recorded</div>
      
      <h2 class="text-2xl font-bold text-slate-900 mb-2">${escapeHtml(student.full_name)}</h2>
      
      <div class="text-sm text-slate-600 mb-4">
        ${student.grade_level ? `${escapeHtml(student.grade_level)}` : ""}
        ${student.strand ? `• ${escapeHtml(student.strand)}` : ""}
      </div>
      
      <div class="text-lg font-semibold ${statusColor} mb-6">
        ${new Date().toLocaleTimeString()} ${statusText}
      </div>
      
      <button id="closeOverlay" class="w-full py-3 px-6 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition-colors">
        Continue Scanning
      </button>
    </div>
  `;
  
  document.body.appendChild(overlay);
  confirmationOverlay = overlay;
  
  overlay.querySelector("#closeOverlay").addEventListener("click", () => {
    overlay.classList.add("opacity-0", "scale-95");
    setTimeout(() => {
      overlay.remove();
      confirmationOverlay = null;
    }, 200);
  });
  
  // Auto-close after 3 seconds
  setTimeout(() => {
    if (confirmationOverlay === overlay) {
      overlay.querySelector("#closeOverlay")?.click();
    }
  }, 3000);
}

function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

signOutBtn.addEventListener("click", async () => {
  await signOut();
  redirectToLogin();
});

function setStatus(message) {
  statusBox.textContent = message;
}

async function handleQr(data) {
  if (!currentProfile) return;
  if (scanningLocked) return;
  scanningLocked = true;

  const qr = String(data ?? "").trim();
  if (!qr) {
    scanningLocked = false;
    return;
  }

  setStatus("Processing…");
  try {
    const student = await lookupStudentByQr(qr);
    if (!student) {
      setStatus("Student not found for that QR.");
      scanningLocked = false;
      return;
    }

    const res = await recordTap({
      gatekeeperId: currentProfile.id,
      student,
      tapType: tapType.value,
    });

    if (res.result === "duplicate") {
      setStatus(`Duplicate ignored: ${student.full_name}`);
      scanningLocked = false;
      return;
    }
    if (res.result === "blocked") {
      setStatus(res.event?.title ? `No classes today: ${res.event.title}` : "No classes today.");
      scanningLocked = false;
      return;
    }
    if (res.result === "rejected") {
      setStatus(res.reason === "no_in" ? "Tap out rejected: no tap-in recorded today." : "Tap rejected.");
      scanningLocked = false;
      return;
    }

    // Show confirmation overlay
    showConfirmation({
      student,
      tapType: tapType.value,
      arrivalStatus: res.arrival
    });

    if (tapType.value === "in") {
      setStatus(`Tap in: ${student.full_name}${res.arrival ? ` (${res.arrival})` : ""}`);
    } else {
      setStatus(`Tap out: ${student.full_name}`);
    }
  } catch (e) {
    setStatus(e?.message ?? "Failed to record tap.");
  }
  
  // Release lock after 2 seconds to prevent duplicate scans
  setTimeout(() => scanningLocked = false, 2000);
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

  if (profile.role !== "guard") {
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
