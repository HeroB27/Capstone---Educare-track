import { supabase } from "../core/core.js";
import { initAppShell } from "../core/shell.js";
import { initAdminPage } from "./admin-common.js";

initAppShell({ role: "admin", active: "people" });

const psStatus = document.getElementById("psStatus");
const psApp = document.getElementById("psApp");

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

function textArea({ value = "", placeholder = "" } = {}) {
  const t = document.createElement("textarea");
  t.value = value;
  t.placeholder = placeholder;
  t.rows = 3;
  t.className =
    "w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200";
  return t;
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

function generateParentUserId(phone) {
  return `PAR-${currentYear()}-${lastFourDigits(phone)}-${randomFourDigits()}`;
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

function makeCard(title, subtitle) {
  const card = el("div", "rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200");
  card.appendChild(el("div", "text-sm font-semibold text-slate-900", escapeHtml(title)));
  if (subtitle) card.appendChild(el("div", "mt-1 text-sm text-slate-600", escapeHtml(subtitle)));
  return card;
}

async function loadParents() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,full_name,username,phone,address,is_active,role")
    .eq("role", "parent")
    .order("full_name", { ascending: true });
  if (error) throw error;
  return (data ?? []).filter((p) => p.is_active);
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

  const overlay = el("div", "fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4");
  const card = el("div", "w-full max-w-3xl rounded-2xl bg-white p-5 shadow-lg");
  overlay.appendChild(card);
  card.appendChild(content);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);

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
    const view = await step.render({ state, setError, overlay, goNext, goBack });
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

  backBtn.addEventListener("click", goBack);
  nextBtn.addEventListener("click", goNext);
  renderStep();
}

function openParentStudentsWizard({ parents }) {
  openWizardModal({
    title: "Parent + Students",
    initialState: {
      parentMode: "new",
      existingParentUsername: "",
      existingParentPassword: "",
      parent: { full_name: "", phone: "", address: "", note: "" },
      account: { user_id: "", password: "" },
      students: [{ full_name: "", lrn: "", address: "", grade_level: "", strand: "", student_id: "" }],
    },
    steps: [
      {
        label: "Parent",
        render: ({ state }) => {
          const mode = selectInput(
            [
              { value: "new", label: "Create new parent" },
              { value: "existing", label: "Use existing parent" },
            ],
            state.parentMode
          );
          mode.addEventListener("change", () => {
            state.parentMode = mode.value;
          });

          const options = [{ value: "", label: "Select parent…" }].concat(
            parents.map((p) => ({ value: p.username, label: `${p.full_name} (${p.username})` }))
          );
          const parentSel = selectInput(options, state.existingParentUsername);
          const existingPassword = textInput({
            value: state.existingParentPassword,
            placeholder: "Password (optional if parent already provisioned)",
            type: "password",
          });

          parentSel.addEventListener("change", () => {
            state.existingParentUsername = parentSel.value;
            const selected = parents.find((p) => p.username === parentSel.value);
            if (selected) {
              state.parent.full_name = selected.full_name ?? "";
              state.parent.phone = selected.phone ?? "";
              state.parent.address = selected.address ?? "";
            }
          });
          existingPassword.addEventListener("input", () => (state.existingParentPassword = existingPassword.value));

          const name = textInput({ value: state.parent.full_name, placeholder: "Parent full name" });
          const phone = textInput({ value: state.parent.phone, placeholder: "Phone" });
          const address = textInput({ value: state.parent.address, placeholder: "Address" });
          const note = textArea({ value: state.parent.note, placeholder: "Optional note" });

          name.addEventListener("input", () => (state.parent.full_name = name.value));
          phone.addEventListener("input", () => (state.parent.phone = phone.value));
          address.addEventListener("input", () => (state.parent.address = address.value));
          note.addEventListener("input", () => (state.parent.note = note.value));

          const row = (label, inputEl, span2 = false) => {
            const w = el("div", span2 ? "space-y-1 md:col-span-2" : "space-y-1");
            w.appendChild(el("label", "block text-sm font-medium text-slate-700", escapeHtml(label)));
            w.appendChild(inputEl);
            return w;
          };

          const grid = el("div", "grid gap-4 md:grid-cols-2");
          grid.appendChild(row("Mode", mode, true));

          const existingBox = el("div", "md:col-span-2 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200");
          existingBox.appendChild(el("div", "text-sm font-semibold text-slate-900", "Existing parent"));
          const existingGrid = el("div", "mt-3 grid gap-4 md:grid-cols-2");
          existingGrid.appendChild(row("Parent", parentSel, true));
          existingGrid.appendChild(row("Password", existingPassword, true));
          existingBox.appendChild(existingGrid);

          const newBox = el("div", "md:col-span-2 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200");
          newBox.appendChild(el("div", "text-sm font-semibold text-slate-900", "New parent info"));
          const newGrid = el("div", "mt-3 grid gap-4 md:grid-cols-2");
          newGrid.appendChild(row("Name", name));
          newGrid.appendChild(row("Phone", phone));
          newGrid.appendChild(row("Address", address, true));
          newGrid.appendChild(row("Note", note, true));
          newBox.appendChild(newGrid);

          if (state.parentMode === "existing") {
            newBox.classList.add("hidden");
            existingBox.classList.remove("hidden");
          } else {
            existingBox.classList.add("hidden");
            newBox.classList.remove("hidden");
          }

          grid.appendChild(existingBox);
          grid.appendChild(newBox);
          return grid;
        },
        validate: ({ state }) => {
          if (state.parentMode === "existing") {
            if (!state.existingParentUsername) return "Select an existing parent.";
            return "";
          }
          if (!state.parent.full_name.trim()) return "Parent name is required.";
          if (!state.parent.phone.trim()) return "Parent phone is required.";
          return "";
        },
      },
      {
        label: "Credentials",
        render: ({ state }) => {
          const wrap = el("div", "space-y-4");

          if (state.parentMode === "existing") {
            wrap.appendChild(
              el(
                "div",
                "rounded-2xl bg-slate-50 p-4 text-sm text-slate-700 ring-1 ring-slate-200",
                "Using an existing parent. Password is optional if the Auth account already exists."
              )
            );
            const parentRow = el("div", "grid gap-4 md:grid-cols-2");
            const username = textInput({ value: state.existingParentUsername, placeholder: "Parent user ID" });
            username.disabled = true;
            const password = textInput({ value: state.existingParentPassword, placeholder: "Password (optional)", type: "password" });
            password.addEventListener("input", () => (state.existingParentPassword = password.value));
            const row = (label, inputEl) => {
              const w = el("div", "space-y-1");
              w.appendChild(el("label", "block text-sm font-medium text-slate-700", escapeHtml(label)));
              w.appendChild(inputEl);
              return w;
            };
            parentRow.appendChild(row("Parent User ID", username));
            parentRow.appendChild(row("Password", password));
            wrap.appendChild(parentRow);
            return wrap;
          }

          if (!state.account.user_id) state.account.user_id = generateParentUserId(state.parent.phone);
          const userId = textInput({ value: state.account.user_id, placeholder: "Parent user ID" });
          const password = textInput({ value: state.account.password, placeholder: "Set password", type: "password" });
          const regen = button("Regenerate ID", "secondary");
          regen.addEventListener("click", () => {
            state.account.user_id = generateParentUserId(state.parent.phone);
            userId.value = state.account.user_id;
          });

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
          wrap.appendChild(grid);
          wrap.appendChild(regen);
          wrap.appendChild(
            el(
              "div",
              "rounded-xl bg-slate-50 p-3 text-sm text-slate-700 ring-1 ring-slate-200",
              "Password is not saved in Supabase tables. You will export JSON and run the local provisioning script."
            )
          );
          return wrap;
        },
        validate: ({ state }) => {
          if (state.parentMode === "existing") return "";
          if (!String(state.account.user_id || "").trim()) return "User ID is required.";
          if (!String(state.account.password || "").trim()) return "Password is required.";
          return "";
        },
      },
      {
        label: "Students",
        render: ({ state }) => {
          const wrap = el("div", "");
          wrap.appendChild(el("div", "text-sm text-slate-600", "Add one or more students."));

          const list = el("div", "mt-4 space-y-2");
          const addBtn = button("Add another student", "secondary");

          const renderList = () => {
            list.replaceChildren();
            state.students.forEach((s, idx) => {
              const card = el("div", "rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200");
              const grid = el("div", "grid gap-4 md:grid-cols-2");
              const name = textInput({ value: s.full_name, placeholder: "Student full name" });
              const lrn = textInput({ value: s.lrn, placeholder: "LRN (recommended)" });
              const grade = textInput({ value: s.grade_level, placeholder: "Grade level" });
              const strand = textInput({ value: s.strand, placeholder: "Strand (SHS only)" });
              const address = textInput({ value: s.address, placeholder: "Address" });
              if (!address.value && state.parent.address) {
                address.value = state.parent.address;
                s.address = address.value;
              }

              const row = (label, inputEl) => {
                const w = el("div", "space-y-1");
                w.appendChild(el("label", "block text-sm font-medium text-slate-700", escapeHtml(label)));
                w.appendChild(inputEl);
                return w;
              };

              name.addEventListener("input", () => (s.full_name = name.value));
              lrn.addEventListener("input", () => (s.lrn = lrn.value));
              grade.addEventListener("input", () => (s.grade_level = grade.value));
              strand.addEventListener("input", () => (s.strand = strand.value));
              address.addEventListener("input", () => (s.address = address.value));

              grid.appendChild(row("Name", name));
              grid.appendChild(row("LRN", lrn));
              grid.appendChild(row("Grade level", grade));
              grid.appendChild(row("Strand", strand));
              const addrWrap = el("div", "md:col-span-2 space-y-1");
              addrWrap.appendChild(el("label", "block text-sm font-medium text-slate-700", "Address"));
              addrWrap.appendChild(address);
              grid.appendChild(addrWrap);

              const footer = el("div", "mt-3 flex justify-end");
              if (idx > 0) {
                const rm = button("Remove", "secondary");
                rm.className =
                  "rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white";
                rm.addEventListener("click", () => {
                  state.students.splice(idx, 1);
                  renderList();
                });
                footer.appendChild(rm);
              }

              card.appendChild(el("div", "text-sm font-semibold text-slate-900", escapeHtml(`Student ${idx + 1}`)));
              card.appendChild(grid);
              card.appendChild(footer);
              list.appendChild(card);
            });
          };
          renderList();

          addBtn.addEventListener("click", () => {
            state.students.push({ full_name: "", lrn: "", address: state.parent.address || "", grade_level: "", strand: "", student_id: "" });
            renderList();
          });

          wrap.appendChild(addBtn);
          wrap.appendChild(list);
          return wrap;
        },
        validate: ({ state }) => {
          for (const s of state.students) {
            if (!s.full_name.trim()) return "Each student must have a name.";
            if (!s.grade_level.trim()) return "Each student must have a grade level.";
          }
          return "";
        },
      },
      {
        label: "Photos",
        render: ({ state }) => {
          const wrap = el("div", "space-y-4");
          wrap.appendChild(el("div", "text-sm text-slate-600", "Upload student photos for ID cards (optional)."));
          
          const list = el("div", "mt-4 space-y-4");
          state.students.forEach((s, idx) => {
            const card = el("div", "rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200");
            card.appendChild(el("div", "text-sm font-semibold text-slate-900", escapeHtml(s.full_name || `Student ${idx + 1}`)));
            
            const photoContainer = el("div", "mt-3");
            const photoInput = document.createElement("input");
            photoInput.type = "file";
            photoInput.accept = "image/jpeg,image/png,image/gif";
            photoInput.className = "block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-slate-50 file:text-slate-700 hover:file:bg-slate-100";
            
            // Store photo file in state
            photoInput.addEventListener("change", (e) => {
              const file = e.target.files[0];
              if (file) {
                s.photoFile = file;
                if (photoPreview) {
                  photoPreview.src = URL.createObjectURL(file);
                  photoPreview.classList.remove("hidden");
                }
              }
            });
            
            const photoPreview = document.createElement("img");
            photoPreview.className = "mt-2 hidden h-32 w-32 rounded-xl object-cover ring-1 ring-slate-200";
            photoPreview.alt = "Photo preview";
            
            if (s.photoFile) {
              photoPreview.src = URL.createObjectURL(s.photoFile);
              photoPreview.classList.remove("hidden");
            }
            
            photoContainer.appendChild(photoInput);
            photoContainer.appendChild(photoPreview);
            card.appendChild(photoContainer);
            list.appendChild(card);
          });
          
          wrap.appendChild(list);
          return wrap;
        },
      },
      {
        label: "IDs",
        render: ({ state }) => {
          const wrap = el("div", "");
          wrap.appendChild(el("div", "text-sm text-slate-600", "Generate student IDs (QR values)."));
          const list = el("div", "mt-4 space-y-2");
          state.students.forEach((s) => {
            if (!s.student_id) s.student_id = generateStudentUserId(s.lrn);
            const card = el("div", "rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200");
            const row = el("div", "mt-3 flex gap-2");
            const code = textInput({ value: s.student_id });
            const regen = button("Regenerate", "secondary");
            regen.className =
              "rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white";
            code.addEventListener("input", () => (s.student_id = code.value));
            regen.addEventListener("click", () => {
              s.student_id = generateStudentUserId(s.lrn);
              code.value = s.student_id;
            });
            card.appendChild(el("div", "text-sm font-semibold text-slate-900", escapeHtml(s.full_name)));
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
        label: "Export",
        render: ({ state }) => {
          const selected = parents.find((p) => p.username === state.existingParentUsername) ?? null;
          const userId = state.parentMode === "existing" ? state.existingParentUsername : state.account.user_id.trim();
          const password = state.parentMode === "existing" ? state.existingParentPassword : state.account.password;
          const profile = state.parentMode === "existing"
            ? {
                full_name: (selected?.full_name ?? state.parent.full_name.trim()) || userId,
                phone: (selected?.phone ?? state.parent.phone.trim()) || null,
                address: (selected?.address ?? state.parent.address.trim()) || null,
                email: null,
                role: "parent",
                is_active: true,
              }
            : {
                full_name: state.parent.full_name.trim(),
                phone: state.parent.phone.trim(),
                address: state.parent.address.trim() || null,
                email: null,
                role: "parent",
                is_active: true,
              };

          const payload = {
            generated_at: new Date().toISOString(),
            accounts: [
              {
                kind: "parent_bundle",
                user_id: userId,
                password,
                profile,
                note: state.parent.note.trim() || null,
                students: state.students.map((s) => ({
                  full_name: s.full_name.trim(),
                  lrn: s.lrn.trim() || null,
                  address: s.address.trim() || null,
                  grade_level: s.grade_level.trim(),
                  strand: s.strand.trim() || null,
                  qr_code: s.student_id.trim(),
                })),
              },
            ],
          };

          const wrap = el("div", "");
          wrap.appendChild(
            el(
              "div",
              "rounded-xl bg-slate-50 p-3 text-sm text-slate-700 ring-1 ring-slate-200",
              "If you selected an existing parent and leave password blank, provisioning will only add students + IDs."
            )
          );
          const row = el("div", "mt-4 flex flex-wrap gap-2");
          const downloadBtn = button("Download JSON", "primary");
          const copyBtn = button("Copy credentials", "secondary");
          downloadBtn.addEventListener("click", async () => {
            // Upload photos first if any
            const uploadedStudents = [];
            
            for (const student of state.students) {
              let photoPath = null;
              let photoMime = null;
              
              if (student.photoFile) {
                try {
                  const fileName = `${student.student_id || student.full_name.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.${student.photoFile.name.split('.').pop()}`;
                  const { error: uploadError } = await supabase.storage
                    .from('student-photos')
                    .upload(fileName, student.photoFile);
                  
                  if (uploadError) {
                    console.warn("Photo upload failed for", student.full_name, ":", uploadError);
                    // Continue without photo if upload fails
                  } else {
                    photoPath = fileName;
                    photoMime = student.photoFile.type;
                  }
                } catch (error) {
                  console.warn("Photo upload error for", student.full_name, ":", error);
                }
              }
              
              uploadedStudents.push({
                ...student,
                photo_path: photoPath,
                photo_mime: photoMime
              });
            }
            
            // Update payload with uploaded photo info
            const finalPayload = {
              ...payload,
              accounts: payload.accounts.map(account => ({
                ...account,
                students: uploadedStudents.map(s => ({
                  full_name: s.full_name.trim(),
                  lrn: s.lrn.trim() || null,
                  address: s.address.trim() || null,
                  grade_level: s.grade_level.trim(),
                  strand: s.strand.trim() || null,
                  qr_code: s.student_id.trim(),
                  photo_path: s.photo_path,
                  photo_mime: s.photo_mime
                }))
              }))
            };
            
            const safe = `parent_students_${userId}.json`.replaceAll(/[^a-zA-Z0-9_.-]/g, "_");
            downloadJson(safe, finalPayload);
          });
          copyBtn.addEventListener("click", async () => {
            await navigator.clipboard.writeText(`user_id: ${userId}\npassword: ${password || ""}`.trim());
            copyBtn.textContent = "Copied";
            setTimeout(() => (copyBtn.textContent = "Copy credentials"), 900);
          });
          row.appendChild(downloadBtn);
          row.appendChild(copyBtn);
          wrap.appendChild(row);
          const pre = el("pre", "mt-4 max-h-72 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-100");
          pre.textContent = JSON.stringify(payload, null, 2);
          wrap.appendChild(pre);
          return wrap;
        },
        validate: ({ state }) => {
          if (state.parentMode === "existing") {
            if (!state.existingParentUsername) return "Select an existing parent.";
            return "";
          }
          if (!String(state.account.user_id || "").trim()) return "User ID is required.";
          if (!String(state.account.password || "").trim()) return "Password is required.";
          return "";
        },
      },
    ],
  });
}

async function render() {
  psStatus.textContent = "Loading…";
  psApp.replaceChildren();

  const parents = await loadParents();

  const card = makeCard("Start Wizard", "Create parent + add students in one flow (or use an existing parent).");
  const startBtn = button("Start Parent+Students Wizard", "primary");
  startBtn.addEventListener("click", () => openParentStudentsWizard({ parents }));
  card.appendChild(el("div", "mt-4"));
  card.lastChild.appendChild(startBtn);
  psApp.appendChild(card);

  psApp.appendChild(
    el(
      "div",
      "mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700 ring-1 ring-slate-200",
      "Export JSON then run the local provisioning script. Password is never stored in Supabase tables."
    )
  );

  psStatus.textContent = "Ready.";
}

async function init() {
  const { error } = await initAdminPage();
  if (error) return;

  try {
    await render();
  } catch (e) {
    psStatus.textContent = e?.message ?? "Failed to load.";
  }
}

init();
