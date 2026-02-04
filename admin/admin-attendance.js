import { supabase } from "../core/core.js";
import { button, el, escapeHtml, selectInput, textInput } from "../core/ui.js";
import { initAppShell } from "../core/shell.js";
import { getNoClassesEvent } from "../core/school-calendar.js";
import { initAdminPage } from "./admin-common.js";

initAppShell({ role: "admin", active: "attendance" });

const attendanceStatus = document.getElementById("attendanceStatus");
const attendanceApp = document.getElementById("attendanceApp");

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

  const today = new Date().toISOString().split('T')[0];
  const dateInput = textInput({ type: "date", value: toLocalISODate(new Date()), max: today });
  const classSelect = selectInput(
    classes.map((c) => ({
      value: c.id,
      label: `${c.grade_level}${c.strand ? ` • ${c.strand}` : ""}${c.room ? ` • ${c.room}` : ""}`,
    })),
    classes[0].id
  );
  const loadBtn = button("Load", "secondary");
  const backfillBtn = button("Backfill absences", "secondary");

  const controls = el("div", "grid gap-3 md:grid-cols-3");
  controls.appendChild(el("div", "space-y-1", '<label class="block text-sm font-medium text-slate-700">Date</label>'));
  controls.lastChild.appendChild(dateInput);
  controls.appendChild(el("div", "space-y-1", '<label class="block text-sm font-medium text-slate-700">Class</label>'));
  controls.lastChild.appendChild(classSelect);
  const actionWrap = el("div", "flex items-end");
  actionWrap.appendChild(loadBtn);
  actionWrap.appendChild(backfillBtn);
  controls.appendChild(actionWrap);

  const tableBox = el("div", "mt-4 overflow-x-auto");
  attendanceApp.appendChild(controls);
  attendanceApp.appendChild(tableBox);

  async function loadTable() {
    const classId = classSelect.value;
    const date = dateInput.value;

    attendanceStatus.textContent = "Loading records…";

    const selectedClass = classes.find((c) => c.id === classId) ?? null;
    const noClasses = await getNoClassesEvent({ dateStr: date, gradeLevel: selectedClass?.grade_level ?? null });
    if (noClasses) {
      tableBox.replaceChildren(
        el("div", "rounded-xl bg-slate-50 p-3 text-sm text-slate-700 ring-1 ring-slate-200", `No classes today: ${escapeHtml(noClasses.title || noClasses.type)}`)
      );
      attendanceStatus.textContent = "No classes today.";
      return;
    }

    const [students, attendanceRows] = await Promise.all([loadStudentsForClass(classId), loadAttendanceForDate(classId, date)]);
    const attendanceByStudent = new Map(attendanceRows.map((r) => [r.student_id, r]));

    if (!students.length) {
      tableBox.replaceChildren(el("div", "text-sm text-slate-600", "No students assigned to this class yet."));
      attendanceStatus.textContent = "Loaded.";
      return;
    }

    const table = el("table", "table");
    table.innerHTML = "<thead><tr><th>Student</th><th>Tap</th><th>Status</th><th>Remarks</th><th></th></tr></thead>";

    const tbody = el("tbody", "");
    for (const s of students) {
      const row = attendanceByStudent.get(s.id);
      const statusSelect = selectInput(STATUS_OPTIONS, row?.status ?? "absent");
      const remarks = textInput({ value: row?.remarks ?? "" });
      const saveBtn = button("Save", "primary");
      saveBtn.classList.add("btn-sm");

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="cell-strong">${escapeHtml(s.full_name)}</td>
        <td>${escapeHtml(s.current_status ?? "—")}</td>
        <td></td>
        <td></td>
        <td></td>
      `;
      tr.children[2].appendChild(statusSelect);
      tr.children[3].appendChild(remarks);
      const actions = el("div", "table-actions");
      actions.appendChild(saveBtn);
      tr.children[4].appendChild(actions);

      saveBtn.addEventListener("click", async () => {
        saveBtn.disabled = true;
        attendanceStatus.textContent = "Saving…";
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
          attendanceStatus.textContent = res.error.message;
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
  backfillBtn.addEventListener("click", async () => {
    backfillBtn.disabled = true;
    attendanceStatus.textContent = "Backfilling…";
    const classId = classSelect.value;
    const date = dateInput.value;
    const { data, error } = await supabase.rpc("backfill_homeroom_attendance", { _class_id: classId, _date: date });
    if (error) {
      attendanceStatus.textContent = error.message;
      backfillBtn.disabled = false;
      return;
    }
    attendanceStatus.textContent = `Backfilled ${Number(data ?? 0)} absent record(s).`;
    await loadTable();
    backfillBtn.disabled = false;
  });
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
