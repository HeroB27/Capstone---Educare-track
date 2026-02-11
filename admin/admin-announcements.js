import { supabase } from "../core/core.js";
import { initAppShell } from "../core/shell.js";
import { initAdminPage } from "./admin-common.js";
import { button, checkbox, el, escapeHtml, formatLocalDateTime, openModal, selectInput, textArea, textInput } from "../core/ui.js";

initAppShell({ role: "admin", active: "communications" });

// [Date Checked: 2026-02-11] | [Remarks: Added defensive code to prevent null reference errors when DOM elements are missing]
const announceStatus = document.getElementById("announceStatus") ?? document.createElement("div");
const announceApp = document.getElementById("announceApp") ?? document.getElementById("announcementsList");
if (!document.getElementById("announceStatus") && announceApp?.parentElement) {
  announceStatus.id = "announceStatus";
  announceStatus.className = "text-sm text-slate-600 mb-4";
  announceApp.parentElement.insertBefore(announceStatus, announceApp);
}

async function loadAnnouncements() {
  const { data, error } = await supabase
    .from("announcements")
    .select("id,title,body,audience_teachers,audience_parents,audience_staff,created_by,class_id,created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

async function loadClasses() {
  const { data, error } = await supabase
    .from("classes")
    .select("id,grade_level,strand,room")
    .eq("is_active", true)
    .order("grade_level", { ascending: true })
    .order("room", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

function toClassLabel(c) {
  if (!c) return "";
  return `${c.grade_level ?? ""}${c.strand ? ` • ${c.strand}` : ""}${c.room ? ` • ${c.room}` : ""}`.trim();
}

function audienceLabel(a) {
  const parts = [];
  if (a.audience_teachers) parts.push("Teachers");
  if (a.audience_parents) parts.push("Parents");
  if (a.audience_staff) parts.push("Staff");
  if (!parts.length) return "No audience selected";
  return parts.join(", ");
}

function openAnnouncementModal({ mode, announcement, profileId, classes, onSaved }) {
  const content = el("div", "");
  content.appendChild(
    el("div", "text-lg font-semibold text-slate-900", mode === "create" ? "Create announcement" : "Edit announcement")
  );

  const form = el("form", "mt-4 space-y-4");
  const title = textInput({ value: announcement?.title ?? "", placeholder: "Title" });
  const body = textArea({ value: announcement?.body ?? "", placeholder: "Message" });

  const classOptions = [{ value: "", label: "Global (no class)" }].concat(
    (classes ?? []).map((c) => ({ value: c.id, label: toClassLabel(c) || c.id }))
  );
  const classSel = selectInput(classOptions, announcement?.class_id ?? "");

  const t = checkbox("Teachers", announcement?.audience_teachers ?? false, "text-violet-600 focus:ring-violet-500");
  const p = checkbox("Parents", announcement?.audience_parents ?? false, "text-violet-600 focus:ring-violet-500");
  const s = checkbox("Staff", announcement?.audience_staff ?? false, "text-violet-600 focus:ring-violet-500");

  const fieldRow = (label, inputEl) => {
    const w = el("div", "space-y-1");
    w.appendChild(el("label", "block text-sm font-medium text-slate-700", escapeHtml(label)));
    w.appendChild(inputEl);
    return w;
  };

  form.appendChild(fieldRow("Scope", classSel));
  form.appendChild(fieldRow("Title", title));
  form.appendChild(fieldRow("Body", body));

  const audience = el("div", "space-y-2");
  audience.appendChild(el("div", "text-sm font-medium text-slate-700", "Audience"));
  const audRow = el("div", "flex flex-wrap gap-4");
  audRow.appendChild(t.wrap);
  audRow.appendChild(p.wrap);
  audRow.appendChild(s.wrap);
  audience.appendChild(audRow);
  form.appendChild(audience);

  const errorBox = el("div", "hidden rounded-xl bg-red-50 p-3 text-sm text-red-700");
  const actions = el("div", "flex justify-end gap-2");
  const cancelBtn = button("Cancel", "ghost", "violet");
  const saveBtn = button("Save", "primary", "violet");
  saveBtn.type = "submit";
  cancelBtn.addEventListener("click", () => overlay.remove());
  actions.appendChild(cancelBtn);
  actions.appendChild(saveBtn);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorBox.classList.add("hidden");
    saveBtn.disabled = true;

    const payload = {
      title: title.value.trim(),
      body: body.value.trim(),
      audience_teachers: t.input.checked,
      audience_parents: p.input.checked,
      audience_staff: s.input.checked,
      class_id: classSel.value || null,
    };

    if (!payload.title || !payload.body) {
      errorBox.textContent = "Title and body are required.";
      errorBox.classList.remove("hidden");
      saveBtn.disabled = false;
      return;
    }

    if (!payload.audience_teachers && !payload.audience_parents && !payload.audience_staff) {
      errorBox.textContent = "Select at least one audience.";
      errorBox.classList.remove("hidden");
      saveBtn.disabled = false;
      return;
    }

    let res;
    if (mode === "create") {
      res = await supabase.from("announcements").insert({ ...payload, created_by: profileId });
    } else {
      res = await supabase.from("announcements").update(payload).eq("id", announcement.id);
    }

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

  const overlay = openModal(content, { maxWidthClass: "max-w-2xl" });
}

async function render(profileId) {
  announceStatus.textContent = "Loading…";
  announceApp.replaceChildren();

  const [items, classes] = await Promise.all([loadAnnouncements(), loadClasses()]);
  const classesById = new Map(classes.map((c) => [c.id, c]));

  const header = el("div", "flex items-center justify-between");
  header.appendChild(el("div", "text-sm text-slate-600", "Announcements display on the dashboard."));
  const addBtn = button("Create", "primary", "violet");
  header.appendChild(addBtn);

  const list = el("div", "mt-4 space-y-3");
  if (!items.length) {
    list.appendChild(el("div", "text-sm text-slate-600", "No announcements yet."));
  } else {
    for (const a of items) {
      const card = el("div", "rounded-2xl bg-slate-50 p-4");
      const c = a.class_id ? classesById.get(a.class_id) : null;
      const meta = `${formatLocalDateTime(a.created_at)} • ${audienceLabel(a)}${c ? ` • ${toClassLabel(c)}` : ""}`;
      card.innerHTML = `
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="text-sm font-semibold text-slate-900">${escapeHtml(a.title)}</div>
            <div class="mt-1 text-xs text-slate-600">${escapeHtml(meta)}</div>
          </div>
          <div class="flex gap-2">
            <button class="btn btn-secondary btn-sm">Edit</button>
            <button class="btn btn-danger btn-sm">Delete</button>
          </div>
        </div>
        <div class="mt-3 whitespace-pre-wrap text-sm text-slate-700">${escapeHtml(a.body)}</div>
      `;
      const [editBtn, delBtn] = card.querySelectorAll("button");
      editBtn.addEventListener("click", () =>
        openAnnouncementModal({ mode: "edit", announcement: a, profileId, classes, onSaved: () => render(profileId) })
      );
      delBtn.addEventListener("click", async () => {
        if (!confirm("Delete this announcement?")) return;
        const { error } = await supabase.from("announcements").delete().eq("id", a.id);
        if (error) {
          announceStatus.textContent = error.message;
          return;
        }
        await render(profileId);
      });
      list.appendChild(card);
    }
  }

  addBtn.addEventListener("click", () =>
    openAnnouncementModal({ mode: "create", announcement: null, profileId, classes, onSaved: () => render(profileId) })
  );

  announceApp.appendChild(header);
  announceApp.appendChild(list);
  announceStatus.textContent = `Loaded ${items.length} announcements.`;
}

async function init() {
  const { profile, error } = await initAdminPage();
  if (error) return;
  try {
    await render(profile.id);
  } catch (e) {
    announceStatus.textContent = e?.message ?? "Failed to load announcements.";
  }
}

init();
