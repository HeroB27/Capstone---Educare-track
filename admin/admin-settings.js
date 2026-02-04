import { supabase } from "../core/core.js";
import { button, checkbox, el, escapeHtml, openModal, selectInput, textArea, textInput } from "../core/ui.js";
import { initAppShell } from "../core/shell.js";
import { initAdminPage } from "./admin-common.js";

initAppShell({ role: "admin", active: "settings" });

const settingsStatus = document.getElementById("settingsStatus");
const settingsApp = document.getElementById("settingsApp");

function numberInput({ value = "", placeholder = "" } = {}) {
  const i = textInput({ value, type: "number", placeholder });
  i.min = "-60"; // Allow negative for debugging/testing
  return i;
}

async function loadRules() {
  const { data, error } = await supabase
    .from("attendance_rules")
    .select("id,grade_level,entry_time,grace_until,late_until,min_subject_minutes,created_at")
    .order("grade_level", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function loadTeachers() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,full_name,username,role,is_active")
    .eq("role", "teacher")
    .order("full_name", { ascending: true });
  if (error) throw error;
  return (data ?? []).filter((t) => t.is_active);
}

async function loadGatekeeperSetting() {
  const { data, error } = await supabase.from("system_settings").select("id,key,value").eq("key", "teacher_gatekeepers").maybeSingle();
  if (error) throw error;
  return data ?? null;
}

async function loadAttendanceSettings() {
  const { data, error } = await supabase
    .from("system_settings")
    .select("id,key,value")
    .in("key", ["school_start_time", "late_threshold_minutes"]);
  if (error) throw error;
  const map = new Map((data ?? []).map((r) => [r.key, r]));
  return {
    schoolStart: map.get("school_start_time") ?? null,
    lateThreshold: map.get("late_threshold_minutes") ?? null,
  };
}

function extractSettingValue(row) {
  const v = row?.value;
  if (v && typeof v === "object" && "value" in v) return v.value;
  return v ?? null;
}

function openRuleModal({ mode, rule, onSaved }) {
  const content = el("div", "");
  content.appendChild(el("div", "text-lg font-semibold text-slate-900", mode === "create" ? "Add attendance rule" : "Edit attendance rule"));

  const form = el("form", "mt-4 grid gap-4 md:grid-cols-2");
  const gradeLevel = textInput({ value: rule?.grade_level ?? "", placeholder: "e.g., Kinder, 1, JHS, SHS" });
  const entry = textInput({ type: "time", value: rule?.entry_time ?? "" });
  const grace = textInput({ type: "time", value: rule?.grace_until ?? "" });
  const late = textInput({ type: "time", value: rule?.late_until ?? "" });
  const minMinutes = numberInput({ value: String(rule?.min_subject_minutes ?? 30), placeholder: "30" });

  form.appendChild(el("div", "space-y-1", '<label class="block text-sm font-medium text-slate-700">Grade level</label>'));
  form.lastChild.appendChild(gradeLevel);
  form.appendChild(el("div", "space-y-1", '<label class="block text-sm font-medium text-slate-700">Entry time</label>'));
  form.lastChild.appendChild(entry);
  form.appendChild(el("div", "space-y-1", '<label class="block text-sm font-medium text-slate-700">Grace until</label>'));
  form.lastChild.appendChild(grace);
  form.appendChild(el("div", "space-y-1", '<label class="block text-sm font-medium text-slate-700">Late until</label>'));
  form.lastChild.appendChild(late);
  form.appendChild(el("div", "space-y-1", '<label class="block text-sm font-medium text-slate-700">Min subject minutes</label>'));
  form.lastChild.appendChild(minMinutes);

  const errorBox = el("div", "mt-3 hidden rounded-xl bg-red-50 p-3 text-sm text-red-700 md:col-span-2");
  const actions = el("div", "mt-5 flex justify-end gap-2 md:col-span-2");
  const cancelBtn = button("Cancel", "ghost");
  const saveBtn = button("Save", "primary");
  saveBtn.type = "submit";

  // Create overlay first to avoid variable shadowing issues
  const overlay = openModal(content);

  cancelBtn.addEventListener("click", () => overlay.remove());
  actions.appendChild(cancelBtn);
  actions.appendChild(saveBtn);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorBox.classList.add("hidden");
    saveBtn.disabled = true;

    const payload = {
      grade_level: gradeLevel.value.trim(),
      entry_time: entry.value,
      grace_until: grace.value,
      late_until: late.value,
      min_subject_minutes: Number(minMinutes.value || 30),
    };

    if (!payload.grade_level || !payload.entry_time || !payload.grace_until || !payload.late_until) {
      errorBox.textContent = "Grade level and all times are required.";
      errorBox.classList.remove("hidden");
      saveBtn.disabled = false;
      return;
    }

    const res = mode === "create" ? await supabase.from("attendance_rules").insert(payload) : await supabase.from("attendance_rules").update(payload).eq("id", rule.id);
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
}

async function render() {
  settingsStatus.textContent = "Loading…";
  settingsApp.replaceChildren();

  const [rules, teachers, gateSetting, attendanceSettings] = await Promise.all([
    loadRules(),
    loadTeachers(),
    loadGatekeeperSetting(),
    loadAttendanceSettings(),
  ]);
  const selectedIds = new Set(Array.isArray(gateSetting?.value?.teacher_ids) ? gateSetting.value.teacher_ids : []);

  const attBox = el("div", "surface");
  attBox.appendChild(el("div", "text-sm font-semibold text-slate-900", "School attendance settings"));
  attBox.appendChild(el("div", "mt-1 text-sm text-slate-600", "Used for late detection: Late if tap-in is after start time plus the threshold."));

  const startTime = textInput({
    type: "time",
    value: String(extractSettingValue(attendanceSettings.schoolStart) ?? "07:30"),
  });
  const threshold = numberInput({
    value: String(extractSettingValue(attendanceSettings.lateThreshold) ?? 15),
    placeholder: "15",
  });

  const grid = el("div", "mt-4 grid gap-4 md:grid-cols-2");
  grid.appendChild(el("div", "space-y-1", '<label class="block text-sm font-medium text-slate-700">School start time</label>'));
  grid.lastChild.appendChild(startTime);
  grid.appendChild(el("div", "space-y-1", '<label class="block text-sm font-medium text-slate-700">Late threshold (minutes)</label>'));
  grid.lastChild.appendChild(threshold);
  attBox.appendChild(grid);

  const attActions = el("div", "mt-4 flex justify-end");
  const saveAtt = button("Save attendance settings", "primary");
  attActions.appendChild(saveAtt);
  attBox.appendChild(attActions);

  saveAtt.addEventListener("click", async () => {
    saveAtt.disabled = true;
    settingsStatus.textContent = "Saving…";
    const start = startTime.value;
    const mins = Number(threshold.value);
    if (!start || !Number.isFinite(mins) || mins < 0) {
      settingsStatus.textContent = "Start time is required and threshold must be 0 or more.";
      saveAtt.disabled = false;
      return;
    }
    const rows = [
      { key: "school_start_time", value: { value: start } },
      { key: "late_threshold_minutes", value: { value: mins } },
    ];
    const { error } = await supabase.from("system_settings").upsert(rows, { onConflict: "key" });
    if (error) {
      settingsStatus.textContent = error.message;
      saveAtt.disabled = false;
      return;
    }
    await render();
  });

  const rulesBox = el("div", "surface");
  const rulesHeader = el("div", "flex items-center justify-between");
  rulesHeader.appendChild(el("div", "text-sm font-semibold text-slate-900", "Attendance rules"));
  const addRuleBtn = button("Add rule", "secondary");
  rulesHeader.appendChild(addRuleBtn);
  rulesBox.appendChild(rulesHeader);

  const rulesTable = el("div", "mt-3 overflow-x-auto");
  if (!rules.length) {
    rulesTable.appendChild(el("div", "text-sm text-slate-600", "No rules yet."));
  } else {
    const table = el("table", "table");
    table.innerHTML = "<thead><tr><th>Grade</th><th>Entry</th><th>Grace</th><th>Late</th><th>Min mins</th><th></th></tr></thead>";
    const tbody = el("tbody", "");
    for (const r of rules) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="cell-strong">${escapeHtml(r.grade_level)}</td>
        <td>${escapeHtml(r.entry_time)}</td>
        <td>${escapeHtml(r.grace_until)}</td>
        <td>${escapeHtml(r.late_until)}</td>
        <td>${escapeHtml(r.min_subject_minutes)}</td>
        <td></td>
      `;
      const edit = button("Edit", "secondary", "violet");
      edit.classList.add("btn-sm");
      edit.addEventListener("click", () => openRuleModal({ mode: "edit", rule: r, onSaved: render }));
      const actions = el("div", "table-actions");
      actions.appendChild(edit);
      tr.children[5].appendChild(actions);
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    rulesTable.appendChild(table);
  }
  rulesBox.appendChild(rulesTable);
  addRuleBtn.addEventListener("click", () => openRuleModal({ mode: "create", rule: null, onSaved: render }));

  const gateBox = el("div", "mt-4 surface");
  gateBox.appendChild(el("div", "text-sm font-semibold text-slate-900", "Teacher gatekeepers"));
  gateBox.appendChild(el("div", "mt-1 text-sm text-slate-600", "Select teachers who can scan as gatekeepers (saved in system_settings)."));

  const list = el("div", "mt-4 grid gap-2 md:grid-cols-2");
  const checkboxes = [];
  for (const t of teachers) {
    const item = checkbox(`${t.full_name} (${t.username})`, selectedIds.has(t.id));
    checkboxes.push({ id: t.id, input: item.input });
    list.appendChild(item.wrap);
  }
  if (!teachers.length) {
    list.appendChild(el("div", "text-sm text-slate-600", "No teachers found."));
  }
  gateBox.appendChild(list);

  const saveRow = el("div", "mt-4 flex justify-end");
  const saveBtn = button("Save gatekeepers", "primary");
  saveRow.appendChild(saveBtn);
  gateBox.appendChild(saveRow);

  saveBtn.addEventListener("click", async () => {
    saveBtn.disabled = true;
    settingsStatus.textContent = "Saving…";
    const teacherIds = checkboxes.filter((c) => c.input.checked).map((c) => c.id);
    const { error } = await supabase
      .from("system_settings")
      .upsert({ key: "teacher_gatekeepers", value: { teacher_ids: teacherIds } }, { onConflict: "key" });
    if (error) {
      settingsStatus.textContent = error.message;
      saveBtn.disabled = false;
      return;
    }
    await render();
  });

  settingsApp.appendChild(attBox);
  settingsApp.appendChild(rulesBox);
  settingsApp.appendChild(gateBox);
  settingsStatus.textContent = "Loaded settings.";
}

async function init() {
  const { error } = await initAdminPage();
  if (error) return;
  try {
    await render();
  } catch (e) {
    settingsStatus.textContent = e?.message ?? "Failed to load settings.";
  }
}

init();
