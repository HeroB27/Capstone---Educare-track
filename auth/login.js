import {
  fetchMyProfile,
  requireAuthAndProfile,
  redirectToDashboard,
  signInWithUserIdPassword,
  signOut,
  isLoggedIn,
  getSession,
  clearCachedProfile,
  supabase,
} from "../core/core.js";
import { registerPwa } from "../core/pwa.js";

const loginForm = document.getElementById("loginForm");
const userIdInput = document.getElementById("userId");
const passwordInput = document.getElementById("password");
const loginButton = document.getElementById("loginButton");
const errorBox = document.getElementById("errorBox");
const signOutBtn = document.getElementById("signOutBtn");

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

async function tryAutoRedirect() {
  // Check if already logged in with local session
  const session = getSession();
  if (session?.profile?.role && session?.profile?.is_active) {
    signOutBtn.classList.remove("hidden");
    redirectToDashboard(session.profile.role);
    return;
  }
  
  // Try to fetch profile
  const { profile, error } = await requireAuthAndProfile();
  if (profile?.role && profile?.is_active) {
    signOutBtn.classList.remove("hidden");
    redirectToDashboard(profile.role);
  }
}

tryAutoRedirect();
registerPwa();

signOutBtn.addEventListener("click", async () => {
  clearError();
  await signOut();
  signOutBtn.classList.add("hidden");
  userIdInput.value = "";
  passwordInput.value = "";
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearError();
  setLoading(true);

  const userId = userIdInput.value.trim();
  const password = passwordInput.value;

  if (!userId) {
    setLoading(false);
    showError("User ID is required.");
    return;
  }

  if (!password) {
    setLoading(false);
    showError("Password is required.");
    return;
  }

  const { error } = await signInWithUserIdPassword(userId, password);
  
  if (error) {
    setLoading(false);
    showError(error.message || "Sign-in failed.");
    return;
  }

  // Get profile and redirect
  const { profile, error: profileError } = await fetchMyProfile();
  if (profileError) {
    setLoading(false);
    showError("Login successful but could not load profile. Please try again.");
    return;
  }

  if (!profile?.is_active) {
    setLoading(false);
    showError("Account is inactive. Contact admin.");
    return;
  }

  // Redirect directly to people page (faster)
  window.location.href = "/admin/admin-people.html";
});
