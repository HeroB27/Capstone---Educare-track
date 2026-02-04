import { fetchUnreadNotificationsCount, redirectToDashboard, redirectToLogin, requireAuthAndProfile, signOut, supabase } from "../core/core.js";
import { setShellNotificationsCount, setShellProfile } from "../core/shell.js";

export async function initTeacherPage({ signOutButtonId = "signOutBtn", profileBadgeId = "profileBadge" } = {}) {
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

  if (profile.role !== "teacher") {
    redirectToDashboard(profile.role);
    return { error: new Error("Not authorized.") };
  }

  if (profileBadge) {
    profileBadge.textContent = `${profile.full_name} • ${profile.role}`;
    profileBadge.classList.remove("hidden");
  }

  setShellProfile({ fullName: profile.full_name, role: profile.role });
  const { count } = await fetchUnreadNotificationsCount(profile.id);
  setShellNotificationsCount(count ?? 0);

  const gatekeeperLink = document.querySelector('a[href="./teacher-gatekeeper-scanner.html"]');
  if (gatekeeperLink) {
    const { data } = await supabase
      .from("system_settings")
      .select("id,key,value")
      .eq("key", "teacher_gatekeepers")
      .maybeSingle();
    const ids = Array.isArray(data?.value?.teacher_ids) ? data.value.teacher_ids : [];
    const isGatekeeper = ids.includes(profile.id);
    if (!isGatekeeper) gatekeeperLink.remove();
  }

  return { profile };
}
