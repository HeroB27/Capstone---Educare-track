import {
  fetchMyProfile,
  requireAuthAndProfile,
  redirectToDashboard,
  signInWithUserIdPassword,
  signOut,
  supabase,
} from "../core/core.js";
import { registerPwa } from "../core/pwa.js";

const loginForm = document.getElementById("loginForm");
const userIdInput = document.getElementById("userId");
const passwordInput = document.getElementById("password");
const loginButton = document.getElementById("loginButton");
const errorBox = document.getElementById("errorBox");
const forgotBtn = document.getElementById("forgotBtn");
const signOutBtn = document.getElementById("signOutBtn");
const forgotModal = document.getElementById("forgotModal");
const closeForgotModal = document.getElementById("closeForgotModal");
const forgotUserId = document.getElementById("forgotUserId");
const forgotNote = document.getElementById("forgotNote");
const sendForgotBtn = document.getElementById("sendForgotBtn");
const forgotStatus = document.getElementById("forgotStatus");

function showError(message) {
  errorBox.textContent = message;
  errorBox.classList.remove("hidden");
}

function clearError() {
  errorBox.textContent = "";
  errorBox.classList.add("hidden");
}

function setLoading(isLoading) {
  loginButton.disabled = isLoading;
  loginButton.textContent = isLoading ? "Signing in..." : "Sign in";
}

forgotBtn.addEventListener("click", () => {
  forgotUserId.value = userIdInput.value.trim();
  forgotNote.value = "";
  forgotStatus.textContent = "";
  forgotStatus.classList.add("hidden");
  forgotModal.classList.remove("hidden");
  forgotModal.classList.add("flex");
});

closeForgotModal.addEventListener("click", () => {
  forgotModal.classList.add("hidden");
  forgotModal.classList.remove("flex");
});

forgotModal.addEventListener("click", (e) => {
  if (e.target === forgotModal) {
    forgotModal.classList.add("hidden");
    forgotModal.classList.remove("flex");
  }
});

sendForgotBtn.addEventListener("click", async () => {
  const userId = forgotUserId.value.trim();
  if (!userId) {
    forgotStatus.textContent = "User ID is required.";
    forgotStatus.classList.remove("hidden");
    return;
  }

  sendForgotBtn.disabled = true;
  forgotStatus.textContent = "Sending request…";
  forgotStatus.classList.remove("hidden");

  const { error } = await supabase.from("password_reset_requests").insert({
    requested_user_id: userId,
    note: forgotNote.value.trim() || null,
    status: "pending",
    requested_by: userId, // Self-requested
  });

  if (error) {
    sendForgotBtn.disabled = false;
    forgotStatus.textContent = error.message;
    return;
  }

  forgotStatus.textContent = "Request sent. Please wait for the admin to reset your password.";
});

signOutBtn.addEventListener("click", async () => {
  clearError();
  await signOut();
  signOutBtn.classList.add("hidden");
});

async function tryAutoRedirect() {
  const { profile } = await requireAuthAndProfile();
  if (profile?.role && profile.is_active) {
    signOutBtn.classList.remove("hidden");
    redirectToDashboard(profile.role);
  }
}

tryAutoRedirect();
registerPwa();

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearError();
  setLoading(true);

  const userId = userIdInput.value;
  const password = passwordInput.value;

  const { error: signInError } = await signInWithUserIdPassword(userId, password);
  if (signInError) {
    setLoading(false);
    showError(signInError.message || "Sign-in failed.");
    return;
  }

  const { profile, error: profileError } = await fetchMyProfile();
  if (profileError) {
    await signOut();
    setLoading(false);
    showError("Signed in, but no profile is linked. Contact admin to set your role.");
    return;
  }

  redirectToDashboard(profile.role);
});
