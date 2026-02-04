import { supabase } from "../core/core.js";
import { initAppShell } from "../core/shell.js";
import { initAdminPage } from "./admin-common.js";

initAppShell({ role: "admin", active: "settings" });

const settingsStatus = document.getElementById("settingsStatus");
const settingsApp = document.getElementById("settingsApp");

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

function textInput({ value = "", type = "text", placeholder = "" } = {}) {
  const i = document.createElement("input");
  i.type = type;
  i.value = value;
  i.placeholder = placeholder;
  i.className =
    "w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200";
  return i;
}

function numberInput({ value = "", placeholder = "" } = {}) {
  const i = textInput({ value, type: "number", placeholder });
  i.min = "0";
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

function checkbox(label, checked = false) {
  const wrap = el("label", "inline-flex items-center gap-2 text-sm text-slate-700");
  const c = document.createElement("input");
  c.type = "checkbox";
  c.checked = checked;
  c.className = "h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500";
  wrap.appendChild(c);
  wrap.appendChild(document.createTextNode(label));
  return { wrap, input: c };
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
  const overlay = openModal(content);
}

async function render() {
  settingsStatus.textContent = "Loading…";
  settingsApp.replaceChildren();

  const [rules, teachers, gateSetting] = await Promise.all([loadRules(), loadTeachers(), loadGatekeeperSetting()]);
  const selectedIds = new Set(Array.isArray(gateSetting?.value?.teacher_ids) ? gateSetting.value.teacher_ids : []);

  const rulesBox = el("div", "rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200");
  const rulesHeader = el("div", "flex items-center justify-between");
  rulesHeader.appendChild(el("div", "text-sm font-semibold text-slate-900", "Attendance rules"));
  const addRuleBtn = button("Add rule", "secondary");
  rulesHeader.appendChild(addRuleBtn);
  rulesBox.appendChild(rulesHeader);

  const rulesTable = el("div", "mt-3 overflow-x-auto");
  if (!rules.length) {
    rulesTable.appendChild(el("div", "text-sm text-slate-600", "No rules yet."));
  } else {
    const table = el("table", "w-full text-left text-sm");
    table.innerHTML =
      '<thead class="text-xs uppercase text-slate-500"><tr><th class="py-2 pr-4">Grade</th><th class="py-2 pr-4">Entry</th><th class="py-2 pr-4">Grace</th><th class="py-2 pr-4">Late</th><th class="py-2 pr-4">Min mins</th><th class="py-2 pr-4"></th></tr></thead>';
    const tbody = el("tbody", "divide-y divide-slate-200");
    for (const r of rules) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="py-3 pr-4 font-medium text-slate-900">${escapeHtml(r.grade_level)}</td>
        <td class="py-3 pr-4 text-slate-700">${escapeHtml(r.entry_time)}</td>
        <td class="py-3 pr-4 text-slate-700">${escapeHtml(r.grace_until)}</td>
        <td class="py-3 pr-4 text-slate-700">${escapeHtml(r.late_until)}</td>
        <td class="py-3 pr-4 text-slate-700">${escapeHtml(r.min_subject_minutes)}</td>
        <td class="py-3 pr-4 text-right">
          <button class="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">Edit</button>
        </td>
      `;
      tr.querySelector("button")?.addEventListener("click", () => openRuleModal({ mode: "edit", rule: r, onSaved: render }));
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    rulesTable.appendChild(table);
  }
  rulesBox.appendChild(rulesTable);
  addRuleBtn.addEventListener("click", () => openRuleModal({ mode: "create", rule: null, onSaved: render }));

  const gateBox = el("div", "mt-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200");
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
    const teacherIds = checkboxes.filter((c) => c.input.checked).map((c) => c.id);
    const { error } = await supabase
      .from("system_settings")
      .upsert({ key: "teacher_gatekeepers", value: { teacher_ids: teacherIds } }, { onConflict: "key" });
    if (error) {
      alert(error.message);
      saveBtn.disabled = false;
      return;
    }
    await render();
  });

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
