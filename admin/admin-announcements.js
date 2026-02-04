import { supabase } from "../core/core.js";
import { initAppShell } from "../core/shell.js";
import { initAdminPage } from "./admin-common.js";

initAppShell({ role: "admin", active: "communications" });

const announceStatus = document.getElementById("announceStatus");
const announceApp = document.getElementById("announceApp");

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
  t.rows = 5;
  t.className =
    "w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200";
  return t;
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

function toLocalDateTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleString();
}

async function loadAnnouncements() {
  const { data, error } = await supabase
    .from("announcements")
    .select("id,title,body,audience_teachers,audience_parents,audience_staff,created_by,created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

function audienceLabel(a) {
  const parts = [];
  if (a.audience_teachers) parts.push("Teachers");
  if (a.audience_parents) parts.push("Parents");
  if (a.audience_staff) parts.push("Staff");
  if (!parts.length) return "No audience selected";
  return parts.join(", ");
}

function openAnnouncementModal({ mode, announcement, profileId, onSaved }) {
  const content = el("div", "");
  content.appendChild(el("div", "text-lg font-semibold text-slate-900", mode === "create" ? "Create announcement" : "Edit announcement"));

  const form = el("form", "mt-4 space-y-4");
  const title = textInput({ value: announcement?.title ?? "", placeholder: "Title" });
  const body = textArea({ value: announcement?.body ?? "", placeholder: "Message" });

  const t = checkbox("Teachers", announcement?.audience_teachers ?? false);
  const p = checkbox("Parents", announcement?.audience_parents ?? false);
  const s = checkbox("Staff", announcement?.audience_staff ?? false);

  form.appendChild(el("div", "space-y-1", '<label class="block text-sm font-medium text-slate-700">Title</label>'));
  form.lastChild.appendChild(title);
  form.appendChild(el("div", "space-y-1", '<label class="block text-sm font-medium text-slate-700">Body</label>'));
  form.lastChild.appendChild(body);

  const audience = el("div", "space-y-2");
  audience.appendChild(el("div", "text-sm font-medium text-slate-700", "Audience"));
  const row = el("div", "flex flex-wrap gap-4");
  row.appendChild(t.wrap);
  row.appendChild(p.wrap);
  row.appendChild(s.wrap);
  audience.appendChild(row);
  form.appendChild(audience);

  const errorBox = el("div", "hidden rounded-xl bg-red-50 p-3 text-sm text-red-700");
  const actions = el("div", "flex justify-end gap-2");
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
      title: title.value.trim(),
      body: body.value.trim(),
      audience_teachers: t.input.checked,
      audience_parents: p.input.checked,
      audience_staff: s.input.checked,
    };

    if (!payload.title || !payload.body) {
      errorBox.textContent = "Title and body are required.";
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

  const overlay = openModal(content);
}

async function render(profileId) {
  announceStatus.textContent = "Loading…";
  announceApp.replaceChildren();

  const items = await loadAnnouncements();

  const header = el("div", "flex items-center justify-between");
  header.appendChild(el("div", "text-sm text-slate-600", "Announcements display on the dashboard."));
  const addBtn = button("Create", "primary");
  header.appendChild(addBtn);

  const list = el("div", "mt-4 space-y-3");
  if (!items.length) {
    list.appendChild(el("div", "text-sm text-slate-600", "No announcements yet."));
  } else {
    for (const a of items) {
      const card = el("div", "rounded-2xl bg-slate-50 p-4");
      const meta = `${toLocalDateTime(a.created_at)} • ${audienceLabel(a)}`;
      card.innerHTML = `
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="text-sm font-semibold text-slate-900">${escapeHtml(a.title)}</div>
            <div class="mt-1 text-xs text-slate-600">${escapeHtml(meta)}</div>
          </div>
          <div class="flex gap-2">
            <button class="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white">Edit</button>
            <button class="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white">Delete</button>
          </div>
        </div>
        <div class="mt-3 whitespace-pre-wrap text-sm text-slate-700">${escapeHtml(a.body)}</div>
      `;
      const [editBtn, delBtn] = card.querySelectorAll("button");
      editBtn.addEventListener("click", () => openAnnouncementModal({ mode: "edit", announcement: a, profileId, onSaved: () => render(profileId) }));
      delBtn.addEventListener("click", async () => {
        if (!confirm("Delete this announcement?")) return;
        const { error } = await supabase.from("announcements").delete().eq("id", a.id);
        if (error) {
          alert(error.message);
          return;
        }
        await render(profileId);
      });
      list.appendChild(card);
    }
  }

  addBtn.addEventListener("click", () => openAnnouncementModal({ mode: "create", announcement: null, profileId, onSaved: () => render(profileId) }));

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
