import { supabase } from "../core/core.js";
import { initAppShell } from "../core/shell.js";
import { initAdminPage } from "./admin-common.js";

initAppShell({ role: "admin", active: "academics" });

const classesStatus = document.getElementById("classesStatus");
const classesApp = document.getElementById("classesApp");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function el(tag, className, html) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
}

function textInput({ value = "", placeholder = "", type = "text" } = {}) {
  const i = document.createElement("input");
  i.type = type;
  i.value = value;
  i.placeholder = placeholder;
  i.className =
    "w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200";
  return i;
}

function selectInput(options, value) {
  const s = document.createElement("select");
  s.className =
    "w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200";
  for (const o of options) {
    const opt = document.createElement("option");
    opt.value = o.value;
    opt.textContent = o.label;
    if (o.value === value) opt.selected = true;
    s.appendChild(opt);
  }
  return s;
}

function button(label, variant = "primary") {
  const b = document.createElement("button");
  b.type = "button";
  if (variant === "primary") {
    b.className = "rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700";
  } else if (variant === "ghost") {
    b.className = "rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50";
  } else {
    b.className =
      "rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50";
  }
  b.textContent = label;
  return b;
}

function openModal(contentEl) {
  const overlay = el("div", "fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4");
  const card = el("div", "w-full max-w-2xl rounded-2xl bg-white p-5 shadow-lg");
  card.appendChild(contentEl);
  overlay.appendChild(card);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
  return overlay;
}

function inputRow(label, inputEl) {
  const wrap = el("div", "space-y-1");
  wrap.appendChild(el("label", "block text-sm font-medium text-slate-700", escapeHtml(label)));
  wrap.appendChild(inputEl);
  return wrap;
}

function toLocalISODate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

let state = {
  classes: [],
  teachers: [],
  subjects: [],
  selectedClassId: null,
};

async function loadInitial() {
  const [classesRes, teachersRes, subjectsRes] = await Promise.all([
    supabase.from("classes").select("id,grade_level,strand,homeroom_teacher_id,room,is_active,created_at").order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id,full_name,username,role,is_active")
      .eq("role", "teacher")
      .order("full_name", { ascending: true }),
    supabase.from("subjects").select("code,name,grade_level,strand,type").order("grade_level", { ascending: true }),
  ]);

  if (classesRes.error) throw classesRes.error;
  if (teachersRes.error) throw teachersRes.error;
  if (subjectsRes.error) throw subjectsRes.error;

  state.classes = classesRes.data ?? [];
  state.teachers = (teachersRes.data ?? []).filter((t) => t.is_active);
  state.subjects = subjectsRes.data ?? [];

  if (!state.selectedClassId && state.classes.length) state.selectedClassId = state.classes[0].id;
}

async function loadClassDetails(classId) {
  const today = new Date();
  const start = toLocalISODate(new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000));
  const end = toLocalISODate(today);

  const [schedulesRes, studentsRes, attendanceRes] = await Promise.all([
    supabase
      .from("class_schedules")
      .select("id,class_id,subject_code,teacher_id,day_of_week,start_time,end_time,created_at")
      .eq("class_id", classId)
      .order("day_of_week", { ascending: true }),
    supabase.from("students").select("id,full_name,grade_level,strand,current_status").eq("class_id", classId).order("full_name", { ascending: true }),
    supabase
      .from("homeroom_attendance")
      .select("student_id,status,date")
      .eq("class_id", classId)
      .gte("date", start)
      .lte("date", end),
  ]);

  if (schedulesRes.error) throw schedulesRes.error;
  if (studentsRes.error) throw studentsRes.error;
  if (attendanceRes.error) throw attendanceRes.error;

  return {
    schedules: schedulesRes.data ?? [],
    students: studentsRes.data ?? [],
    attendance: attendanceRes.data ?? [],
    range: { start, end },
  };
}

function teacherOptions() {
  return [{ value: "", label: "Unassigned" }].concat(state.teachers.map((t) => ({ value: t.id, label: `${t.full_name} (${t.username})` })));
}

function subjectOptionsForClass(cls) {
  const grade = String(cls.grade_level ?? "").trim();
  const strand = String(cls.strand ?? "").trim();
  const filtered = state.subjects.filter((s) => {
    if (String(s.grade_level ?? "").trim() !== grade) return false;
    const subjectStrand = String(s.strand ?? "").trim();
    if (!subjectStrand) return true;
    return subjectStrand === strand;
  });
  return [{ value: "", label: "Select subject…" }].concat(filtered.map((s) => ({ value: s.code, label: `${s.code} - ${s.name}` })));
}

function openClassModal({ mode, cls, onSaved }) {
  const content = el("div", "");
  content.appendChild(el("div", "text-lg font-semibold text-slate-900", mode === "create" ? "Create class" : "Edit class"));

  const form = el("form", "mt-4 grid gap-4 md:grid-cols-2");
  const gradeLevel = textInput({ value: cls?.grade_level ?? "", placeholder: "e.g., 1, 2, JHS, SHS" });
  const strand = textInput({ value: cls?.strand ?? "", placeholder: "SHS strand (optional)" });
  const room = textInput({ value: cls?.room ?? "", placeholder: "Room (optional)" });
  const homeroomTeacherId = selectInput(teacherOptions(), cls?.homeroom_teacher_id ?? "");
  const isActive = selectInput(
    [
      { value: "true", label: "Active" },
      { value: "false", label: "Inactive" },
    ],
    String(cls?.is_active ?? true)
  );

  form.appendChild(inputRow("Grade level", gradeLevel));
  form.appendChild(inputRow("Strand", strand));
  form.appendChild(inputRow("Room", room));
  form.appendChild(inputRow("Homeroom teacher", homeroomTeacherId));
  form.appendChild(inputRow("Status", isActive));

  const errorBox = el("div", "mt-3 hidden rounded-xl bg-red-50 p-3 text-sm text-red-700 md:col-span-2");
  const actions = el("div", "mt-5 flex justify-end gap-2 md:col-span-2");
  const cancelBtn = button("Cancel", "ghost");
  const saveBtn = button("Save", "primary");
  saveBtn.type = "submit";
  cancelBtn.addEventListener("click", () => overlay.remove());
  actions.appendChild(cancelBtn);
  actions.appendChild(saveBtn);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorBox.classList.add("hidden");
    saveBtn.disabled = true;

    const payload = {
      grade_level: gradeLevel.value.trim(),
      strand: strand.value.trim() || null,
      room: room.value.trim() || null,
      homeroom_teacher_id: homeroomTeacherId.value || null,
      is_active: isActive.value === "true",
    };

    if (!payload.grade_level) {
      errorBox.textContent = "Grade level is required.";
      errorBox.classList.remove("hidden");
      saveBtn.disabled = false;
      return;
    }

    const res = mode === "create" ? await supabase.from("classes").insert(payload) : await supabase.from("classes").update(payload).eq("id", cls.id);
    if (res.error) {
      errorBox.textContent = res.error.message;
      errorBox.classList.remove("hidden");
      saveBtn.disabled = false;
      return;
    }

    overlay.remove();
    await onSaved();
  });

  content.appendChild(form);
  content.appendChild(errorBox);
  content.appendChild(actions);
  const overlay = openModal(content);
}

function openScheduleModal({ cls, onSaved }) {
  const content = el("div", "");
  content.appendChild(el("div", "text-lg font-semibold text-slate-900", "Add subject schedule"));

  const form = el("form", "mt-4 grid gap-4 md:grid-cols-2");
  const subjectCode = selectInput(subjectOptionsForClass(cls), "");
  const teacherId = selectInput(teacherOptions(), "");
  const day = selectInput(
    [
      { value: "", label: "Select day…" },
      { value: "mon", label: "Mon" },
      { value: "tue", label: "Tue" },
      { value: "wed", label: "Wed" },
      { value: "thu", label: "Thu" },
      { value: "fri", label: "Fri" },
      { value: "sat", label: "Sat" },
    ],
    ""
  );
  const start = textInput({ type: "time", value: "" });
  const end = textInput({ type: "time", value: "" });

  form.appendChild(inputRow("Subject", subjectCode));
  form.appendChild(inputRow("Teacher", teacherId));
  form.appendChild(inputRow("Day", day));
  form.appendChild(inputRow("Start time", start));
  form.appendChild(inputRow("End time", end));

  const errorBox = el("div", "mt-3 hidden rounded-xl bg-red-50 p-3 text-sm text-red-700 md:col-span-2");
  const actions = el("div", "mt-5 flex justify-end gap-2 md:col-span-2");
  const cancelBtn = button("Cancel", "ghost");
  const saveBtn = button("Add", "primary");
  saveBtn.type = "submit";
  cancelBtn.addEventListener("click", () => overlay.remove());
  actions.appendChild(cancelBtn);
  actions.appendChild(saveBtn);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorBox.classList.add("hidden");
    saveBtn.disabled = true;

    if (!subjectCode.value || !teacherId.value || !day.value || !start.value || !end.value) {
      errorBox.textContent = "All fields are required.";
      errorBox.classList.remove("hidden");
      saveBtn.disabled = false;
      return;
    }

    const { error } = await supabase.from("class_schedules").insert({
      class_id: cls.id,
      subject_code: subjectCode.value,
      teacher_id: teacherId.value,
      day_of_week: day.value,
      start_time: start.value,
      end_time: end.value,
    });

    if (error) {
      errorBox.textContent = error.message;
      errorBox.classList.remove("hidden");
      saveBtn.disabled = false;
      return;
    }

    if (!cls.homeroom_teacher_id) {
      const { error: homeroomError } = await supabase
        .from("classes")
        .update({ homeroom_teacher_id: teacherId.value })
        .eq("id", cls.id);
      if (homeroomError) {
        errorBox.textContent = homeroomError.message;
        errorBox.classList.remove("hidden");
        saveBtn.disabled = false;
        return;
      }
    }

    overlay.remove();
    await onSaved();
  });

  content.appendChild(form);
  content.appendChild(errorBox);
  content.appendChild(actions);
  const overlay = openModal(content);
}

function render() {
  classesApp.replaceChildren();

  const header = el("div", "flex items-center justify-between");
  header.appendChild(el("div", "text-sm text-slate-600", "Select a class to view students and schedules."));
  const addBtn = button("Add class", "primary");
  header.appendChild(addBtn);

  const grid = el("div", "mt-4 grid gap-4 lg:grid-cols-[320px_1fr]");
  const listBox = el("div", "surface");
  const detailBox = el("div", "surface");

  const ul = el("ul", "space-y-1");
  for (const c of state.classes) {
    const active = c.id === state.selectedClassId;
    const a = el(
      "button",
      active
        ? "w-full rounded-xl bg-violet-50 px-3 py-2 text-left text-sm font-semibold text-violet-700"
        : "w-full rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
    );
    const label = `${c.grade_level}${c.strand ? ` • ${c.strand}` : ""}${c.room ? ` • ${c.room}` : ""}`;
    a.textContent = label;
    a.addEventListener("click", async () => {
      state.selectedClassId = c.id;
      await refresh();
    });
    ul.appendChild(a);
  }
  if (!state.classes.length) {
    ul.appendChild(el("div", "text-sm text-slate-600", "No classes yet."));
  }
  listBox.appendChild(ul);

  addBtn.addEventListener("click", () => openClassModal({ mode: "create", cls: null, onSaved: refresh }));

  grid.appendChild(listBox);
  grid.appendChild(detailBox);
  classesApp.appendChild(header);
  classesApp.appendChild(grid);

  async function renderDetails() {
    detailBox.replaceChildren();
    const cls = state.classes.find((c) => c.id === state.selectedClassId);
    if (!cls) {
      detailBox.appendChild(el("div", "text-sm text-slate-600", "Select a class."));
      return;
    }

    const top = el("div", "flex items-center justify-between gap-2");
    top.appendChild(el("div", "text-sm font-semibold text-slate-900", `${cls.grade_level}${cls.strand ? ` • ${cls.strand}` : ""}`));
    const editBtn = button("Edit", "secondary");
    top.appendChild(editBtn);
    editBtn.addEventListener("click", () => openClassModal({ mode: "edit", cls, onSaved: refresh }));
    detailBox.appendChild(top);

    const loading = el("div", "mt-4 text-sm text-slate-700", "Loading details…");
    detailBox.appendChild(loading);

    const details = await loadClassDetails(cls.id);
    loading.remove();

    const schedulesHeader = el("div", "mt-4 flex items-center justify-between");
    schedulesHeader.appendChild(el("div", "text-sm font-semibold text-slate-900", "Schedules"));
    const addScheduleBtn = button("Add schedule", "secondary");
    schedulesHeader.appendChild(addScheduleBtn);
    addScheduleBtn.addEventListener("click", () => openScheduleModal({ cls, onSaved: refresh }));
    detailBox.appendChild(schedulesHeader);

    const schedulesBox = el("div", "mt-3 overflow-x-auto");
    if (!details.schedules.length) {
      schedulesBox.appendChild(el("div", "text-sm text-slate-600", "No schedules yet."));
    } else {
      const table = el("table", "w-full text-left text-sm");
      table.innerHTML =
        '<thead class="text-xs uppercase text-slate-500"><tr><th class="py-2 pr-4">Day</th><th class="py-2 pr-4">Subject</th><th class="py-2 pr-4">Teacher</th><th class="py-2 pr-4">Time</th><th class="py-2 pr-4"></th></tr></thead>';
      const tbody = el("tbody", "divide-y divide-slate-200");
      for (const s of details.schedules) {
        const subj = state.subjects.find((x) => x.code === s.subject_code);
        const teacher = state.teachers.find((t) => t.id === s.teacher_id);
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td class="py-3 pr-4 text-slate-700">${escapeHtml(s.day_of_week)}</td>
          <td class="py-3 pr-4 text-slate-700">${escapeHtml(subj ? `${subj.code} - ${subj.name}` : s.subject_code)}</td>
          <td class="py-3 pr-4 text-slate-700">${escapeHtml(teacher ? teacher.full_name : "—")}</td>
          <td class="py-3 pr-4 text-slate-700">${escapeHtml(s.start_time)}–${escapeHtml(s.end_time)}</td>
          <td class="py-3 pr-4 text-right">
            <button class="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">Delete</button>
          </td>
        `;
        tr.querySelector("button")?.addEventListener("click", async () => {
          if (!confirm("Delete this schedule?")) return;
          const { error } = await supabase.from("class_schedules").delete().eq("id", s.id);
          if (error) {
            classesStatus.textContent = error.message;
            return;
          }
          await refresh();
        });
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      schedulesBox.appendChild(table);
    }
    detailBox.appendChild(schedulesBox);

    const studentsHeader = el("div", "mt-6 flex items-center justify-between");
    studentsHeader.appendChild(el("div", "text-sm font-semibold text-slate-900", "Students"));
    studentsHeader.appendChild(el("div", "text-xs text-slate-600", `Attendance range: ${details.range.start} to ${details.range.end}`));
    detailBox.appendChild(studentsHeader);

    const attendanceStats = new Map();
    for (const row of details.attendance) {
      const prev = attendanceStats.get(row.student_id) ?? { presentish: 0, total: 0 };
      const status = String(row.status ?? "");
      const presentish = status === "present" || status === "late" || status === "partial";
      attendanceStats.set(row.student_id, { presentish: prev.presentish + (presentish ? 1 : 0), total: prev.total + 1 });
    }

    const studentsBox = el("div", "mt-3 overflow-x-auto");
    if (!details.students.length) {
      studentsBox.appendChild(el("div", "text-sm text-slate-600", "No students assigned yet."));
    } else {
      const table = el("table", "w-full text-left text-sm");
      table.innerHTML =
        '<thead class="text-xs uppercase text-slate-500"><tr><th class="py-2 pr-4">Student</th><th class="py-2 pr-4">Tap status</th><th class="py-2 pr-4">Attendance %</th></tr></thead>';
      const tbody = el("tbody", "divide-y divide-slate-200");
      for (const s of details.students) {
        const stat = attendanceStats.get(s.id) ?? { presentish: 0, total: 0 };
        const percent = stat.total ? Math.round((stat.presentish / stat.total) * 1000) / 10 : null;
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td class="py-3 pr-4 font-medium text-slate-900">${escapeHtml(s.full_name)}</td>
          <td class="py-3 pr-4 text-slate-700">${escapeHtml(s.current_status ?? "—")}</td>
          <td class="py-3 pr-4 text-slate-700">${percent === null ? "No data" : `${percent}%`}</td>
        `;
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      studentsBox.appendChild(table);
    }
    detailBox.appendChild(studentsBox);
  }

  renderDetails().catch((e) => {
    detailBox.replaceChildren(el("div", "text-sm text-red-700", escapeHtml(e?.message ?? "Failed to load class details.")));
  });
}

async function refresh() {
  classesStatus.textContent = "Loading…";
  await loadInitial();
  render();
  classesStatus.textContent = `Loaded ${state.classes.length} classes.`;
}

async function init() {
  const { error } = await initAdminPage();
  if (error) return;
  try {
    await refresh();
  } catch (e) {
    classesStatus.textContent = e?.message ?? "Failed to load classes.";
  }
}

init();
