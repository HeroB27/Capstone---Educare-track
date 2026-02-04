import { supabase } from "../core/core.js";
import { button, checkbox, el, escapeHtml, formatLocalDateTime, selectInput, textArea, textInput } from "../core/ui.js";
import { initAppShell } from "../core/shell.js";
import { initTeacherPage } from "./teacher-common.js";
import { registerPwa } from "../core/pwa.js";

initAppShell({ role: "teacher", active: "announcements" });

const announceStatus = document.getElementById("announceStatus");
const announceApp = document.getElementById("announceApp");
const announceFormBox = document.getElementById("announceFormBox");

function uniq(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function toClassLabel(c) {
  return `${c.grade_level}${c.strand ? ` • ${c.strand}` : ""}${c.room ? ` • ${c.room}` : ""}`;
}

async function loadTeacherClasses(profileId) {
  const { data: homeroom, error: homeroomErr } = await supabase
    .from("classes")
    .select("id,grade_level,strand,room")
    .eq("homeroom_teacher_id", profileId)
    .eq("is_active", true);
  if (homeroomErr) throw homeroomErr;

  const { data: schedules, error: schedErr } = await supabase
    .from("class_schedules")
    .select("class_id,classes(id,grade_level,strand,room)")
    .eq("teacher_id", profileId);
  if (schedErr) throw schedErr;

  const map = new Map();
  for (const c of homeroom ?? []) map.set(c.id, c);
  for (const s of schedules ?? []) {
    if (s.classes?.id) map.set(s.classes.id, s.classes);
  }
  return Array.from(map.values()).sort((a, b) => String(a.grade_level).localeCompare(String(b.grade_level)));
}

async function loadMyAnnouncements(profileId) {
  const { data, error } = await supabase
    .from("announcements")
    .select("id,title,body,class_id,created_by,created_at")
    .eq("created_by", profileId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

async function loadParentsForClass(classId) {
  const { data, error } = await supabase.from("students").select("parent_id").eq("class_id", classId);
  if (error) throw error;
  return uniq((data ?? []).map((r) => r.parent_id)).filter(Boolean);
}

async function sendNotifications({ teacherId, parentIds, announcementId, classId, title }) {
  if (!parentIds.length) return;
  const rows = parentIds.map((pid) => ({
    recipient_id: pid,
    actor_id: teacherId,
    verb: "announcement",
    object: { announcement_id: announcementId, class_id: classId, title },
    read: false,
  }));
  const { error } = await supabase.from("notifications").insert(rows);
  if (error) throw error;
}

function renderCreateForm({ teacherId, classes, onCreated }) {
  announceFormBox.replaceChildren();

  const form = el("form", "space-y-4");
  const title = textInput({ placeholder: "Title" });
  const body = textArea({ placeholder: "Body", rows: 6 });
  const classSel = selectInput([{ value: "", label: "Select class…" }].concat(classes.map((c) => ({ value: c.id, label: toClassLabel(c) }))), "");
  const notify = checkbox("Notify parents", true, "text-blue-600 focus:ring-blue-500");

  const row = (label, inputEl) => {
    const w = el("div", "space-y-1");
    w.appendChild(el("label", "block text-sm font-medium text-slate-700", escapeHtml(label)));
    w.appendChild(inputEl);
    return w;
  };

  form.appendChild(row("Class", classSel));
  form.appendChild(row("Title", title));
  form.appendChild(row("Body", body));

  const notifBox = el("div", "rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200");
  notifBox.appendChild(el("div", "text-sm font-semibold text-slate-900", "Delivery"));
  notifBox.appendChild(el("div", "mt-1 text-sm text-slate-600", "Creates a notification for each parent with a child in the selected class."));
  notifBox.appendChild(el("div", "mt-3"));
  notifBox.lastChild.appendChild(notify.wrap);
  form.appendChild(notifBox);

  const errorBox = el("div", "hidden rounded-xl bg-red-50 p-3 text-sm text-red-700");
  const actions = el("div", "flex justify-end");
  const submit = button("Post", "primary", "blue");
  submit.type = "submit";
  actions.appendChild(submit);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorBox.classList.add("hidden");
    submit.disabled = true;

    if (!classSel.value) {
      errorBox.textContent = "Class is required.";
      errorBox.classList.remove("hidden");
      submit.disabled = false;
      return;
    }
    if (!title.value.trim() || !body.value.trim()) {
      errorBox.textContent = "Title and body are required.";
      errorBox.classList.remove("hidden");
      submit.disabled = false;
      return;
    }

    try {
      const { data, error } = await supabase
        .from("announcements")
        .insert({
          title: title.value.trim(),
          body: body.value.trim(),
          audience_teachers: false,
          audience_parents: true,
          audience_staff: false,
          created_by: teacherId,
          class_id: classSel.value,
        })
        .select("id")
        .limit(1);
      if (error) throw error;

      const announcementId = data?.[0]?.id;
      if (!announcementId) throw new Error("Announcement created but id not returned.");

      if (notify.input.checked) {
        const parents = await loadParentsForClass(classSel.value);
        await sendNotifications({
          teacherId,
          parentIds: parents,
          announcementId,
          classId: classSel.value,
          title: title.value.trim(),
        });
      }

      title.value = "";
      body.value = "";
      classSel.value = "";

      await onCreated();
    } catch (err) {
      errorBox.textContent = err?.message ?? "Failed to post announcement.";
      errorBox.classList.remove("hidden");
    } finally {
      submit.disabled = false;
    }
  });

  announceFormBox.appendChild(form);
  announceFormBox.appendChild(errorBox);
}

function renderList(items, classesById, profileId) {
  announceApp.replaceChildren();

  const list = el("div", "space-y-3");
  if (!items.length) {
    list.appendChild(el("div", "text-sm text-slate-600", "No announcements posted yet."));
    announceApp.appendChild(list);
    return;
  }

  for (const a of items) {
    const c = a.class_id ? classesById.get(a.class_id) : null;
    const meta = `${formatLocalDateTime(a.created_at)}${c ? ` • ${toClassLabel(c)}` : ""}`;
    const card = el("div", "rounded-2xl bg-slate-50 p-4");
    card.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="text-sm font-semibold text-slate-900">${escapeHtml(a.title)}</div>
          <div class="mt-1 text-xs text-slate-600">${escapeHtml(meta)}</div>
        </div>
        <div class="flex gap-2">
          <button class="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white">Delete</button>
        </div>
      </div>
      <div class="mt-3 whitespace-pre-wrap text-sm text-slate-700">${escapeHtml(a.body)}</div>
    `;
    const delBtn = card.querySelector("button");
    delBtn.addEventListener("click", async () => {
      if (!confirm("Delete this announcement?")) return;
      delBtn.disabled = true;
      const { error } = await supabase.from("announcements").delete().eq("id", a.id).eq("created_by", profileId);
      if (error) {
        alert(error.message);
        delBtn.disabled = false;
        return;
      }
      await refresh(profileId);
    });
    list.appendChild(card);
  }

  announceApp.appendChild(list);
}

let pageProfile = null;
let channels = [];

function cleanup() {
  for (const ch of channels) supabase.removeChannel(ch);
  channels = [];
}

async function refresh(profileId) {
  announceStatus.textContent = "Loading…";
  const classes = await loadTeacherClasses(profileId);
  const items = await loadMyAnnouncements(profileId);
  const byId = new Map(classes.map((c) => [c.id, c]));

  renderCreateForm({ teacherId: profileId, classes, onCreated: () => refresh(profileId) });
  renderList(items, byId, profileId);

  announceStatus.textContent = `Loaded ${items.length} announcement(s).`;

  cleanup();
  const ch = supabase
    .channel(`teacher-announce-${profileId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "announcements", filter: `created_by=eq.${profileId}` },
      async () => {
        await refresh(profileId);
      }
    )
    .subscribe();
  channels.push(ch);
}

async function init() {
  registerPwa();
  const { profile, error } = await initTeacherPage();
  if (error) return;
  pageProfile = profile;

  try {
    await refresh(profile.id);
  } catch (e) {
    announceStatus.textContent = e?.message ?? "Failed to load announcements.";
  }

  window.addEventListener("beforeunload", cleanup);
}

init();
