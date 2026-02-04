import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

function getEnv(name) {
  const value = process.env[name];
  return value && String(value).trim() ? String(value).trim() : null;
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
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (!error && data?.user?.id) return data.user.id;

  const existingId = await findUserIdByEmail(adminClient, email);
  if (existingId) return existingId;

  throw error ?? new Error("Failed to create user.");
}

async function upsertProfile(adminClient, profile) {
  const { error } = await adminClient.from("profiles").upsert(profile, { onConflict: "id" });
  if (error) throw error;
}

async function main() {
  const { url, serviceRoleKey } = await loadSupabaseSecrets();
  const keyRole = getJwtRole(serviceRoleKey);
  if (keyRole !== "service_role") {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not a service_role key. Use the Supabase service role key (not anon/publishable)."
    );
  }
  const adminClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const commonPassword = "Password123!";

  const seedUsers = [
    { username: "ADM-2026-0000-0001", role: "admin", full_name: "Sample Admin" },
    { username: "TCH-2026-0000-0001", role: "teacher", full_name: "Sample Teacher" },
    { username: "PAR-2026-0000-0001", role: "parent", full_name: "Sample Parent" },
    { username: "GRD-2026-0000-0001", role: "guard", full_name: "Sample Guard" },
    { username: "CLC-2026-0000-0001", role: "clinic", full_name: "Sample Clinic" }
  ];

  for (const u of seedUsers) {
    const email = `${u.username.toLowerCase()}@educare.local`;
    const userId = await createOrGetUserId(adminClient, { email, password: commonPassword });

    await upsertProfile(adminClient, {
      id: userId,
      full_name: u.full_name,
      username: u.username,
      email,
      role: u.role,
      is_active: true,
    });
  }

  console.log("Seed complete. Use these logins on /auth/login.html:");
  console.log("Password (all users):", commonPassword);
  console.log(
    seedUsers
      .map((u) => `- user_id: ${u.username}  | role: ${u.role}`)
      .join("\n")
  );
}

main().catch((err) => {
  console.error("Seed failed:", err?.message ?? err);
  process.exitCode = 1;
});
