import { supabase } from "../core/core.js";
import { initAppShell } from "../core/shell.js";
import { initAdminPage } from "./admin-common.js";

initAppShell({ role: "admin", active: "attendance" });

const attendanceStatus = document.getElementById("attendanceStatus");
const attendanceApp = document.getElementById("attendanceApp");

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

function textInput({ value = "", type = "text" } = {}) {
  const i = document.createElement("input");
  i.type = type;
  i.value = value;
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
  } else {
    b.className =
      "rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50";
  }
  b.textContent = label;
  return b;
}

function toLocalISODate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const STATUS_OPTIONS = [
  { value: "present", label: "Present" },
  { value: "late", label: "Late" },
  { value: "partial", label: "Partial" },
  { value: "absent", label: "Absent" },
  { value: "excused_absent", label: "Excused absent" },
];

async function loadClasses() {
  const { data, error } = await supabase.from("classes").select("id,grade_level,strand,room").order("grade_level", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function loadStudentsForClass(classId) {
  const { data, error } = await supabase
    .from("students")
    .select("id,full_name,current_status")
    .eq("class_id", classId)
    .order("full_name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function loadAttendanceForDate(classId, date) {
  const { data, error } = await supabase
    .from("homeroom_attendance")
    .select("id,student_id,status,remarks,tap_in_time,tap_out_time")
    .eq("class_id", classId)
    .eq("date", date);
  if (error) throw error;
  return data ?? [];
}

async function render() {
  attendanceStatus.textContent = "Loading…";
  attendanceApp.replaceChildren();

  const classes = await loadClasses();
  if (!classes.length) {
    attendanceStatus.textContent = "No classes yet.";
    return;
  }

  const dateInput = textInput({ type: "date", value: toLocalISODate(new Date()) });
  const classSelect = selectInput(
    classes.map((c) => ({
      value: c.id,
      label: `${c.grade_level}${c.strand ? ` • ${c.strand}` : ""}${c.room ? ` • ${c.room}` : ""}`,
    })),
    classes[0].id
  );
  const loadBtn = button("Load", "secondary");

  const controls = el("div", "grid gap-3 md:grid-cols-3");
  controls.appendChild(el("div", "space-y-1", '<label class="block text-sm font-medium text-slate-700">Date</label>'));
  controls.lastChild.appendChild(dateInput);
  controls.appendChild(el("div", "space-y-1", '<label class="block text-sm font-medium text-slate-700">Class</label>'));
  controls.lastChild.appendChild(classSelect);
  const actionWrap = el("div", "flex items-end");
  actionWrap.appendChild(loadBtn);
  controls.appendChild(actionWrap);

  const tableBox = el("div", "mt-4 overflow-x-auto");
  attendanceApp.appendChild(controls);
  attendanceApp.appendChild(tableBox);

  async function loadTable() {
    const classId = classSelect.value;
    const date = dateInput.value;

    attendanceStatus.textContent = "Loading records…";

    const [students, attendanceRows] = await Promise.all([loadStudentsForClass(classId), loadAttendanceForDate(classId, date)]);
    const attendanceByStudent = new Map(attendanceRows.map((r) => [r.student_id, r]));

    if (!students.length) {
      tableBox.replaceChildren(el("div", "text-sm text-slate-600", "No students assigned to this class yet."));
      attendanceStatus.textContent = "Loaded.";
      return;
    }

    const table = el("table", "w-full text-left text-sm");
    table.innerHTML =
      '<thead class="text-xs uppercase text-slate-500"><tr><th class="py-2 pr-4">Student</th><th class="py-2 pr-4">Tap</th><th class="py-2 pr-4">Status</th><th class="py-2 pr-4">Remarks</th><th class="py-2 pr-4"></th></tr></thead>';

    const tbody = el("tbody", "divide-y divide-slate-200");
    for (const s of students) {
      const row = attendanceByStudent.get(s.id);
      const statusSelect = selectInput(STATUS_OPTIONS, row?.status ?? "absent");
      const remarks = textInput({ value: row?.remarks ?? "" });
      const saveBtn = button("Save", "primary");
      saveBtn.className = "rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="py-3 pr-4 font-medium text-slate-900">${escapeHtml(s.full_name)}</td>
        <td class="py-3 pr-4 text-slate-700">${escapeHtml(s.current_status ?? "—")}</td>
        <td class="py-3 pr-4"></td>
        <td class="py-3 pr-4"></td>
        <td class="py-3 pr-4 text-right"></td>
      `;
      tr.children[2].appendChild(statusSelect);
      tr.children[3].appendChild(remarks);
      tr.children[4].appendChild(saveBtn);

      saveBtn.addEventListener("click", async () => {
        saveBtn.disabled = true;
        const payload = {
          student_id: s.id,
          class_id: classId,
          date,
          status: statusSelect.value,
          remarks: remarks.value.trim() || null,
        };

        const res = row?.id
          ? await supabase.from("homeroom_attendance").update(payload).eq("id", row.id)
          : await supabase.from("homeroom_attendance").insert(payload);

        if (res.error) {
          alert(res.error.message);
          saveBtn.disabled = false;
          return;
        }

        await loadTable();
      });

      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    tableBox.replaceChildren(table);
    attendanceStatus.textContent = `Loaded ${students.length} students.`;
  }

  loadBtn.addEventListener("click", loadTable);
  await loadTable();
}

async function init() {
  const { error } = await initAdminPage();
  if (error) return;
  try {
    await render();
  } catch (e) {
    attendanceStatus.textContent = e?.message ?? "Failed to load attendance.";
  }
}

init();
