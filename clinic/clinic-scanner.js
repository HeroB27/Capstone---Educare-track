import { redirectToDashboard, redirectToLogin, requireAuthAndProfile, signOut } from "../core/core.js";
import { initCameraScanner } from "../core/qr-camera.js";
import { lookupStudentByQr, recordClinicArrival } from "../core/scan-actions.js";
import { registerPwa } from "../core/pwa.js";

// Get HTML elements
const videoEl = document.getElementById("video");
const statusBox = document.getElementById("scanStatus");
const studentInfo = document.getElementById("studentInfo");
const signOutBtn = document.getElementById("signOutBtn");
const openScannerBtn = document.getElementById("openScanner");
const startScannerBtn = document.getElementById("startScanner");
const closeScannerBtn = document.getElementById("closeScanner");
const scannerContainer = document.getElementById("scannerContainer");
const landingPage = document.getElementById("landingPage");
const verifiedCountEl = document.getElementById("verifiedCount");
const todayCountEl = document.getElementById("todayCount");

// Create dynamic elements for manual input (not in HTML)
const notes = document.createElement("textarea");
const manualQr = document.createElement("input");
const manualBtn = document.createElement("button");

let currentProfile = null;
let scanner = null;
let confirmationOverlay = null;
let scanningLocked = false;

function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Show confirmation overlay with student info after successful clinic arrival scan
 */
function showConfirmation({ student, pass, notes }) {
  // Remove existing overlay if any
  if (confirmationOverlay) {
    confirmationOverlay.remove();
  }
  
  const overlay = document.createElement("div");
  overlay.className = "fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm";
  
  overlay.innerHTML = `
    <div class="bg-white rounded-3xl shadow-2xl p-8 max-w-sm mx-4 text-center transform transition-all duration-300 scale-100">
      <div class="w-20 h-20 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
        <svg class="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
        </svg>
      </div>
      
      <div class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Clinic Arrival</div>
      
      <h2 class="text-2xl font-bold text-slate-900 mb-2">${escapeHtml(student.full_name)}</h2>
      
      <div class="text-sm text-slate-600 mb-4">
        ${student.grade_level ? `${escapeHtml(student.grade_level)}` : ""}
        ${student.strand ? `• ${escapeHtml(student.strand)}` : ""}
      </div>
      
      ${pass?.id ? `
        <div class="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-full text-sm font-medium mb-4">
          <span>Pass: ${escapeHtml(pass.status)}</span>
        </div>
      ` : ""}
      
      ${notes ? `
        <div class="text-sm text-slate-600 bg-slate-50 rounded-lg p-3 mb-4">
          ${escapeHtml(notes)}
        </div>
      ` : ""}
      
      <div class="text-lg font-semibold text-red-600 mb-6">
        ${new Date().toLocaleTimeString()}
      </div>
      
      <button id="closeOverlay" class="w-full py-3 px-6 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors">
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

signOutBtn.addEventListener("click", async () => {
  await signOut();
  redirectToLogin();
});

function setStatus(message) {
  if (statusBox) {
    statusBox.textContent = message;
  }
  
  if (studentInfo) {
    studentInfo.textContent = message;
  }
}

function showScanner() {
  scannerContainer.style.display = "flex";
  landingPage.style.display = "none";
  initCamera();
}

function hideScanner() {
  scannerContainer.style.display = "none";
  landingPage.style.display = "block";
  if (scanner) {
    scanner.stop();
  }
}

async function initCamera() {
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

    const res = await recordClinicArrival({
      clinicStaffId: currentProfile.id,
      student,
      notes: notes.value.trim() || null,
    });

    // Show confirmation overlay
    showConfirmation({
      student,
      pass: res.pass,
      notes: notes.value.trim() || null
    });

    const passInfo = res.pass?.id ? ` • pass: ${res.pass.status}` : "";
    setStatus(`${student.full_name} recorded${passInfo}`);
  } catch (e) {
    setStatus(e?.message ?? "Failed to record clinic arrival.");
  }
  
  // Release lock after 2 seconds to prevent duplicate scans
  setTimeout(() => scanningLocked = false, 2000);
}

// Add event listeners for scanner UI
openScannerBtn.addEventListener("click", showScanner);
startScannerBtn.addEventListener("click", initCamera);
closeScannerBtn.addEventListener("click", hideScanner);

// Manual input event listeners (for fallback functionality)
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
  
  // Initialize UI elements
  if (statusBox) statusBox.textContent = "Ready to verify";
  if (studentInfo) studentInfo.textContent = "Point camera at student ID";
  
  window.addEventListener("beforeunload", () => scanner?.stop?.());
}

init();

