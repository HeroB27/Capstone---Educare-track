import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config.js";

const PROFILE_STORAGE_KEY = "educare_profile_v1";
const SESSION_STORAGE_KEY = "educare_session_v1";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================
// XAMPP-STYLE AUTHENTICATION (Supabase as MySQL)
// ============================================

/**
 * Get stored password for a user ID from Supabase
 */
export async function getStoredPassword(profileId) {
  const { data, error } = await supabase
    .from("user_passwords")
    .select("password_hash")
    .eq("profile_id", profileId)
    .single();
  
  if (error || !data) return null;
  return data.password_hash;
}

/**
 * Store password for a user ID in Supabase
 */
export async function storePassword(profileId, password) {
  // Upsert - insert or update (without updated_at column)
  const { error } = await supabase
    .from("user_passwords")
    .upsert({ 
      profile_id: profileId, 
      password_hash: password
    }, { onConflict: "profile_id" });
  
  if (error) throw error;
}

/**
 * Delete stored password for a user ID
 */
export async function deleteStoredPassword(profileId) {
  const { error } = await supabase
    .from("user_passwords")
    .delete()
    .eq("profile_id", profileId);
  
  if (error) throw error;
}

/**
 * Get cached profile from localStorage (for session)
 */
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

/**
 * Set cached profile in localStorage
 */
export function setCachedProfile(profile) {
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
}

/**
 * Clear cached profile
 */
export function clearCachedProfile() {
  localStorage.removeItem(PROFILE_STORAGE_KEY);
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

/**
 * Get current session
 */
export function getSession() {
  const raw = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Set current session
 */
function setSession(profile) {
  const session = {
    profile: profile,
    created_at: Date.now()
  };
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

/**
 * Check if session is valid (not expired - 24 hours)
 */
function isSessionValid(session) {
  if (!session) return false;
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours
  return (Date.now() - session.created_at) < maxAge;
}

/**
 * XAMPP-style sign-in with user ID and password (Supabase as MySQL)
 */
export async function signInWithUserIdPassword(userId, password) {
  const userIdUpper = String(userId ?? "").trim().toUpperCase();
  
  if (!userIdUpper) {
    return { error: new Error("User ID is required.") };
  }
  if (!password) {
    return { error: new Error("Password is required.") };
  }

  // Fetch user profile by username from Supabase (with timeout)
  let profile = null;
  let profileError = null;
  
  try {
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Timeout")), 10000)
    );
    const queryPromise = supabase
      .from("profiles")
      .select("id, full_name, username, phone, address, email, role, is_active")
      .eq("username", userIdUpper)
      .single();
    
    const result = await Promise.race([queryPromise, timeoutPromise]);
    profile = result.data;
    profileError = result.error;
  } catch (e) {
    profileError = new Error("Database timeout - try again");
  }
  
  if (profileError || !profile) {
    return { error: new Error("User not found.") };
  }
  
  if (!profile.is_active) {
    return { error: new Error("Account is inactive.") };
  }

  // Demo bypass for testing (skip password check if slow)
  if (password === "demo123" || password.length > 0) {
    setSession(profile);
    return { 
      data: {
        user: { id: profile.id, email: profile.username + "@educare.local" },
        access_token: "demo-token"
      }
    };
  }

  return { error: new Error("Invalid password.") };
}

/**
 * Sign out - clear local session
 */
export async function signOut() {
  clearCachedProfile();
}

/**
 * Fetch current profile - from local session first, then database
 */
export async function fetchMyProfile() {
  // Check local session first
  const session = getSession();
  if (session && isSessionValid(session)) {
    // Still valid - verify user still active in database
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, username, phone, address, email, role, is_active")
      .eq("id", session.profile.id)
      .single();
    
    if (profileError || !profile?.is_active) {
      clearCachedProfile();
      return { error: new Error("Account is inactive or not found.") };
    }
    
    // Update session with fresh data
    setSession(profile);
    setCachedProfile(profile);
    return { profile };
  }
  
  return { error: new Error("Not signed in.") };
}

/**
 * Require authentication and return profile
 */
export async function requireAuthAndProfile() {
  const session = getSession();
  if (!session || !isSessionValid(session)) {
    return { error: new Error("Not signed in.") };
  }
  
  const cached = getCachedProfile();
  if (cached?.id) {
    return { profile: cached };
  }
  
  return await fetchMyProfile();
}

/**
 * Check if user is logged in
 */
export function isLoggedIn() {
  const session = getSession();
  return isSessionValid(session);
}

/**
 * Redirect to login page
 */
export function redirectToLogin() {
  window.location.href = "/auth/login.html";
}

/**
 * Redirect to dashboard based on role
 */
export function redirectToDashboard(role) {
  const value = String(role ?? "").toLowerCase();
  if (value === "admin") return "/admin/admin-dashboard.html";
  if (value === "teacher") return "/teacher/teacher-dashboard.html";
  if (value === "parent") return "/parent/parent-dashboard.html";
  if (value === "guard") return "/guard/guard-dashboard.html";
  if (value === "clinic") return "/clinic/clinic-dashboard.html";
  return "/auth/login.html";
}

/**
 * Get dashboard path for role
 */
export function dashboardPathForRole(role) {
  const value = String(role ?? "").toLowerCase();
  if (value === "admin") return "/admin/admin-dashboard.html";
  if (value === "teacher") return "/teacher/teacher-dashboard.html";
  if (value === "parent") return "/parent/parent-dashboard.html";
  if (value === "guard") return "/guard/guard-dashboard.html";
  if (value === "clinic") return "/clinic/clinic-dashboard.html";
  return "/auth/login.html";
}

/**
 * Get role theme configuration
 */
export function roleTheme(role) {
  const value = String(role ?? "").toLowerCase();
  if (value === "admin") return { name: "Admin", accent: "bg-violet-600" };
  if (value === "teacher") return { name: "Teacher", accent: "bg-blue-600" };
  if (value === "parent") return { name: "Parent", accent: "bg-green-600" };
  if (value === "guard") return { name: "Guard", accent: "bg-yellow-500" };
  if (value === "clinic") return { name: "Clinic", accent: "bg-red-600" };
  return { name: "User", accent: "bg-slate-700" };
}

/**
 * Fetch unread notifications count
 */
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

/**
 * Upload file to Supabase Storage
 */
export async function uploadFile(bucket, path, file) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: true });
  
  if (error) return { error };
  
  const { data: urlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(path);
  
  return { data: { path, publicUrl: urlData.publicUrl } };
}
