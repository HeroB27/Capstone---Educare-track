import { fetchUnreadNotificationsCount, redirectToLogin, requireAuthAndProfile, signOut } from "../core/core.js";
import { setShellNotificationsCount, setShellProfile } from "../core/shell.js";

export async function initAdminPage({ signOutButtonId = "signOutBtn", profileBadgeId = "profileBadge" } = {}) {
  const signOutBtn = document.getElementById(signOutButtonId);
  const profileBadge = document.getElementById(profileBadgeId);

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
    window.location.href = "/";
    return { error: new Error("Not authorized.") };
  }

  if (profileBadge) {
    profileBadge.textContent = `${profile.full_name} • ${profile.role}`;
    profileBadge.classList.remove("hidden");
  }

  setShellProfile({ fullName: profile.full_name, role: profile.role });
  const { count } = await fetchUnreadNotificationsCount(profile.id);
  setShellNotificationsCount(count ?? 0);

  return { profile };
}
