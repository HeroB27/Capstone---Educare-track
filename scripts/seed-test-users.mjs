import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

function getEnv(name) {
  const value = process.env[name];
  return value && String(value).trim() ? String(value).trim() : null;
}

function emailFromUsername(username) {
  return `${String(username ?? "").trim().toLowerCase()}@educare.local`;
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
  if (existingId) {
    const { error: updateError } = await adminClient.auth.admin.updateUserById(existingId, {
      email,
      password,
    });
    if (updateError) throw updateError;
    return existingId;
  }

  throw error ?? new Error("Failed to create user.");
}

async function upsertProfile(adminClient, profile) {
  const { error } = await adminClient.from("profiles").upsert(profile, { onConflict: "id" });
  if (error) throw error;
}

async function createStudent(adminClient, studentData) {
  const { error } = await adminClient.from("students").upsert(studentData, { onConflict: "id" });
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

  // Test users for all roles
  const testUsers = [
    {
      username: "ADM-2026-0001-0001",
      role: "admin",
      full_name: "Test Administrator",
      phone: "+639123456789"
    },
    {
      username: "TCH-2026-0001-0001", 
      role: "teacher",
      full_name: "Test Teacher",
      phone: "+639123456780"
    },
    {
      username: "PAR-2026-0001-0001",
      role: "parent", 
      full_name: "Test Parent",
      phone: "+639123456781"
    },
    {
      username: "GRD-2026-0001-0001",
      role: "guard",
      full_name: "Test Guard",
      phone: "+639123456782"
    },
    {
      username: "CLC-2026-0001-0001",
      role: "clinic",
      full_name: "Test Clinic Staff",
      phone: "+639123456783"
    }
  ];

  console.log("Creating test users...");
  
  for (const u of testUsers) {
    const email = emailFromUsername(u.username);
    const userId = await createOrGetUserId(adminClient, { 
      email, 
      password: commonPassword 
    });

    await upsertProfile(adminClient, {
      id: userId,
      full_name: u.full_name,
      username: u.username,
      email,
      phone: u.phone,
      role: u.role,
      is_active: true,
      is_gatekeeper: u.role === "guard", // Set gatekeeper flag for guards
    });

    console.log(`✓ Created ${u.role}: ${u.full_name} (${email})`);
  }

  // Create a test student linked to the parent
  console.log("\nCreating test student...");
  const parentUser = testUsers.find(u => u.role === "parent");
  const parentEmail = emailFromUsername(parentUser.username);
  const parentUserId = await findUserIdByEmail(adminClient, parentEmail);
  
  const testStudent = {
    id: "550e8400-e29b-41d4-a716-446655440001", // Fixed UUID for consistency
    full_name: "Test Student",
    lrn: "123456789012",
    grade_level: "7",
    strand: "STEM",
    parent_id: parentUserId,
    current_status: "out",
    address: "123 Test Street, Test City"
  };

  await createStudent(adminClient, testStudent);
  console.log(`✓ Created student: ${testStudent.full_name} (LRN: ${testStudent.lrn})`);

  console.log("\n🎉 Test users created successfully!");
  console.log("\n📋 Login Credentials:");
  console.log("Password (all users):", commonPassword);
  console.log("\n👥 User Accounts:");
  
  testUsers.forEach(u => {
    const email = emailFromUsername(u.username);
    console.log(`- ${u.role.toUpperCase()}: ${email} (${u.full_name})`);
  });
  
  console.log("\n👨‍🎓 Test Student:");
  console.log(`- Name: ${testStudent.full_name}`);
  console.log(`- LRN: ${testStudent.lrn}`);
  console.log(`- Grade: ${testStudent.grade_level} ${testStudent.strand}`);
  console.log(`- Parent: ${parentUser.full_name} (${parentEmail})`);
  
  console.log("\n🔗 Access the system at: /auth/login.html");
}

main().catch((err) => {
  console.error("❌ Seed failed:", err?.message ?? err);
  process.exitCode = 1;
});
