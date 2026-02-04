import { supabase } from "../core/core.js";
import { initAppShell } from "../core/shell.js";
import { initAdminPage } from "./admin-common.js";

initAppShell({ role: "admin", active: "people" });

const usersStatus = document.getElementById("usersStatus");
const usersApp = document.getElementById("usersApp");

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

function pill(text, color) {
  const span = el(
    "span",
    `inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${color}`,
    escapeHtml(text)
  );
  return span;
}

function rolePill(role) {
  const r = String(role ?? "").toLowerCase();
  if (r === "admin") return pill("Admin", "bg-violet-100 text-violet-700");
  if (r === "teacher") return pill("Teacher", "bg-blue-100 text-blue-700");
  if (r === "parent") return pill("Parent", "bg-green-100 text-green-700");
  if (r === "guard") return pill("Guard", "bg-yellow-100 text-yellow-800");
  if (r === "clinic") return pill("Clinic", "bg-red-100 text-red-700");
  return pill(r || "—", "bg-slate-100 text-slate-700");
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

async function loadProfiles() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,full_name,username,phone,address,email,role,is_active,created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

async function loadResetRequests() {
  const { data, error } = await supabase
    .from("password_reset_requests")
    .select("id,requested_user_id,note,status,created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

async function loadTeacherAssignmentIds() {
  const [classesRes, schedRes] = await Promise.all([
    supabase.from("classes").select("homeroom_teacher_id"),
    supabase.from("class_schedules").select("teacher_id"),
  ]);

  const ids = new Set();
  if (!classesRes.error) {
    for (const row of classesRes.data ?? []) {
      if (row.homeroom_teacher_id) ids.add(row.homeroom_teacher_id);
    }
  }
  if (!schedRes.error) {
    for (const row of schedRes.data ?? []) {
      if (row.teacher_id) ids.add(row.teacher_id);
    }
  }
  return ids;
}

async function loadParentIdsWithStudents() {
  const { data, error } = await supabase.from("students").select("parent_id");
  if (error) return new Set();
  const ids = new Set();
  for (const row of data ?? []) {
    if (row.parent_id) ids.add(row.parent_id);
  }
  return ids;
}

function toLocalISODate(value) {
  if (!value) return "";
  const d = new Date(value);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function renderResetRequests(requests, onRefresh) {
  const box = el("div", "mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200");
  box.appendChild(el("div", "text-sm font-semibold text-slate-900", "Password reset requests"));
  box.appendChild(
    el(
      "div",
      "mt-1 text-sm text-slate-600",
      "Users can submit a request from the login page. Mark it done after handling."
    )
  );

  if (!requests.length) {
    box.appendChild(el("div", "mt-4 text-sm text-slate-600", "No requests yet."));
    return box;
  }

  const ul = el("ul", "mt-4 space-y-2");
  for (const r of requests) {
    const li = el("li", "rounded-xl bg-slate-50 px-3 py-2");
    const meta = `${toLocalISODate(r.created_at)} • ${r.status ?? "pending"}`;
    li.innerHTML = `<div class="flex items-start justify-between gap-3"><div><div class="text-sm font-semibold text-slate-900">${escapeHtml(r.requested_user_id)}</div><div class="text-xs text-slate-600">${escapeHtml(meta)}</div></div></div>`;
    if (r.note) li.appendChild(el("div", "mt-2 text-sm text-slate-700", escapeHtml(r.note)));
    if (String(r.status ?? "pending") !== "done") {
      const row = el("div", "mt-2 flex justify-end");
      const doneBtn = button("Mark done", "secondary");
      doneBtn.className =
        "rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white";
      doneBtn.addEventListener("click", async () => {
        doneBtn.disabled = true;
        const { error } = await supabase.from("password_reset_requests").update({ status: "done" }).eq("id", r.id);
        if (error) {
          alert(error.message);
          doneBtn.disabled = false;
          return;
        }
        await onRefresh();
      });
      row.appendChild(doneBtn);
      li.appendChild(row);
    }
    ul.appendChild(li);
  }
  box.appendChild(ul);
  return box;
}

function openEditProfileModal(profile, onSaved) {
  const content = el("div", "");
  content.appendChild(el("div", "text-lg font-semibold text-slate-900", "Edit user"));
  content.appendChild(el("div", "mt-1 text-sm text-slate-600", `Auth-linked profile • id: ${escapeHtml(profile.id)}`));

  const form = el("form", "mt-4 grid gap-4 md:grid-cols-2");
  const fullName = textInput({ value: profile.full_name ?? "", placeholder: "Full name" });
  const username = textInput({ value: profile.username ?? "", placeholder: "User ID" });
  const phone = textInput({ value: profile.phone ?? "", placeholder: "Phone" });
  const address = textInput({ value: profile.address ?? "", placeholder: "Address" });
  const email = textInput({ value: profile.email ?? "", placeholder: "Email" });
  const role = selectInput(
    [
      { value: "admin", label: "Admin" },
      { value: "teacher", label: "Teacher" },
      { value: "parent", label: "Parent" },
      { value: "guard", label: "Guard" },
      { value: "clinic", label: "Clinic" },
    ],
    profile.role ?? "teacher"
  );
  const active = selectInput(
    [
      { value: "true", label: "Active" },
      { value: "false", label: "Inactive" },
    ],
    String(profile.is_active ?? true)
  );

  const inputRow = (label, inputEl) => {
    const wrap = el("div", "space-y-1");
    wrap.appendChild(el("label", "block text-sm font-medium text-slate-700", escapeHtml(label)));
    wrap.appendChild(inputEl);
    return wrap;
  };

  form.appendChild(inputRow("Full name", fullName));
  form.appendChild(inputRow("Role", role));
  form.appendChild(inputRow("User ID", username));
  form.appendChild(inputRow("Active", active));
  form.appendChild(inputRow("Phone", phone));
  form.appendChild(inputRow("Email", email));
  form.appendChild(el("div", "md:col-span-2"));
  form.appendChild(inputRow("Address", address));

  const errorBox = el("div", "mt-3 hidden rounded-xl bg-red-50 p-3 text-sm text-red-700");
  const actions = el("div", "mt-5 flex justify-end gap-2");
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
      full_name: fullName.value.trim(),
      username: username.value.trim(),
      phone: phone.value.trim() || null,
      address: address.value.trim() || null,
      email: email.value.trim() || null,
      role: role.value,
      is_active: active.value === "true",
    };

    if (!payload.full_name || !payload.username) {
      errorBox.textContent = "Full name and user id are required.";
      errorBox.classList.remove("hidden");
      saveBtn.disabled = false;
      return;
    }

    const { error } = await supabase.from("profiles").update(payload).eq("id", profile.id);
    if (error) {
      errorBox.textContent = error.message;
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

function randomFourDigits() {
  return String(Math.floor(Math.random() * 9000) + 1000);
}

function lastFourDigits(value) {
  const digits = String(value ?? "").replaceAll(/\D/g, "");
  return digits.slice(-4).padStart(4, "0");
}

function currentYear() {
  return new Date().getFullYear();
}

function generateStaffUserId(prefix, phone) {
  return `${prefix}-${currentYear()}-${lastFourDigits(phone)}-${randomFourDigits()}`;
}

function generateStudentUserId(lrn) {
  return `EDU-${currentYear()}-${lastFourDigits(lrn)}-${randomFourDigits()}`;
}

function downloadJson(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function openWizardModal({ title, steps, initialState }) {
  let stepIndex = 0;
  const state = structuredClone(initialState ?? {});

  const content = el("div", "");
  const header = el("div", "flex items-start justify-between gap-3");
  header.appendChild(el("div", "text-lg font-semibold text-slate-900", escapeHtml(title)));
  const closeBtn = button("Close", "ghost");
  closeBtn.className = "rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50";
  header.appendChild(closeBtn);
  content.appendChild(header);

  const stepper = el("div", "mt-4 flex flex-wrap gap-2");
  const body = el("div", "mt-4");
  const errorBox = el("div", "mt-4 hidden rounded-xl bg-red-50 p-3 text-sm text-red-700");
  const actions = el("div", "mt-5 flex items-center justify-between gap-2");
  const backBtn = button("Back", "secondary");
  backBtn.className = "rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-400";
  const nextBtn = button("Next", "primary");
  actions.appendChild(backBtn);
  actions.appendChild(nextBtn);

  content.appendChild(stepper);
  content.appendChild(body);
  content.appendChild(errorBox);
  content.appendChild(actions);

  const overlay = openModal(content);
  closeBtn.addEventListener("click", () => overlay.remove());

  function renderStepper() {
    stepper.replaceChildren();
    steps.forEach((s, idx) => {
      const active = idx === stepIndex;
      const done = idx < stepIndex;
      const chip = el(
        "div",
        active
          ? "rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700"
          : done
            ? "rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700"
            : "rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500",
        done ? `✓ ${escapeHtml(s.label)}` : `${idx + 1}. ${escapeHtml(s.label)}`
      );
      stepper.appendChild(chip);
    });
  }

  function setError(message) {
    if (!message) {
      errorBox.textContent = "";
      errorBox.classList.add("hidden");
      return;
    }
    errorBox.textContent = message;
    errorBox.classList.remove("hidden");
  }

  async function renderStep() {
    setError("");
    renderStepper();

    const step = steps[stepIndex];
    body.replaceChildren();
    const view = await step.render({ state, setError, overlay, goNext, goBack, setStep });
    if (view) body.appendChild(view);

    backBtn.disabled = stepIndex === 0;
    backBtn.className =
      stepIndex === 0
        ? "rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-400"
        : "rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50";

    nextBtn.textContent = stepIndex === steps.length - 1 ? "Done" : "Next";
  }

  async function goNext() {
    setError("");
    const step = steps[stepIndex];
    if (step.validate) {
      const msg = await step.validate({ state });
      if (msg) {
        setError(msg);
        return;
      }
    }
    if (stepIndex >= steps.length - 1) {
      overlay.remove();
      return;
    }
    stepIndex += 1;
    await renderStep();
  }

  async function goBack() {
    setError("");
    if (stepIndex === 0) return;
    stepIndex -= 1;
    await renderStep();
  }

  async function setStep(i) {
    if (i < 0 || i >= steps.length) return;
    stepIndex = i;
    await renderStep();
  }

  backBtn.addEventListener("click", goBack);
  nextBtn.addEventListener("click", goNext);
  renderStep();
  return overlay;
}

function openProvisionParentWizard() {
  openWizardModal({
    title: "Parent + Students (multi-step)",
    initialState: {
      parent: { full_name: "", phone: "", address: "", parent_type: "Parent" },
      students: [{ full_name: "", lrn: "", address: "", grade_level: "", strand: "" }],
      account: { user_id: "", password: "" },
    },
    steps: [
      {
        label: "Parent info",
        render: ({ state }) => {
          const grid = el("div", "grid gap-4 md:grid-cols-2");
          const name = textInput({ value: state.parent.full_name, placeholder: "Full name" });
          const phone = textInput({ value: state.parent.phone, placeholder: "Phone" });
          const address = textInput({ value: state.parent.address, placeholder: "Address" });
          const type = selectInput(
            [
              { value: "Parent", label: "Parent" },
              { value: "Guardian", label: "Guardian" },
            ],
            state.parent.parent_type
          );

          name.addEventListener("input", () => (state.parent.full_name = name.value));
          phone.addEventListener("input", () => (state.parent.phone = phone.value));
          address.addEventListener("input", () => (state.parent.address = address.value));
          type.addEventListener("change", () => (state.parent.parent_type = type.value));

          const row = (label, inputEl) => {
            const w = el("div", "space-y-1");
            w.appendChild(el("label", "block text-sm font-medium text-slate-700", escapeHtml(label)));
            w.appendChild(inputEl);
            return w;
          };
          grid.appendChild(row("Name", name));
          grid.appendChild(row("Phone", phone));
          grid.appendChild(row("Address", address));
          grid.appendChild(row("Role (Parent/Guardian)", type));
          return grid;
        },
        validate: ({ state }) => {
          if (!state.parent.full_name.trim()) return "Parent name is required.";
          if (!state.parent.phone.trim()) return "Parent phone is required.";
          return "";
        },
      },
      {
        label: "Student info",
        render: ({ state }) => {
          const s = state.students[0];
          const grid = el("div", "grid gap-4 md:grid-cols-2");
          const name = textInput({ value: s.full_name, placeholder: "Student full name" });
          const lrn = textInput({ value: s.lrn, placeholder: "LRN (recommended)" });
          const grade = textInput({ value: s.grade_level, placeholder: "Grade level" });
          const strand = textInput({ value: s.strand, placeholder: "Strand (SHS only)" });
          const address = textInput({ value: s.address || state.parent.address, placeholder: "Address" });

          name.addEventListener("input", () => (s.full_name = name.value));
          lrn.addEventListener("input", () => (s.lrn = lrn.value));
          grade.addEventListener("input", () => (s.grade_level = grade.value));
          strand.addEventListener("input", () => (s.strand = strand.value));
          address.addEventListener("input", () => (s.address = address.value));

          const row = (label, inputEl) => {
            const w = el("div", "space-y-1");
            w.appendChild(el("label", "block text-sm font-medium text-slate-700", escapeHtml(label)));
            w.appendChild(inputEl);
            return w;
          };
          grid.appendChild(row("Student name", name));
          grid.appendChild(row("LRN", lrn));
          grid.appendChild(row("Grade level", grade));
          grid.appendChild(row("Strand", strand));
          grid.appendChild(el("div", "md:col-span-2"));
          grid.appendChild(row("Address", address));
          grid.appendChild(
            el(
              "div",
              "md:col-span-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700 ring-1 ring-slate-200",
              `Emergency contact: ${escapeHtml(state.parent.phone)}`
            )
          );
          return grid;
        },
        validate: ({ state }) => {
          const s = state.students[0];
          if (!s.full_name.trim()) return "Student name is required.";
          if (!s.grade_level.trim()) return "Grade level is required.";
          return "";
        },
      },
      {
        label: "Add more",
        render: ({ state }) => {
          const wrap = el("div", "");
          wrap.appendChild(el("div", "text-sm text-slate-600", "Add more children (optional)."));
          const addBtn = button("Add another student", "secondary");
          const list = el("div", "mt-4 space-y-2");

          const renderList = () => {
            list.replaceChildren();
            state.students.forEach((s, idx) => {
              const card = el("div", "rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200");
              card.innerHTML = `<div class="flex items-start justify-between gap-2"><div><div class="text-sm font-semibold text-slate-900">${escapeHtml(
                s.full_name || `Student ${idx + 1}`
              )}</div><div class="mt-1 text-xs text-slate-600">${escapeHtml(
                `${s.grade_level || "—"}${s.strand ? ` • ${s.strand}` : ""}${s.lrn ? ` • LRN ${s.lrn}` : ""}`
              )}</div></div></div>`;
              if (idx > 0) {
                const removeBtn = button("Remove", "secondary");
                removeBtn.className =
                  "rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white";
                removeBtn.addEventListener("click", () => {
                  state.students.splice(idx, 1);
                  renderList();
                });
                card.querySelector("div.flex")?.appendChild(removeBtn);
              }
              list.appendChild(card);
            });
          };
          renderList();

          addBtn.addEventListener("click", () => {
            state.students.push({ full_name: "", lrn: "", address: state.parent.address, grade_level: "", strand: "" });
            renderList();
          });

          wrap.appendChild(addBtn);
          wrap.appendChild(list);
          return wrap;
        },
      },
      {
        label: "IDs",
        render: ({ state }) => {
          const wrap = el("div", "");
          wrap.appendChild(el("div", "text-sm text-slate-600", "Generate one student ID per student."));
          const list = el("div", "mt-4 space-y-2");
          state.students.forEach((s) => {
            if (!s.generated_id) s.generated_id = generateStudentUserId(s.lrn);
            const card = el("div", "rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200");
            card.appendChild(el("div", "text-sm font-semibold text-slate-900", escapeHtml(s.full_name || "Student")));
            const row = el("div", "mt-3 flex gap-2");
            const code = textInput({ value: s.generated_id });
            const regen = button("Regenerate", "secondary");
            regen.className =
              "rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white";
            code.addEventListener("input", () => (s.generated_id = code.value));
            regen.addEventListener("click", () => {
              s.generated_id = generateStudentUserId(s.lrn);
              code.value = s.generated_id;
            });
            row.appendChild(code);
            row.appendChild(regen);
            card.appendChild(row);
            list.appendChild(card);
          });
          wrap.appendChild(list);
          return wrap;
        },
      },
      {
        label: "Confirm",
        render: ({ state }) => {
          const wrap = el("div", "space-y-4");
          if (!state.account.user_id) state.account.user_id = generateStaffUserId("PAR", state.parent.phone);

          const userId = textInput({ value: state.account.user_id, placeholder: "Parent user ID" });
          const password = textInput({ value: state.account.password, placeholder: "Set password", type: "password" });
          userId.addEventListener("input", () => (state.account.user_id = userId.value));
          password.addEventListener("input", () => (state.account.password = password.value));

          const row = (label, inputEl) => {
            const w = el("div", "space-y-1");
            w.appendChild(el("label", "block text-sm font-medium text-slate-700", escapeHtml(label)));
            w.appendChild(inputEl);
            return w;
          };
          const grid = el("div", "grid gap-4 md:grid-cols-2");
          grid.appendChild(row("Parent User ID", userId));
          grid.appendChild(row("Password", password));
          wrap.appendChild(grid);

          const summary = el("div", "rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200");
          summary.innerHTML = `<div class="text-sm font-semibold text-slate-900">Preview</div><div class="mt-2 text-sm text-slate-700">${escapeHtml(
            state.parent.full_name
          )} • ${escapeHtml(state.parent.parent_type)} • ${escapeHtml(state.parent.phone)}</div><div class="mt-1 text-sm text-slate-700">${escapeHtml(
            state.parent.address || ""
          )}</div>`;
          const ul = el("ul", "mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700");
          state.students.forEach((s) => {
            const li = document.createElement("li");
            li.textContent = `${s.full_name} • ${s.grade_level}${s.strand ? ` • ${s.strand}` : ""} • ${s.generated_id || ""}`;
            ul.appendChild(li);
          });
          summary.appendChild(ul);
          wrap.appendChild(summary);
          return wrap;
        },
        validate: ({ state }) => {
          if (!String(state.account.user_id || "").trim()) return "Parent user ID is required.";
          if (!String(state.account.password || "").trim()) return "Password is required.";
          return "";
        },
      },
      {
        label: "Export",
        render: ({ state }) => {
          const payload = {
            generated_at: new Date().toISOString(),
            accounts: [
              {
                kind: "parent_bundle",
                user_id: state.account.user_id.trim(),
                password: state.account.password,
                profile: {
                  full_name: state.parent.full_name.trim(),
                  phone: state.parent.phone.trim(),
                  address: state.parent.address.trim() || null,
                  email: null,
                  role: "parent",
                  is_active: true,
                  parent_type: state.parent.parent_type,
                },
                students: state.students.map((s) => ({
                  full_name: s.full_name.trim(),
                  lrn: s.lrn.trim() || null,
                  address: (s.address || state.parent.address || "").trim() || null,
                  grade_level: s.grade_level.trim(),
                  strand: s.strand.trim() || null,
                  qr_code: (s.generated_id || generateStudentUserId(s.lrn)).trim(),
                })),
              },
            ],
          };

          const wrap = el("div", "");
          wrap.appendChild(
            el(
              "div",
              "rounded-2xl bg-slate-50 p-4 text-sm text-slate-700 ring-1 ring-slate-200",
              "Download the JSON and run the local provisioning script to create Auth + profiles + students + IDs."
            )
          );
          const row = el("div", "mt-4 flex flex-wrap gap-2");
          const downloadBtn = button("Download JSON", "primary");
          const copyBtn = button("Copy credentials", "secondary");
          downloadBtn.addEventListener("click", () => {
            const safe = `provision_parent_${payload.accounts[0].user_id}.json`.replaceAll(/[^a-zA-Z0-9_.-]/g, "_");
            downloadJson(safe, payload);
          });
          copyBtn.addEventListener("click", async () => {
            await navigator.clipboard.writeText(`user_id: ${payload.accounts[0].user_id}\npassword: ${payload.accounts[0].password}`);
            copyBtn.textContent = "Copied";
            setTimeout(() => (copyBtn.textContent = "Copy credentials"), 900);
          });
          row.appendChild(downloadBtn);
          row.appendChild(copyBtn);
          wrap.appendChild(row);

          const pre = el("pre", "mt-4 max-h-64 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-100");
          pre.textContent = JSON.stringify(payload, null, 2);
          wrap.appendChild(pre);
          return wrap;
        },
      },
    ],
  });
}

function openProvisionStaffWizard() {
  openWizardModal({
    title: "Add Staff (multi-step)",
    initialState: {
      staff: { full_name: "", phone: "", address: "", email: "", role: "teacher" },
      account: { user_id: "", password: "" },
    },
    steps: [
      {
        label: "Role & info",
        render: ({ state }) => {
          const grid = el("div", "grid gap-4 md:grid-cols-2");
          const role = selectInput(
            [
              { value: "teacher", label: "Teacher" },
              { value: "guard", label: "Guard" },
              { value: "clinic", label: "Clinic" },
              { value: "admin", label: "Admin" },
            ],
            state.staff.role
          );
          const name = textInput({ value: state.staff.full_name, placeholder: "Full name" });
          const phone = textInput({ value: state.staff.phone, placeholder: "Phone" });
          const email = textInput({ value: state.staff.email, placeholder: "Email (optional)" });
          const address = textInput({ value: state.staff.address, placeholder: "Address (optional)" });

          role.addEventListener("change", () => (state.staff.role = role.value));
          name.addEventListener("input", () => (state.staff.full_name = name.value));
          phone.addEventListener("input", () => (state.staff.phone = phone.value));
          email.addEventListener("input", () => (state.staff.email = email.value));
          address.addEventListener("input", () => (state.staff.address = address.value));

          const row = (label, inputEl) => {
            const w = el("div", "space-y-1");
            w.appendChild(el("label", "block text-sm font-medium text-slate-700", escapeHtml(label)));
            w.appendChild(inputEl);
            return w;
          };

          grid.appendChild(row("Role", role));
          grid.appendChild(row("Full name", name));
          grid.appendChild(row("Phone", phone));
          grid.appendChild(row("Email", email));
          grid.appendChild(el("div", "md:col-span-2"));
          grid.appendChild(row("Address", address));
          return grid;
        },
        validate: ({ state }) => {
          if (!state.staff.full_name.trim()) return "Full name is required.";
          if (!state.staff.phone.trim()) return "Phone is required.";
          return "";
        },
      },
      {
        label: "Account",
        render: ({ state }) => {
          const rolePrefix = (() => {
            const r = String(state.staff.role);
            if (r === "teacher") return "TCH";
            if (r === "guard") return "GRD";
            if (r === "clinic") return "CLC";
            if (r === "admin") return "ADM";
            return "USR";
          })();

          if (!state.account.user_id) state.account.user_id = generateStaffUserId(rolePrefix, state.staff.phone);

          const userId = textInput({ value: state.account.user_id, placeholder: "User ID" });
          const password = textInput({ value: state.account.password, placeholder: "Set password", type: "password" });
          userId.addEventListener("input", () => (state.account.user_id = userId.value));
          password.addEventListener("input", () => (state.account.password = password.value));

          const grid = el("div", "grid gap-4 md:grid-cols-2");
          const row = (label, inputEl) => {
            const w = el("div", "space-y-1");
            w.appendChild(el("label", "block text-sm font-medium text-slate-700", escapeHtml(label)));
            w.appendChild(inputEl);
            return w;
          };
          grid.appendChild(row("User ID", userId));
          grid.appendChild(row("Password", password));

          const hint = el(
            "div",
            "md:col-span-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700 ring-1 ring-slate-200",
            "Passwords are not saved in Supabase tables. Download the provisioning JSON and run the local script."
          );

          const wrap = el("div", "space-y-4");
          wrap.appendChild(grid);
          wrap.appendChild(hint);
          return wrap;
        },
        validate: ({ state }) => {
          if (!String(state.account.user_id || "").trim()) return "User ID is required.";
          if (!String(state.account.password || "").trim()) return "Password is required.";
          return "";
        },
      },
      {
        label: "Preview",
        render: ({ state }) => {
          const box = el("div", "rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200");
          box.innerHTML = `<div class="text-sm font-semibold text-slate-900">Confirm staff account</div>
<div class="mt-2 text-sm text-slate-700">${escapeHtml(state.staff.full_name)} • ${escapeHtml(state.staff.role)}</div>
<div class="mt-1 text-sm text-slate-700">${escapeHtml(state.staff.phone)}</div>
<div class="mt-1 text-sm text-slate-700">${escapeHtml(state.staff.email || "")}</div>
<div class="mt-1 text-sm text-slate-700">${escapeHtml(state.staff.address || "")}</div>
<div class="mt-3 text-sm font-semibold text-slate-900">Credentials</div>
<div class="mt-1 font-mono text-xs text-slate-700">${escapeHtml(state.account.user_id)}</div>`;
          return box;
        },
      },
      {
        label: "Export",
        render: ({ state }) => {
          const payload = {
            generated_at: new Date().toISOString(),
            accounts: [
              {
                kind: "staff",
                user_id: state.account.user_id.trim(),
                password: state.account.password,
                profile: {
                  full_name: state.staff.full_name.trim(),
                  phone: state.staff.phone.trim(),
                  address: state.staff.address.trim() || null,
                  email: state.staff.email.trim() || null,
                  role: state.staff.role,
                  is_active: true,
                },
              },
            ],
          };

          const wrap = el("div", "");
          wrap.appendChild(
            el(
              "div",
              "rounded-2xl bg-slate-50 p-4 text-sm text-slate-700 ring-1 ring-slate-200",
              "Download the JSON and run the local provisioning script to create the Auth user + profile."
            )
          );
          const row = el("div", "mt-4 flex flex-wrap gap-2");
          const downloadBtn = button("Download JSON", "primary");
          const copyBtn = button("Copy credentials", "secondary");
          downloadBtn.addEventListener("click", () => {
            const safe = `provision_staff_${payload.accounts[0].user_id}.json`.replaceAll(/[^a-zA-Z0-9_.-]/g, "_");
            downloadJson(safe, payload);
          });
          copyBtn.addEventListener("click", async () => {
            await navigator.clipboard.writeText(`user_id: ${payload.accounts[0].user_id}\npassword: ${payload.accounts[0].password}`);
            copyBtn.textContent = "Copied";
            setTimeout(() => (copyBtn.textContent = "Copy credentials"), 900);
          });
          row.appendChild(downloadBtn);
          row.appendChild(copyBtn);
          wrap.appendChild(row);

          const pre = el("pre", "mt-4 max-h-64 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-100");
          pre.textContent = JSON.stringify(payload, null, 2);
          wrap.appendChild(pre);
          return wrap;
        },
      },
    ],
  });
}

function renderTable({ profiles, issuesById, onEdit, onToggleActive, sortKey, sortDir }) {
  const wrap = el("div", "mt-4 overflow-x-auto");
  const table = el("table", "w-full min-w-[720px] text-left text-sm");
  table.innerHTML =
    '<thead class="text-xs uppercase text-slate-500"><tr><th class="py-2 pr-4">Name</th><th class="py-2 pr-4">User ID</th><th class="py-2 pr-4">Role</th><th class="py-2 pr-4">Active</th><th class="py-2 pr-4">Issues</th><th class="py-2 pr-4 text-right">Edit</th></tr></thead>';
  const tbody = el("tbody", "divide-y divide-slate-200");

  const sorted = [...profiles].sort((a, b) => {
    const dir = sortDir === "desc" ? -1 : 1;
    const va = String(a?.[sortKey] ?? "").toLowerCase();
    const vb = String(b?.[sortKey] ?? "").toLowerCase();
    if (va < vb) return -1 * dir;
    if (va > vb) return 1 * dir;
    return 0;
  });

  for (const p of sorted) {
    const tr = document.createElement("tr");
    const active = Boolean(p.is_active);
    tr.innerHTML = `
      <td class="py-3 pr-4">
        <div class="font-medium text-slate-900">${escapeHtml(p.full_name)}</div>
        <div class="mt-0.5 text-xs text-slate-600">${escapeHtml(p.phone ?? "")}</div>
      </td>
      <td class="py-3 pr-4 font-mono text-xs text-slate-700">${escapeHtml(p.username)}</td>
      <td class="py-3 pr-4"></td>
      <td class="py-3 pr-4"></td>
      <td class="py-3 pr-4"></td>
      <td class="py-3 pr-4 text-right"></td>
    `;
    tr.children[2].appendChild(rolePill(p.role));

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = active
      ? "rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700 hover:bg-green-200"
      : "rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200";
    toggle.textContent = active ? "Active" : "Inactive";
    toggle.addEventListener("click", () => onToggleActive(p));
    tr.children[3].appendChild(toggle);

    const issues = issuesById?.get?.(p.id) ?? [];
    if (issues.length) {
      const row = el("div", "flex flex-wrap gap-1");
      for (const issue of issues) {
        row.appendChild(pill(issue, "bg-amber-100 text-amber-800"));
      }
      tr.children[4].appendChild(row);
    } else {
      tr.children[4].appendChild(el("span", "text-xs text-slate-500", "—"));
    }

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => onEdit(p));
    tr.children[5].appendChild(editBtn);

    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}

async function render() {
  usersStatus.textContent = "Loading…";
  usersApp.replaceChildren();

  const [profiles, resetRequests, teacherAssignmentIds, parentIdsWithStudents] = await Promise.all([
    loadProfiles(),
    loadResetRequests(),
    loadTeacherAssignmentIds(),
    loadParentIdsWithStudents(),
  ]);
  const rolesForPage = new Set(["teacher", "parent", "guard", "clinic", "admin"]);
  const visible = profiles.filter((p) => rolesForPage.has(String(p.role ?? "").toLowerCase()));
  const pendingResetIds = new Set(
    (resetRequests ?? []).filter((r) => String(r.status ?? "pending") !== "done").map((r) => r.requested_user_id)
  );
  const issuesById = new Map();
  for (const p of visible) {
    const issues = [];
    const role = String(p.role ?? "").toLowerCase();
    if (role === "teacher" && !teacherAssignmentIds.has(p.id)) issues.push("No class");
    if (role === "parent" && !parentIdsWithStudents.has(p.id)) issues.push("No child linked");
    if (pendingResetIds.has(p.id)) issues.push("Password reset");
    issuesById.set(p.id, issues);
  }

  const header = el("div", "flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between");
  const left = el("div", "flex flex-1 flex-col gap-2 md:flex-row");
  const search = textInput({ placeholder: "Search name or user ID…" });
  const roleFilter = selectInput(
    [
      { value: "all", label: "All roles" },
      { value: "teacher", label: "Teacher" },
      { value: "parent", label: "Parent" },
      { value: "guard", label: "Guard" },
      { value: "clinic", label: "Clinic" },
      { value: "admin", label: "Admin" },
    ],
    "all"
  );
  const statusFilter = selectInput(
    [
      { value: "all", label: "All statuses" },
      { value: "active", label: "Active only" },
      { value: "inactive", label: "Inactive only" },
    ],
    "all"
  );
  const issueFilter = selectInput(
    [
      { value: "all", label: "All users" },
      { value: "has_issues", label: "With issues" },
      { value: "password_reset", label: "Password reset" },
      { value: "no_class", label: "No class" },
      { value: "no_child", label: "No child linked" },
    ],
    "all"
  );
  const sortKey = selectInput(
    [
      { value: "full_name", label: "Sort: Name" },
      { value: "username", label: "Sort: User ID" },
      { value: "role", label: "Sort: Role" },
    ],
    "full_name"
  );
  const sortDir = selectInput(
    [
      { value: "asc", label: "Ascending" },
      { value: "desc", label: "Descending" },
    ],
    "asc"
  );

  left.appendChild(search);
  left.appendChild(roleFilter);
  left.appendChild(statusFilter);
  left.appendChild(issueFilter);
  left.appendChild(sortKey);
  left.appendChild(sortDir);

  const right = el("div", "flex gap-2");
  const addProfileBtn = button("Add Profile", "secondary");
  const linkStudentBtn = button("Add Parent+Students", "primary");
  right.appendChild(addProfileBtn);
  right.appendChild(linkStudentBtn);

  header.appendChild(left);
  header.appendChild(right);

  const note = el(
    "div",
    "mt-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700 ring-1 ring-slate-200",
    "<div class=\"font-semibold text-slate-900\">Account creation note</div><div class=\"mt-1\">This UI manages profiles and student records. Creating Supabase Auth accounts requires a local admin script (service key) to keep the browser safe.</div>"
  );

  const tableBox = el("div", "");

  async function refresh() {
    await render();
  }

  addProfileBtn.addEventListener("click", () => openProvisionStaffWizard());
  linkStudentBtn.addEventListener("click", () => {
    window.location.href = "./admin-parent-students.html";
  });

  async function toggleActive(p) {
    const next = !Boolean(p.is_active);
    const { error } = await supabase.from("profiles").update({ is_active: next }).eq("id", p.id);
    if (error) {
      alert(error.message);
      return;
    }
    await refresh();
  }

  function applyFilters() {
    const q = search.value.trim().toLowerCase();
    const role = roleFilter.value;
    const status = statusFilter.value;
    const issue = issueFilter.value;
    const rows = visible.filter((p) => {
      if (role !== "all" && String(p.role) !== role) return false;
      if (status === "active" && !Boolean(p.is_active)) return false;
      if (status === "inactive" && Boolean(p.is_active)) return false;

      const issues = issuesById.get(p.id) ?? [];
      if (issue === "has_issues" && issues.length === 0) return false;
      if (issue === "password_reset" && !issues.includes("Password reset")) return false;
      if (issue === "no_class" && !issues.includes("No class")) return false;
      if (issue === "no_child" && !issues.includes("No child linked")) return false;

      if (!q) return true;
      return String(p.full_name ?? "").toLowerCase().includes(q) || String(p.username ?? "").toLowerCase().includes(q);
    });

    tableBox.replaceChildren(
      renderTable({
        profiles: rows,
        issuesById,
        onEdit: (p) => openEditProfileModal(p, refresh),
        onToggleActive: toggleActive,
        sortKey: sortKey.value,
        sortDir: sortDir.value,
      })
    );
    usersStatus.textContent = `Showing ${rows.length} users.`;
  }

  for (const control of [search, roleFilter, statusFilter, issueFilter, sortKey, sortDir]) {
    control.addEventListener("input", applyFilters);
    control.addEventListener("change", applyFilters);
  }

  usersApp.appendChild(header);
  usersApp.appendChild(note);
  usersApp.appendChild(tableBox);
  usersApp.appendChild(renderResetRequests(resetRequests, refresh));

  applyFilters();
}

async function init() {
  const { error } = await initAdminPage();
  if (error) return;

  try {
    await render();
  } catch (e) {
    usersStatus.textContent = e?.message ?? "Failed to load users.";
  }
}

init();
