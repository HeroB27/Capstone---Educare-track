import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

function getEnv(name) {
  const value = process.env[name];
  return value && String(value).trim() ? String(value).trim() : null;
}

async function loadSupabaseSecrets() {
  const urlFromEnv = getEnv("SUPABASE_URL");
  const serviceKeyFromEnv = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (urlFromEnv && serviceKeyFromEnv) {
    return { url: urlFromEnv, serviceRoleKey: serviceKeyFromEnv };
  }

  const fallbackPath = path.resolve(".trae", "rules", "Supabase information");
  const raw = await fs.readFile(fallbackPath, "utf8");

  const urlMatch = raw.match(/public url\s*=\s*(https:\/\/[^\s]+)/i);
  const serviceMatch = raw.match(/service role key\s*=\s*([^\s]+)/i);

  const url = urlFromEnv ?? (urlMatch ? urlMatch[1] : null);
  const serviceRoleKey = serviceKeyFromEnv ?? (serviceMatch ? serviceMatch[1] : null);

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY. Set env vars or ensure .trae/rules/Supabase information exists."
    );
  }

  return { url, serviceRoleKey };
}

function getJwtRole(token) {
  const parts = String(token ?? "").split(".");
  if (parts.length < 2) return null;
  const payloadB64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = payloadB64.padEnd(payloadB64.length + ((4 - (payloadB64.length % 4)) % 4), "=");
  const json = Buffer.from(padded, "base64").toString("utf8");
  const payload = JSON.parse(json);
  return payload?.role ? String(payload.role) : null;
}

function toEmail(userId) {
  const safe = String(userId).trim().toLowerCase();
  if (safe.includes("@")) return safe;
  return `${safe}@educare.local`;
}

async function findUserIdByEmail(adminClient, email) {
  let page = 1;
  const perPage = 1000;
  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const found = data.users.find((u) => String(u.email ?? "").toLowerCase() === email.toLowerCase());
    if (found?.id) return found.id;
    if (data.users.length < perPage) return null;
    page += 1;
  }
}

async function createOrGetUserId(adminClient, { email, password }) {
  const pwd = String(password ?? "").trim();
  if (!pwd) {
    const existingId = await findUserIdByEmail(adminClient, email);
    if (existingId) return existingId;
    throw new Error(`Password is required to create a new auth user for ${email}`);
  }

  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password: pwd,
    email_confirm: true,
  });
  if (!error && data?.user?.id) return data.user.id;

  const existingId = await findUserIdByEmail(adminClient, email);
  if (existingId) return existingId;

  throw error ?? new Error("Failed to create user.");
}

async function upsertProfile(adminClient, { userId, username, profile }) {
  const payload = {
    id: userId,
    username,
    full_name: profile.full_name,
    phone: profile.phone ?? null,
    address: profile.address ?? null,
    email: profile.email ?? null,
    role: profile.role,
    is_active: profile.is_active ?? true,
  };
  const { error } = await adminClient.from("profiles").upsert(payload, { onConflict: "id" });
  if (error) throw error;
}

function randomFourDigits() {
  return String(Math.floor(Math.random() * 9000) + 1000);
}

function lastFourDigits(value) {
  const digits = String(value ?? "").replaceAll(/\D/g, "");
  return digits.slice(-4).padStart(4, "0");
}

function generateStudentUserIdFromLrn(lrn) {
  const year = new Date().getFullYear();
  return `EDU-${year}-${lastFourDigits(lrn)}-${randomFourDigits()}`;
}

async function createStudent(adminClient, parentId, student) {
  const { data, error } = await adminClient
    .from("students")
    .insert({
      full_name: student.full_name,
      lrn: student.lrn ?? null,
      grade_level: student.grade_level,
      strand: student.strand ?? null,
      address: student.address ?? null,
      parent_id: parentId,
      current_status: "out",
    })
    .select("id")
    .limit(1);
  if (error) throw error;
  const id = data?.[0]?.id;
  if (!id) throw new Error("Student created but id not returned.");
  return id;
}

async function createStudentId(adminClient, studentId, qrCode) {
  const { error } = await adminClient.from("student_ids").insert({
    student_id: studentId,
    qr_code: qrCode,
    is_active: true,
  });
  if (!error) return;

  const fallback = `${qrCode}-${randomFourDigits()}`;
  const retry = await adminClient.from("student_ids").insert({
    student_id: studentId,
    qr_code: fallback,
    is_active: true,
  });
  if (retry.error) throw retry.error;
}

async function provisionOne(adminClient, account) {
  const userId = String(account.user_id ?? "").trim();
  const password = String(account.password ?? "");
  if (!userId) throw new Error("Each account needs user_id.");

  const email = toEmail(userId);
  const authUserId = await createOrGetUserId(adminClient, { email, password });

  if (!account.profile?.full_name || !account.profile?.role) {
    throw new Error(`Missing profile fields for ${userId}`);
  }
  await upsertProfile(adminClient, { userId: authUserId, username: userId, profile: account.profile });

  if (account.kind === "parent_bundle") {
    const students = Array.isArray(account.students) ? account.students : [];
    for (const s of students) {
      if (!s.full_name || !s.grade_level) throw new Error(`Student missing required fields for ${userId}`);
      const studentId = await createStudent(adminClient, authUserId, s);
      const qr = String(s.qr_code ?? "").trim() || generateStudentUserIdFromLrn(s.lrn);
      await createStudentId(adminClient, studentId, qr);
    }
  }
}

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    throw new Error("Usage: node scripts/provision-users.mjs <export.json>");
  }

  const raw = await fs.readFile(path.resolve(inputPath), "utf8");
  const payload = JSON.parse(raw);
  const accounts = Array.isArray(payload?.accounts) ? payload.accounts : null;
  if (!accounts) throw new Error("Invalid export format: expected { accounts: [...] }");

  const { url, serviceRoleKey } = await loadSupabaseSecrets();
  const keyRole = getJwtRole(serviceRoleKey);
  if (keyRole !== "service_role") {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not a service_role key.");
  }

  const adminClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  for (const account of accounts) {
    await provisionOne(adminClient, account);
  }

  console.log(`Provisioned ${accounts.length} account(s).`);
}

main().catch((err) => {
  console.error("Provision failed:", err?.message ?? err);
  process.exitCode = 1;
});
