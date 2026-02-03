import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json({ error: "Missing Supabase env" }, 500);
  const admin = createClient(supabaseUrl, serviceKey);

  const firstNames = ["Juan","Maria","Jose","Elena","Ricardo","Liza","Antonio","Teresita","Gabriel","Carmelita","Mateo","Angelita","Dominador","Priscila","Ramon","Imelda","Felipe","Corazon","Emilio","Lourdes"];
  const lastNames = ["Pascua","Bautista","Cariño","Domogan","Molintas","Fianza","Aliping","Cosalan","Vergara","Mauricio","Tabora","Bugnosen","Hamada","Okubo","Bello","Perez","Garcia","Dimalanta","Santos","Reyes"];
  const grades = ["Kinder","1","2","3","4","5","6","7","8","9","10"];
  const strands = [];
  const subjects = ["MATH","SCI","ENG","FIL","MAPEH","AP","ESP"];
  const defaultPassword = "password123";
  const year = new Date().getFullYear();

  function staffId(role: string, phone: string) {
    const p = role === "admin" ? "ADM" : role === "teacher" ? "TCH" : role === "clinic" ? "CLC" : "GRD";
    const last4 = phone.replace(/\D/g, "").slice(-4);
    const r = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${p}-${year}-${last4}-${r}`;
  }
  function studentId(lrn: string) {
    const last4 = lrn.slice(-4);
    const r = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `EDU-${year}-${last4}-${r}`;
  }

  let usersCreated = 0;
  let attCreated = 0;
  let eventsCreated = 0;
  let subjectsCreated = 0;
  let classesCreated = 0;
  let schedulesCreated = 0;
  let parentsCreated = 0;
  let studentsCreated = 0;

  async function ensureAuthAndProfile(email: string, role: string, full_name: string, username: string, phone: string) {
    const { data: existingProfiles } = await admin.from("profiles").select("id").eq("email", email).limit(1);
    if (existingProfiles && existingProfiles.length > 0) return existingProfiles[0].id as string;
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: defaultPassword,
      email_confirm: true,
      user_metadata: { full_name, role, username, phone },
    });
    if (createErr || !created?.user) throw new Error(createErr?.message ?? "createUser failed");
    const uid = created.user.id;
    const { error: profileErr } = await admin.from("profiles").upsert({
      id: uid,
      role,
      full_name,
      phone,
      email,
      username,
      is_active: true,
    });
    if (profileErr) throw new Error(profileErr.message);
    usersCreated++;
    return uid;
  }

  async function wipe() {
    const tables = [
      "attendance_validations",
      "subject_attendance",
      "attendance_events",
      "attendance",
      "clinic_passes",
      "clinic_visits",
      "excuse_letters",
      "parent_students",
      "qr_codes",
      "class_schedules",
      "announcements",
      "notifications",
      "audit_logs",
      "attendance_rules",
      "school_calendar",
      "students",
      "classes",
      "subjects",
      "teachers",
      "parents",
      "guards",
      "clinic_staff",
      "admin_staff",
      "profiles",
    ];
    for (const t of tables) {
      await admin.from(t).delete();
    }
    let page = 1;
    const perPage = 200;
    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error) break;
      const users = data?.users ?? [];
      for (const u of users) {
        const e = u.email ?? "";
        if (e.endsWith("@educare.edu") || e.endsWith("@email.com")) {
          await admin.auth.admin.deleteUser(u.id);
        }
      }
      if (users.length < perPage) break;
      page++;
    }
  }

  try {
    const body = await req.json().catch(() => ({}));
    const doWipe = !!body?.wipe;
    if (doWipe) await wipe();

    const staff = [
      { role: "admin", email: "admin@educare.edu", name: "Super Admin", phone: "09170000001" },
      { role: "guard", email: "guard1@educare.edu", name: "Guard Ricardo", phone: "09180000001" },
      { role: "guard", email: "guard2@educare.edu", name: "Guard Antonio", phone: "09180000002" },
      { role: "clinic", email: "nurse1@educare.edu", name: "Nurse Teresita", phone: "09190000001" },
      { role: "clinic", email: "nurse2@educare.edu", name: "Nurse Maria", phone: "09190000002" },
    ];
    const guardIds: string[] = [];
    let adminId: string | null = null;
    for (const s of staff) {
      const uid = await ensureAuthAndProfile(s.email, s.role, s.name, s.email.split("@")[0], s.phone);
      if (s.role === "admin") {
        await admin.from("admin_staff").upsert({ id: uid, position: "School Principal" });
        adminId = uid;
      }
      if (s.role === "clinic") await admin.from("clinic_staff").upsert({ id: uid, license_no: "RN-2026-001" });
      if (s.role === "guard") {
        await admin.from("guards").upsert({ id: uid, shift: "Day", assigned_gate: "Main Gate" });
        guardIds.push(uid);
      }
    }

    const teacherIds: string[] = [];
    for (let i = 1; i <= 30; i++) {
      const email = `teacher${i}@educare.edu`;
      const phone = `092000000${i.toString().padStart(2, "0")}`;
      const full_name = `${firstNames[i % firstNames.length]} ${lastNames[(i + 5) % lastNames.length]}`;
      const uid = await ensureAuthAndProfile(email, "teacher", full_name, `teacher${i}`, phone);
      await admin.from("teachers").upsert({
        id: uid,
        employee_no: `EMP-${2026000 + i}`,
        is_homeroom: i <= 13,
        is_gatekeeper: i > 27,
      });
      teacherIds.push(uid);
    }

    const subjectCodes: string[] = [];
    for (const g of grades) {
      for (const s of subjects) {
        const code = `${s}-${g}`;
        const { error } = await admin.from("subjects").upsert({
          code,
          name: `${s} for Grade ${g}`,
          grade: g,
          type: "core",
        });
        if (!error) subjectsCreated++;
        subjectCodes.push(code);
      }
    }

    const classIds: string[] = [];
    for (let i = 0; i < grades.length; i++) {
      const g = grades[i];
      const strand = g === "11" || g === "12" ? strands[i % strands.length] : null;
      const id = g + (strand ? `-${strand}` : "");
      const level = parseInt(g) >= 7 ? "High School" : g === "Kinder" ? "Kinder" : "Elementary";
      const { error: classErr } = await admin.from("classes").upsert({
        id,
        grade: g,
        strand,
        adviser_id: i < 13 ? teacherIds[i] : null,
        level,
        is_active: true,
      });
      if (!classErr) classesCreated++;
      classIds.push(id);
      for (let j = 0; j < 3; j++) {
        const { error: schedErr } = await admin.from("class_schedules").insert({
          class_id: id,
          subject_code: subjectCodes[Math.floor(Math.random() * subjectCodes.length)],
          teacher_id: teacherIds[Math.floor(Math.random() * teacherIds.length)],
          day_of_week: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"][j],
          start_time: `${8 + j}:00:00`,
          end_time: `${9 + j}:00:00`,
        });
        if (!schedErr) schedulesCreated++;
      }
    }

    const students: { id: string; class_id: string; grade_level: string }[] = [];
    let studentCounter = 0;
    for (let i = 0; i < classIds.length; i++) {
      const clsId = classIds[i];
      const gradeLevel = grades[i];
      for (let j = 1; j <= 5; j++) {
        studentCounter++;
        const parentIdx = Math.ceil(studentCounter / 2.5);
        const pEmail = `parent${parentIdx}@email.com`;
        const pPhone = `093000000${parentIdx.toString().padStart(2, "0")}`;
        const pName = `Parent ${lastNames[parentIdx % lastNames.length]}`;
        const pId = await ensureAuthAndProfile(pEmail, "parent", pName, `parent${parentIdx}`, pPhone);
        const { error: pErr } = await admin.from("parents").upsert({ id: pId, address: "Purok 4 Irisan Baguio City" });
        if (!pErr) parentsCreated++;

        const lrn = `100000${studentCounter.toString().padStart(3, "0")}`;
        const stuId = studentId(lrn);
        const { data: stu, error: stuErr } = await admin
          .from("students")
          .insert({
            id: stuId,
            lrn,
            full_name: `${firstNames[studentCounter % firstNames.length]} ${lastNames[(studentCounter + 10) % lastNames.length]}`,
            grade_level: gradeLevel,
            class_id: clsId,
            current_status: "out",
            address: "Purok 4 Irisan Baguio City",
          })
          .select()
          .single();
        if (!stuErr && stu) {
          students.push({ id: stu.id as string, class_id: clsId, grade_level: gradeLevel });
          await admin.from("parent_students").insert({ parent_id: pId, student_id: stuId, relationship: "Parent" });
          await admin.from("qr_codes").insert({ student_id: stuId, qr_hash: stuId, is_active: true });
          studentsCreated++;
        }
      }
    }

    const startDate = new Date("2025-11-01");
    const endDate = new Date();
    let curr = new Date(startDate);
    while (curr <= endDate) {
      if (curr.getDay() !== 0 && curr.getDay() !== 6) {
        const dateStr = curr.toISOString().split("T")[0];
        const absentRows: Array<Record<string, unknown>> = [];
        let derivedDaily = 0;
        const events: Array<Record<string, unknown>> = [];
        for (const s of students) {
          const roll = Math.random();
          const status = roll < 0.85 ? "present" : roll < 0.95 ? "late" : "absent";
          if (status === "present") {
            events.push({
              student_id: s.id,
              event_type: "IN",
              timestamp: `${dateStr}T07:15:00Z`,
              device_id: "seed",
              recorded_by: guardIds[0],
            });
            events.push({
              student_id: s.id,
              event_type: "OUT",
              timestamp: `${dateStr}T16:00:00Z`,
              device_id: "seed",
              recorded_by: guardIds[0],
            });
            derivedDaily++;
          } else if (status === "late") {
            events.push({
              student_id: s.id,
              event_type: "IN",
              timestamp: `${dateStr}T08:15:00Z`,
              device_id: "seed",
              recorded_by: guardIds[0],
            });
            events.push({
              student_id: s.id,
              event_type: "OUT",
              timestamp: `${dateStr}T16:00:00Z`,
              device_id: "seed",
              recorded_by: guardIds[0],
            });
            derivedDaily++;
          } else {
            absentRows.push({
              student_id: s.id,
              date: dateStr,
              status: "absent",
              timestamp: `${dateStr}T07:15:00Z`,
              method: "none",
              entry_type: "none",
              recorded_by: guardIds[0],
              remarks: "No entry event",
              class_id: s.class_id,
              session: "AM",
            });
          }
        }
        if (events.length > 0) {
          const { error: evErr } = await admin.from("attendance_events").insert(events);
          if (!evErr) eventsCreated += events.length;
        }
        if (absentRows.length > 0) {
          const { error: absErr } = await admin.from("attendance").insert(absentRows);
          if (!absErr) attCreated += absentRows.length;
        }
        attCreated += derivedDaily;
      }
      curr.setDate(curr.getDate() + 1);
    }

    const rules = [
      { grade_level: "Kinder", in_start: "07:30:00", grace_until: "08:00:00", late_until: "08:30:00", dismissal_time: "11:30:00", min_subject_minutes: 30, late_arrival_threshold: 60 },
      { grade_level: "1", in_start: "07:30:00", grace_until: "07:45:00", late_until: "08:15:00", dismissal_time: "13:00:00", min_subject_minutes: 30, late_arrival_threshold: 60 },
      { grade_level: "2", in_start: "07:30:00", grace_until: "07:45:00", late_until: "08:15:00", dismissal_time: "13:00:00", min_subject_minutes: 30, late_arrival_threshold: 60 },
      { grade_level: "3", in_start: "07:30:00", grace_until: "07:45:00", late_until: "08:15:00", dismissal_time: "13:00:00", min_subject_minutes: 30, late_arrival_threshold: 60 },
      { grade_level: "4", in_start: "07:30:00", grace_until: "07:45:00", late_until: "08:15:00", dismissal_time: "15:00:00", min_subject_minutes: 30, late_arrival_threshold: 60 },
      { grade_level: "5", in_start: "07:30:00", grace_until: "07:45:00", late_until: "08:15:00", dismissal_time: "15:00:00", min_subject_minutes: 30, late_arrival_threshold: 60 },
      { grade_level: "6", in_start: "07:30:00", grace_until: "07:45:00", late_until: "08:15:00", dismissal_time: "15:00:00", min_subject_minutes: 30, late_arrival_threshold: 60 },
      { grade_level: "7", in_start: "07:30:00", grace_until: "07:45:00", late_until: "08:15:00", dismissal_time: "16:00:00", min_subject_minutes: 30, late_arrival_threshold: 60 },
      { grade_level: "8", in_start: "07:30:00", grace_until: "07:45:00", late_until: "08:15:00", dismissal_time: "16:00:00", min_subject_minutes: 30, late_arrival_threshold: 60 },
      { grade_level: "9", in_start: "07:30:00", grace_until: "07:45:00", late_until: "08:15:00", dismissal_time: "16:00:00", min_subject_minutes: 30, late_arrival_threshold: 60 },
      { grade_level: "10", in_start: "07:30:00", grace_until: "07:45:00", late_until: "08:15:00", dismissal_time: "16:00:00", min_subject_minutes: 30, late_arrival_threshold: 60 },
    ];
    for (const r of rules) await admin.from("attendance_rules").upsert(r);
    if (adminId) {
      await admin.from("announcements").insert([
        { title: "Welcome to SY 2025-2026", content: "Classes start today!", audience: ["parent", "teacher"], posted_by: adminId },
      ]);
    }

    return json({
      ok: true,
      usersCreated,
      parentsCreated,
      studentsCreated,
      subjectsCreated,
      classesCreated,
      schedulesCreated,
      eventsCreated,
      attCreated,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return json({ error: msg }, 500);
  }
});
