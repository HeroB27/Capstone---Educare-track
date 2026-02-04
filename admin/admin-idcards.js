import { supabase } from "../core/core.js";
import { initAppShell } from "../core/shell.js";
import { initAdminPage } from "./admin-common.js";

initAppShell({ role: "admin", active: "people" });

const idStatus = document.getElementById("idStatus");
const idApp = document.getElementById("idApp");

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

function textInput({ value = "", placeholder = "" } = {}) {
  const i = document.createElement("input");
  i.type = "text";
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

function toLocalISODate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function loadAllStudents() {
  const { data, error } = await supabase.from("students").select("id,full_name,lrn,class_id,grade_level").order("full_name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function loadStudentIds() {
  const { data, error } = await supabase
    .from("student_ids")
    .select("id,student_id,qr_code,is_active,created_at,student:students(full_name,grade_level,class_id,lrn)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

function openIssueModal({ studentsWithoutId, onSaved }) {
  const content = el("div", "");
  content.appendChild(el("div", "text-lg font-semibold text-slate-900", "Issue new ID"));

  const studentSelect = selectInput(
    [{ value: "", label: "Select student…" }].concat(studentsWithoutId.map((s) => ({ value: s.id, label: `${s.full_name} (${s.grade_level ?? "—"})` }))),
    ""
  );

  const form = el("form", "mt-4 grid gap-4 md:grid-cols-2");
  form.appendChild(el("div", "space-y-1 md:col-span-2", '<label class="block text-sm font-medium text-slate-700">Student</label>'));
  form.lastChild.appendChild(studentSelect);

  form.appendChild(
    el(
      "div",
      "rounded-xl bg-slate-50 p-3 text-sm text-slate-700 ring-1 ring-slate-200 md:col-span-2",
      "QR code is generated automatically when you issue an ID."
    )
  );

  const errorBox = el("div", "hidden rounded-xl bg-red-50 p-3 text-sm text-red-700 md:col-span-2");
  const actions = el("div", "flex justify-end gap-2 md:col-span-2");
  const cancelBtn = button("Cancel", "ghost");
  const saveBtn = button("Issue", "primary");
  saveBtn.type = "submit";
  cancelBtn.addEventListener("click", () => overlay.remove());
  actions.appendChild(cancelBtn);
  actions.appendChild(saveBtn);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorBox.classList.add("hidden");
    saveBtn.disabled = true;

    if (!studentSelect.value) {
      errorBox.textContent = "Student is required.";
      errorBox.classList.remove("hidden");
      saveBtn.disabled = false;
      return;
    }

    const { data, error } = await supabase.rpc("issue_student_id", { p_student_id: studentSelect.value, p_force: false });
    if (error) {
      errorBox.textContent = error.message;
      errorBox.classList.remove("hidden");
      saveBtn.disabled = false;
      return;
    }

    overlay.remove();
    await onSaved();
    if (data) idStatus.textContent = `Issued new ID: ${data}`;
  });

  content.appendChild(form);
  content.appendChild(errorBox);
  content.appendChild(actions);
  const overlay = openModal(content);
}

async function render() {
  idStatus.textContent = "Loading…";
  idApp.replaceChildren();

  const [students, ids] = await Promise.all([loadAllStudents(), loadStudentIds()]);
  const activeIdsByStudent = new Map(ids.filter((i) => i.is_active).map((i) => [i.student_id, i]));
  const studentsWithoutId = students.filter((s) => !activeIdsByStudent.has(s.id));

  const header = el("div", "flex flex-col gap-3 md:flex-row md:items-center md:justify-between");
  const left = el("div", "flex flex-1 gap-2");
  const search = textInput({ placeholder: "Search student or QR…" });
  left.appendChild(search);
  const right = el("div", "flex gap-2");
  const issueBtn = button("Issue ID", "primary");
  const printBtn = button("Print 2x3", "secondary");
  right.appendChild(issueBtn);
  right.appendChild(printBtn);
  header.appendChild(left);
  header.appendChild(right);

  const tableBox = el("div", "mt-4 overflow-x-auto");
  idApp.appendChild(header);
  idApp.appendChild(tableBox);

  issueBtn.addEventListener("click", () => {
    if (!studentsWithoutId.length) {
      idStatus.textContent = "All students already have IDs.";
      return;
    }
    openIssueModal({ studentsWithoutId, onSaved: render });
  });

  printBtn.addEventListener("click", () => {
    window.location.href = "./admin-idcards-print.html";
  });

  function applyFilter() {
    const q = search.value.trim().toLowerCase();
    const rows = ids.filter((i) => {
      const name = String(i.student?.full_name ?? "").toLowerCase();
      const qr = String(i.qr_code ?? "").toLowerCase();
      if (!q) return true;
      return name.includes(q) || qr.includes(q);
    });

    if (!rows.length) {
      tableBox.replaceChildren(el("div", "text-sm text-slate-600", "No ID records found."));
      return;
    }

    const table = el("table", "table");
    table.innerHTML = "<thead><tr><th>Student</th><th>Grade</th><th>QR code</th><th>Active</th><th></th></tr></thead>";
    const tbody = el("tbody", "");

    for (const r of rows) {
      const tr = document.createElement("tr");
      const studentName = r.student?.full_name ?? "—";
      const grade = r.student?.grade_level ?? "—";
      tr.innerHTML = `
        <td class="cell-strong">${escapeHtml(studentName)}</td>
        <td>${escapeHtml(grade)}</td>
        <td>${escapeHtml(r.qr_code)}</td>
        <td>${r.is_active ? "Yes" : "No"}</td>
        <td></td>
      `;
      const actions = el("div", "table-actions");
      if (r.is_active) {
        const reissue = button("Re-issue", "secondary", "violet");
        reissue.classList.add("btn-sm");
        reissue.addEventListener("click", async () => {
          if (!confirm("Re-issue ID? This will deactivate the current active ID and create a new one.")) return;
          const { data, error } = await supabase.rpc("issue_student_id", { p_student_id: r.student_id, p_force: true });
          if (error) {
            idStatus.textContent = error.message;
            return;
          }
          await render();
          if (data) idStatus.textContent = `Re-issued ID: ${data}`;
        });
        actions.appendChild(reissue);
      }
      tr.children[4].appendChild(actions);
      tbody.appendChild(tr);
    }

    table.appendChild(tbody);
    tableBox.replaceChildren(table);
  }

  search.addEventListener("input", applyFilter);
  applyFilter();

  idStatus.textContent = `Loaded ${ids.length} ID records.`;
}

async function init() {
  const { error } = await initAdminPage();
  if (error) return;
  try {
    await render();
  } catch (e) {
    idStatus.textContent = e?.message ?? "Failed to load IDs.";
  }
}

init();
