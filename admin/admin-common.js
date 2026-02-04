import { fetchUnreadNotificationsCount, redirectToLogin, requireAuthAndProfile, signOut } from "../core/core.js";
import { setShellNotificationsCount, setShellProfile } from "../core/shell.js";

export async function initAdminPage({ signOutButtonId = "signOutBtn", profileBadgeId = "profileBadge" } = {}) {
  const signOutBtn = document.getElementById(signOutButtonId);
  const profileBadge = document.getElementById(profileBadgeId);

  // Mark sidebar as premium to prevent shell.js from overwriting
  const sidebar = document.getElementById("appSidebar");
  if (sidebar) {
    sidebar.setAttribute("data-premium", "true");
  }

  if (signOutBtn) {
    signOutBtn.addEventListener("click", async () => {
      await signOut();
      redirectToLogin();
    });
  }

  const { profile, error } = await requireAuthAndProfile();
  if (error) {
    redirectToLogin();
    return { error };
  }

  if (profile.role !== "admin") {
    const err = new Error("Not authorized.");
    window.location.href = "/";
    return { error: err };
  }

  // Update premium sidebar user name
  const sidebarUserName = document.getElementById("sidebarUserName");
  if (sidebarUserName && profile.full_name) {
    sidebarUserName.textContent = profile.full_name;
  }

  // Update premium sidebar user role
  const sidebarUserRole = document.getElementById("sidebarUserRole");
  if (sidebarUserRole) {
    sidebarUserRole.textContent = "Administrator";
  }

  // Update premium sidebar user initials
  const sidebarUserInitials = document.getElementById("sidebarUserInitials");
  if (sidebarUserInitials && profile.full_name) {
    const initials = profile.full_name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
    sidebarUserInitials.textContent = initials;
  }

  // Update top nav user name
  const userNameEl = document.getElementById("userName");
  if (userNameEl && profile.full_name) {
    userNameEl.textContent = profile.full_name;
  }

  // Update user initials for top nav
  const userInitials = document.getElementById("userInitials");
  if (userInitials && profile.full_name) {
    const initials = profile.full_name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
    userInitials.textContent = initials;
  }

  // Update profile badge in sidebar
  if (profileBadge) {
    profileBadge.classList.remove("hidden");
  }

  setShellProfile({ fullName: profile.full_name, role: profile.role });
  const { count } = await fetchUnreadNotificationsCount(profile.id);
  setShellNotificationsCount(count ?? 0);

  return { profile };
}
