import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import { ensureEnterpriseUsers } from "./users.mjs";

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

async function upsertGatekeepers(adminClient, teacherIds) {
  const { error } = await adminClient
    .from("system_settings")
    .upsert({ key: "teacher_gatekeepers", value: { teacher_ids: teacherIds } }, { onConflict: "key" });
  if (error) throw error;
}

function samplePngBuffer() {
  const b64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO9Ww9YAAAAASUVORK5CYII=";
  return Buffer.from(b64, "base64");
}

async function ensureExcuseAttachments(adminClient, { limit = 50 } = {}) {
  const { data, error } = await adminClient
    .from("excuse_letters")
    .select("id,attachment_path,attachment_mime")
    .not("attachment_path", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  const rows = data ?? [];
  if (!rows.length) return { attempted: 0, uploaded: 0 };

  const buf = samplePngBuffer();
  let uploaded = 0;
  for (const r of rows) {
    const filePath = String(r.attachment_path ?? "").trim();
    if (!filePath) continue;
    const contentType = String(r.attachment_mime ?? "image/png") || "image/png";
    const res = await adminClient.storage.from("excuse_letters").upload(filePath, buf, { contentType, upsert: false });
    if (!res.error) {
      uploaded += 1;
      continue;
    }
    const msg = String(res.error.message ?? "");
    if (msg.toLowerCase().includes("already exists")) continue;
    if (String(res.error.statusCode ?? "") === "409") continue;
  }
  return { attempted: rows.length, uploaded };
}

async function runEnterpriseSeed(adminClient, seedTag) {
  const { error } = await adminClient.rpc("run_enterprise_seed", { seed_tag: seedTag });
  if (!error) return;
  const msg = String(error.message ?? "");
  if (msg.includes("Could not find the function") || msg.includes("schema cache")) {
    throw new Error(
      "Database seed function is not installed yet. Run the SQL in supabase_migrations/2026-02-04_enterprise_seed_v1.0.0.sql in the Supabase SQL editor, then rerun npm run seed:enterprise."
    );
  }
  if (msg.toLowerCase().includes('relation "pick_gate" does not exist')) {
    throw new Error(
      "Your Supabase database still has the older enterprise seed function installed. Re-run the updated SQL in supabase_migrations/2026-02-04_enterprise_seed_v1.0.0.sql (it uses a single gatekeeper and removes pick_gate), then rerun npm run seed:enterprise."
    );
  }
  if (msg.toLowerCase().includes('violates foreign key constraint "clinic_passes_clinic_visit_id_fkey"')) {
    throw new Error(
      "Your Supabase database has an older enterprise seed function that inserts clinic_passes before clinic_visits. Re-run the updated SQL in supabase_migrations/2026-02-04_enterprise_seed_v1.0.0.sql, then rerun npm run seed:enterprise."
    );
  }
  if (msg.toLowerCase().includes("missing column public.announcements.class_id")) {
    throw new Error(
      "Your database is missing announcements.class_id. Apply the Phase 3 migration first, then rerun the enterprise seed SQL and npm run seed:enterprise."
    );
  }
  if (msg.toLowerCase().includes("missing attachment columns on public.excuse_letters")) {
    throw new Error(
      "Your database is missing excuse_letters attachment columns. Apply the Phase 3 migration first, then rerun the enterprise seed SQL and npm run seed:enterprise."
    );
  }
  throw error;
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

  const seedTag = getEnv("SEED_TAG") ?? "enterprise_v1";
  const teacherCount = Number(getEnv("SEED_TEACHERS") ?? "30");
  const parentCount = Number(getEnv("SEED_PARENTS") ?? "30");
  const password = getEnv("SEED_PASSWORD") ?? "Password123!";

  const { teachers, parents, commonPassword } = await ensureEnterpriseUsers(adminClient, {
    password,
    teacherCount,
    parentCount,
  });

  const gatekeepers = teachers.slice(0, 2).map((t) => t.id);
  await upsertGatekeepers(adminClient, gatekeepers);

  await runEnterpriseSeed(adminClient, seedTag);
  const att = await ensureExcuseAttachments(adminClient, { limit: 80 });

  console.log("Enterprise seed complete.");
  console.log("Password (all seeded users):", commonPassword);
  console.log("Teachers:", teachers.length, "| Parents:", parents.length);
  console.log("Teacher gatekeepers:", gatekeepers.length);
  console.log("Excuse attachments attempted:", att.attempted, "| uploaded:", att.uploaded);
}

main().catch((err) => {
  console.error("Enterprise seed failed:", err?.message ?? err);
  process.exitCode = 1;
});
