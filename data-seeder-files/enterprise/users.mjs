function pad(n, width = 4) {
  return String(n).padStart(width, "0");
}

function emailFromUsername(username) {
  return `${String(username).trim().toLowerCase()}@educare.local`;
}

async function findUserIdByEmail(adminClient, email) {
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const found = data.users.find((u) => String(u.email ?? "").toLowerCase() === String(email).toLowerCase());
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

function pickName(prefix, i) {
  const first = [
    "Alex",
    "Bea",
    "Carlo",
    "Dana",
    "Eli",
    "Faith",
    "Gio",
    "Hana",
    "Ivan",
    "Jade",
    "Kris",
    "Lia",
    "Mika",
    "Noel",
    "Owen",
    "Pia",
    "Quinn",
    "Rhea",
    "Seth",
    "Tina",
    "Uli",
    "Vince",
    "Wen",
    "Xander",
    "Yana",
    "Zeke",
  ];
  const last = [
    "Santos",
    "Reyes",
    "Cruz",
    "Garcia",
    "Torres",
    "Flores",
    "Gonzales",
    "Rivera",
    "Mendoza",
    "Ramos",
    "Diaz",
    "Bautista",
    "Villanueva",
    "Fernandez",
    "Aquino",
    "Castillo",
    "Navarro",
    "Del Rosario",
    "Domingo",
    "Valdez",
  ];
  const f = first[(i * 7) % first.length];
  const l = last[(i * 11) % last.length];
  return `${prefix} ${f} ${l}`;
}

export async function ensureEnterpriseUsers(adminClient, { password, teacherCount = 30, parentCount = 30 } = {}) {
  const commonPassword = password ?? "Password123!";

  const teachers = [];
  for (let i = 1; i <= teacherCount; i++) {
    const username = `TCH-2026-0000-${pad(i)}`;
    const email = emailFromUsername(username);
    const id = await createOrGetUserId(adminClient, { email, password: commonPassword });
    await upsertProfile(adminClient, {
      id,
      full_name: pickName("Teacher", i),
      username,
      email,
      role: "teacher",
      is_active: true,
    });
    teachers.push({ id, username, email });
  }

  const parents = [];
  for (let i = 1; i <= parentCount; i++) {
    const username = `PAR-2026-0000-${pad(i)}`;
    const email = emailFromUsername(username);
    const id = await createOrGetUserId(adminClient, { email, password: commonPassword });
    await upsertProfile(adminClient, {
      id,
      full_name: pickName("Parent", i),
      username,
      email,
      role: "parent",
      is_active: true,
    });
    parents.push({ id, username, email });
  }

  return { teachers, parents, commonPassword };
}

