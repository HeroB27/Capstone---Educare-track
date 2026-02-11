import { redirectToDashboard, redirectToLogin, requireAuthAndProfile, signOut } from "../core/core.js";
import { lookupStudentByQr, recordTap } from "../core/scan-actions.js";
import { registerPwa } from "../core/pwa.js";

const videoEl = document.getElementById("camera");
const tapType = document.getElementById("tapType");
const statusBox = document.getElementById("statusBox");
const manualQr = document.getElementById("manualQr");
const manualBtn = document.getElementById("manualBtn");
const signOutBtn = document.getElementById("signOutBtn");
const startScanner = document.getElementById("startScanner");
const stopScanner = document.getElementById("stopScanner");

let currentProfile = null;
let scanner = null;
let confirmationOverlay = null;
let scanningLocked = false;
let cameraStream = null;
let scanningActive = false;
let canvas = null;
let context = null;

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

// Initialize JSQR Scanner
async function initJsQrScanner() {
  try {
    setStatus("Requesting camera permission…");
    
    // Create canvas for video processing
    canvas = document.createElement("canvas");
    context = canvas.getContext("2d");
    
    // Request camera access with low light optimization
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "environment",
        width: { ideal: 1280 },
        height: { ideal: 720 },
        // Low light optimization
        exposureMode: "continuous",
        whiteBalanceMode: "continuous", 
        focusMode: "continuous"
      }
    });
    
    // Set up video element
    videoEl.srcObject = cameraStream;
    videoEl.setAttribute("playsinline", true);
    
    await new Promise((resolve) => {
      videoEl.onloadedmetadata = () => {
        videoEl.play();
        resolve();
      };
    });
    
    // Set canvas dimensions to match video
    canvas.width = videoEl.videoWidth;
    canvas.height = videoEl.videoHeight;
    
    setStatus("Ready. Point camera at a QR code.");
    scanningActive = true;
    
    // Start scanning loop
    scanLoop();
    
  } catch (error) {
    console.error("Camera error:", error);
    setStatus("Camera access denied. Use manual input below.");
    scanningActive = false;
  }
}

// Scanning loop using JSQR
function scanLoop() {
  if (!scanningActive) return;
  
  try {
    // Draw video frame to canvas
    context.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    
    // Get image data for QR detection
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    
    // Detect QR code using JSQR
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    });
    
    if (code) {
      // QR code detected!
      handleQr(code.data);
    }
  } catch (error) {
    console.error("Scan error:", error);
  }
  
  // Continue scanning
  requestAnimationFrame(scanLoop);
}

// Stop camera stream
function stopCamera() {
  scanningActive = false;
  
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }
  
  if (videoEl) {
    videoEl.srcObject = null;
  }
  
  setStatus("Camera stopped.");
}

// Start/Stop scanner buttons
startScanner.addEventListener("click", async () => {
  if (scanningActive) return;
  
  startScanner.disabled = true;
  stopScanner.disabled = false;
  
  await initJsQrScanner();
});

stopScanner.addEventListener("click", () => {
  stopCamera();
  startScanner.disabled = false;
  stopScanner.disabled = true;
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
  
  // Initialize scanner buttons
  startScanner.disabled = false;
  stopScanner.disabled = true;
  
  setStatus("Click 'Start' to begin scanning.");

  window.addEventListener("beforeunload", () => stopCamera());
}

init();
