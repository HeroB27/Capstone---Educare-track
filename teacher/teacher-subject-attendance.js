import { supabase } from "../core/core.js";
import { button, el, escapeHtml, isoDate, selectInput, textArea, textInput } from "../core/ui.js";
import { initAppShell } from "../core/shell.js";
import { getNoClassesEvent } from "../core/school-calendar.js";
import { initTeacherPage } from "./teacher-common.js";
import { registerPwa } from "../core/pwa.js";

initAppShell({ role: "teacher", active: "subject-attendance" });

const subjectStatus = document.getElementById("subjectStatus");
const subjectApp = document.getElementById("subjectApp");

function dayKeyFromDateStr(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  const map = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  return map[d.getDay()];
}

function toClassLabel(c) {
  return `${c.grade_level}${c.strand ? ` • ${c.strand}` : ""}${c.room ? ` • ${c.room}` : ""}`;
}

function scheduleLabel(s) {
  const cls = s.classes ? toClassLabel(s.classes) : "Class";
  const subj = s.subjects?.name ? `${s.subject_code} • ${s.subjects.name}` : String(s.subject_code ?? "Subject");
  const time = s.start_time && s.end_time ? `${s.start_time}–${s.end_time}` : "";
  return `${cls} • ${subj}${time ? ` • ${time}` : ""}`;
}

async function loadSchedules(profileId) {
  const { data, error } = await supabase
    .from("class_schedules")
    .select("id,class_id,subject_code,day_of_week,start_time,end_time,classes(id,grade_level,strand,room),subjects(code,name)")
    .eq("teacher_id", profileId)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function loadStudents(classId) {
  if (!classId) return [];
  const { data, error } = await supabase
    .from("students")
    .select("id,full_name,grade_level,strand,class_id,parent_id,current_status")
    .eq("class_id", classId)
    .order("full_name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function loadExistingSubjectAttendance({ studentIds, dateStr, subjectCode }) {
  if (!studentIds.length) return [];
  const { data, error } = await supabase
    .from("subject_attendance")
    .select("id,student_id,subject_code,date,status,remarks")
    .eq("date", dateStr)
    .eq("subject_code", subjectCode)
    .in("student_id", studentIds);
  if (error) throw error;
  return data ?? [];
}

async function loadActiveClinicVisits(studentIds) {
  if (!studentIds.length) return [];
  const { data, error } = await supabase
    .from("clinic_visits")
    .select("id,student_id,status")
    .in("student_id", studentIds)
    .eq("status", "in_clinic");
  if (error) throw error;
  return data ?? [];
}

async function loadApprovedExcuses(studentIds, dateStr) {
  if (!studentIds.length) return [];
  const { data, error } = await supabase
    .from("excuse_letters")
    .select("id,student_id,absent_date,status")
    .in("student_id", studentIds)
    .eq("absent_date", dateStr)
    .eq("status", "approved");
  if (error) throw error;
  return data ?? [];
}

function render({ schedulesForDay, selectedScheduleId, dateStr, students, existingByStudent, inClinicStudentIds, excusedStudentIds, noClassesEvent }) {
  subjectApp.replaceChildren();

  const top = el("div", "grid gap-3 md:grid-cols-3");
  const dateInput = textInput({ type: "date", value: dateStr });

  const schedOptions = [{ value: "", label: schedulesForDay.length ? "Select subject period…" : "No schedules for this day" }].concat(
    schedulesForDay.map((s) => ({ value: s.id, label: scheduleLabel(s) }))
  );
  const scheduleSelect = selectInput(schedOptions, selectedScheduleId ?? "");

  const actions = el("div", "flex items-end justify-end gap-2");
  const reloadBtn = button("Load", "secondary", "blue");
  const saveBtn = button("Save all", "primary", "blue");
  actions.appendChild(reloadBtn);
  actions.appendChild(saveBtn);

  const dateWrap = el("div", "space-y-1");
  dateWrap.appendChild(el("label", "block text-sm font-medium text-slate-700", "Date"));
  dateWrap.appendChild(dateInput);

  const schedWrap = el("div", "space-y-1");
  schedWrap.appendChild(el("label", "block text-sm font-medium text-slate-700", "Subject period"));
  schedWrap.appendChild(scheduleSelect);

  top.appendChild(dateWrap);
  top.appendChild(schedWrap);
  top.appendChild(actions);
  subjectApp.appendChild(top);

  const hint = el("div", "mt-3 text-sm text-slate-600");
  hint.textContent = "Default is Present. Change a student to Late/Absent/Excused as needed.";
  subjectApp.appendChild(hint);

  if (noClassesEvent) {
    const banner = el("div", "mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700 ring-1 ring-slate-200");
    banner.textContent = `No classes today: ${noClassesEvent.title || noClassesEvent.type}`;
    subjectApp.appendChild(banner);
  }

  const tableBox = el("div", "mt-4 overflow-x-auto");
  subjectApp.appendChild(tableBox);

  if (noClassesEvent) {
    subjectStatus.textContent = "No classes today.";
    saveBtn.disabled = true;
    tableBox.replaceChildren(el("div", "text-sm text-slate-600", "Attendance is disabled for this date."));
    return;
  }

  if (!scheduleSelect.value) {
    subjectStatus.textContent = schedulesForDay.length ? "Select a subject period." : "No schedules for this day.";
    saveBtn.disabled = true;
    return;
  }

  if (!students.length) {
    subjectStatus.textContent = "No students found for this class.";
    saveBtn.disabled = true;
    tableBox.replaceChildren(el("div", "text-sm text-slate-600", "No students found."));
    return;
  }

  subjectStatus.textContent = `Loaded ${students.length} students.`;
  const table = el("table", "table");
  table.innerHTML = "<thead><tr><th>Student</th><th>Status</th><th>Remarks</th></tr></thead>";
  const tbody = el("tbody", "");

  const editors = [];
  for (const s of students) {
    const inClinic = inClinicStudentIds.has(s.id);
    const hasExcuse = excusedStudentIds.has(s.id);
    const existing = existingByStudent.get(s.id) ?? null;
    const statusSel = selectInput(
      [
        { value: "present", label: "Present" },
        { value: "late", label: "Late" },
        { value: "absent", label: "Absent" },
        { value: "excused_absent", label: "Excused" },
      ],
      existing?.status ?? "present"
    );
    const remarks = textArea({ value: existing?.remarks ?? "", placeholder: "Optional", rows: 2 });

    const tr = document.createElement("tr");
    tr.innerHTML = `<td class="cell-strong">${escapeHtml(s.full_name)}</td><td></td><td></td>`;
    if (inClinic) {
      const pill = el("span", "status-indicator status-clinic", "In Clinic");
      pill.title = "Attendance is locked while the student is in clinic.";
      tr.children[1].appendChild(pill);
      tr.children[2].appendChild(el("div", "text-sm text-slate-600", "Locked while in clinic."));
    } else if (hasExcuse) {
      const original = existing?.status ?? "present";
      const pill = el("span", "status-indicator status-excused", "Excused");
      pill.title = `Excuse letter approved. Original: ${original}`;
      tr.children[1].appendChild(pill);
      tr.children[2].appendChild(el("div", "text-sm text-slate-600", `Locked (original: ${escapeHtml(original)})`));
    } else {
      statusSel.title = "Present: attended • Late: arrived late • Absent: missing • Excused: excuse letter approved";
      tr.children[1].appendChild(statusSel);
      tr.children[2].appendChild(remarks);
      editors.push({ student: s, statusSel, remarks });
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  tableBox.replaceChildren(table);

  reloadBtn.addEventListener("click", () => {
    const u = new URL(window.location.href);
    u.searchParams.set("date", dateInput.value);
    u.searchParams.delete("schedule"); // Reset schedule on date change
    window.location.href = u.toString();
  });

  saveBtn.addEventListener("click", async () => {
    saveBtn.disabled = true;
    reloadBtn.disabled = true;
    subjectStatus.textContent = "Saving…";

    const schedule = schedulesForDay.find((x) => x.id === scheduleSelect.value);
    if (!schedule) {
      subjectStatus.textContent = "Invalid schedule selection.";
      saveBtn.disabled = false;
      reloadBtn.disabled = false;
      return;
    }

    const editablePayload = editors.map((e) => ({
      student_id: e.student.id,
      subject_code: schedule.subject_code,
      date: dateInput.value,
      status: e.statusSel.value,
      remarks: e.remarks.value.trim() || null,
    }));

    const excusedPayload = students
      .filter((s) => excusedStudentIds.has(s.id) && !inClinicStudentIds.has(s.id))
      .map((s) => {
        const existing = existingByStudent.get(s.id) ?? null;
        const existingRemarks = String(existing?.remarks ?? "").trim();
        return {
          student_id: s.id,
          subject_code: schedule.subject_code,
          date: dateInput.value,
          status: "excused_absent",
          remarks: existingRemarks || "Excuse letter approved",
        };
      });

    const payload = editablePayload.concat(excusedPayload);

    const { error } = await supabase.from("subject_attendance").upsert(payload, { onConflict: "student_id,subject_code,date" });
    if (error) {
      subjectStatus.textContent = error.message;
      saveBtn.disabled = false;
      reloadBtn.disabled = false;
      return;
    }

    subjectStatus.textContent = "Saved.";
    reloadBtn.disabled = false;
    saveBtn.disabled = false;
  });
}

async function init() {
  const { error, profile } = await initTeacherPage();
  if (error) return;

  subjectStatus.textContent = "Loading…";
  subjectApp.replaceChildren();

  const url = new URL(window.location.href);
  const dateStr = url.searchParams.get("date") || isoDate();
  const selectedScheduleId = url.searchParams.get("schedule") || "";

  try {
    const schedules = await loadSchedules(profile.id);
    const dayKey = dayKeyFromDateStr(dateStr);
    const schedulesForDay = schedules.filter((s) => String(s.day_of_week ?? "").toLowerCase() === dayKey);
    const chosen = schedulesForDay.find((s) => s.id === selectedScheduleId) ?? schedulesForDay[0] ?? null;
    const scheduleId = chosen?.id ?? "";

    const noClassesEvent = chosen ? await getNoClassesEvent({ dateStr, gradeLevel: chosen?.classes?.grade_level ?? null }) : null;

    const students = chosen ? await loadStudents(chosen.class_id) : [];
    const inClinic = chosen ? await loadActiveClinicVisits(students.map((s) => s.id)) : [];
    const inClinicStudentIds = new Set(inClinic.map((r) => r.student_id));
    const excuses = chosen ? await loadApprovedExcuses(students.map((s) => s.id), dateStr) : [];
    const excusedStudentIds = new Set(excuses.map((r) => r.student_id));
    const existing = chosen
      ? await loadExistingSubjectAttendance({
          studentIds: students.map((s) => s.id),
          dateStr,
          subjectCode: chosen.subject_code,
        })
      : [];
    const existingByStudent = new Map(existing.map((r) => [r.student_id, r]));

    render({
      schedulesForDay,
      selectedScheduleId: scheduleId,
      dateStr,
      students,
      existingByStudent,
      inClinicStudentIds,
      excusedStudentIds,
      noClassesEvent,
    });
  } catch (e) {
    subjectStatus.textContent = e?.message ?? "Failed to load subject attendance.";
  }
}

init();
registerPwa();
