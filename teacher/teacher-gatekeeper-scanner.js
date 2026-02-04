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
  // Check the teachers table for gatekeeper_role boolean
  const { data, error } = await supabase
    .from("teachers")
    .select("gatekeeper_role")
    .eq("id", profileId)
    .single();
  
  if (error) {
    console.error("[Gatekeeper] Error checking gatekeeper_role:", error.message);
    // Fallback: check system_settings if teachers lookup fails
    return checkSystemSettingsFallback(profileId);
  }
  
  const hasRole = data?.gatekeeper_role === true;
  console.log("[Gatekeeper] Teacher", profileId, "gatekeeper_role:", hasRole);
  return hasRole;
}

/**
 * Fallback: Check system_settings for teacher_gatekeepers
 * This maintains backward compatibility with existing deployments
 */
async function checkSystemSettingsFallback(profileId) {
  try {
    const { data, error } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "teacher_gatekeepers")
      .maybeSingle();
    
    if (error) {
      console.error("[Gatekeeper] Fallback check failed:", error.message);
      return false;
    }
    
    // If setting doesn't exist, deny access (admin needs to configure)
    if (!data?.value) {
      console.log("[Gatekeeper] No teacher_gatekeepers setting found");
      return false;
    }
    
    const ids = Array.isArray(data.value.teacher_ids) ? data.value.teacher_ids : [];
    const hasAccess = ids.includes(profileId);
    console.log("[Gatekeeper] Fallback access check:", hasAccess);
    return hasAccess;
  } catch (e) {
    console.error("[Gatekeeper] Fallback exception:", e.message);
    return false;
  }
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
    if (res.result === "blocked") {
      setStatus(res.event?.title ? `No classes today: ${res.event.title}` : "No classes today.");
      return;
    }
    if (res.result === "rejected") {
      setStatus(res.reason === "no_in" ? "Tap out rejected: no tap-in recorded today." : "Tap rejected.");
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
