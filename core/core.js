import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config.js";

const PROFILE_STORAGE_KEY = "educare_profile_v1";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export function getCachedProfile() {
  const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem(PROFILE_STORAGE_KEY);
    return null;
  }
}

export function setCachedProfile(profile) {
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
}

export function clearCachedProfile() {
  localStorage.removeItem(PROFILE_STORAGE_KEY);
}

function userIdToEmail(userId) {
  const value = String(userId ?? "").trim().toLowerCase();
  if (!value) return "";
  if (value.includes("@")) return value;
  return `${value}@educare.local`;
}

export async function signInWithUserIdPassword(userId, password) {
  const email = userIdToEmail(userId);
  if (!email) return { error: new Error("User ID is required.") };
  if (!password) return { error: new Error("Password is required.") };

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) return { error };
  return { data };
}

export async function signOut() {
  clearCachedProfile();
  await supabase.auth.signOut();
}

export async function fetchMyProfile() {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) return { error: userError };
  if (!userData?.user) return { error: new Error("Not signed in.") };

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, username, role, is_active")
    .eq("id", userData.user.id)
    .single();

  if (profileError) return { error: profileError };
  if (!profile?.is_active) return { error: new Error("Account is inactive.") };

  setCachedProfile(profile);
  return { profile };
}

export async function requireAuthAndProfile() {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session) return { error: new Error("Not signed in.") };

  const cached = getCachedProfile();
  if (cached?.role) return { profile: cached };

  return await fetchMyProfile();
}

export async function fetchUnreadNotificationsCount(profileId) {
  const id = String(profileId ?? "").trim();
  if (!id) return { count: 0 };
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", id)
    .eq("read", false);
  if (error) return { error };
  return { count: Number(count ?? 0) };
}

export function dashboardPathForRole(role) {
  const value = String(role ?? "").toLowerCase();
  if (value === "admin") return "/admin/admin-dashboard.html";
  if (value === "teacher") return "/teacher/teacher-dashboard.html";
  if (value === "parent") return "/parent/parent-dashboard.html";
  if (value === "guard") return "/guard/guard-dashboard.html";
  if (value === "clinic") return "/clinic/clinic-dashboard.html";
  return "/auth/login.html";
}

export function roleTheme(role) {
  const value = String(role ?? "").toLowerCase();
  if (value === "admin") return { name: "Admin", accent: "bg-violet-600" };
  if (value === "teacher") return { name: "Teacher", accent: "bg-blue-600" };
  if (value === "parent") return { name: "Parent", accent: "bg-green-600" };
  if (value === "guard") return { name: "Guard", accent: "bg-yellow-500" };
  if (value === "clinic") return { name: "Clinic", accent: "bg-red-600" };
  return { name: "User", accent: "bg-slate-700" };
}

export function redirectToLogin() {
  window.location.href = "/auth/login.html";
}

export function redirectToDashboard(role) {
  window.location.href = dashboardPathForRole(role);
}
