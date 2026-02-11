import { supabase } from "../core/core.js";
import { initAppShell } from "../core/shell.js";
import { initAdminPage } from "./admin-common.js";

initAppShell({ role: "admin", active: "calendar" });

// [Date Checked: 2026-02-11] | [Remarks: Added defensive code to prevent null reference errors when DOM elements are missing]
const calendarStatus = document.getElementById("calendarStatus") ?? document.createElement("div");
const calendarApp = document.getElementById("calendarApp") ?? document.getElementById("calendarGrid");
if (!document.getElementById("calendarStatus") && calendarApp?.parentElement) {
  calendarStatus.id = "calendarStatus";
  calendarStatus.className = "text-sm text-slate-600 mb-4";
  calendarApp.parentElement.insertBefore(calendarStatus, calendarApp);
}

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

function addDaysIso(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00`);
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function colorForType(type) {
  const t = String(type ?? "").toLowerCase();
  if (t === "holiday") return "#16a34a";
  if (t === "emergency") return "#dc2626";
  if (t === "shortened") return "#d97706";
  return "#7c3aed";
}

async function loadEvents() {
  const { data, error } = await supabase
    .from("school_calendar")
    .select("id,type,title,start_date,end_date,notes,grade_scope,created_at")
    .order("start_date", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

function openEventModal({ mode, event, profileId, onSaved }) {
  const content = el("div", "");
  content.appendChild(
    el("div", "text-lg font-semibold text-slate-900", mode === "create" ? "Add calendar event" : "Edit calendar event")
  );

  const form = el("form", "mt-4 grid gap-4 md:grid-cols-2");
  const type = selectInput(
    [
      { value: "holiday", label: "Holiday" },
      { value: "emergency", label: "Emergency Suspension" },
      { value: "shortened", label: "Shortened Period" },
    ],
    event?.type ?? "holiday"
  );
  const title = textInput({ value: event?.title ?? "", placeholder: "Title" });
  const startDate = textInput({ type: "date", value: event?.start_date ?? "" });
  const endDate = textInput({ type: "date", value: event?.end_date ?? "" });
  const gradeScope = textInput({ value: event?.grade_scope ?? "all", placeholder: "all or specific grade" });
  const notes = textArea({ value: event?.notes ?? "", placeholder: "Notes (optional)" });

  const announce = checkbox("Announce this event", false);
  const audTeachers = checkbox("Teachers", true);
  const audParents = checkbox("Parents", true);
  const audStaff = checkbox("Staff", true);

  const row = (label, inputEl, span2 = false) => {
    const w = el("div", span2 ? "space-y-1 md:col-span-2" : "space-y-1");
    w.appendChild(el("label", "block text-sm font-medium text-slate-700", escapeHtml(label)));
    w.appendChild(inputEl);
    return w;
  };

  form.appendChild(row("Type", type));
  form.appendChild(row("Title", title));
  form.appendChild(row("Start date", startDate));
  form.appendChild(row("End date", endDate));
  form.appendChild(row("Grade scope", gradeScope, true));
  form.appendChild(row("Notes", notes, true));

  const announceBox = el("div", "md:col-span-2 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200");
  announceBox.appendChild(el("div", "text-sm font-semibold text-slate-900", "Announcement"));
  announceBox.appendChild(el("div", "mt-1 text-sm text-slate-600", "Optional: create an announcement when saving this event."));
  const line = el("div", "mt-3 flex flex-wrap gap-4");
  line.appendChild(announce.wrap);
  announceBox.appendChild(line);
  const audLine = el("div", "mt-3 flex flex-wrap gap-4");
  audLine.appendChild(audTeachers.wrap);
  audLine.appendChild(audParents.wrap);
  audLine.appendChild(audStaff.wrap);
  announceBox.appendChild(audLine);
  form.appendChild(announceBox);

  function setAudienceEnabled(enabled) {
    audTeachers.input.disabled = !enabled;
    audParents.input.disabled = !enabled;
    audStaff.input.disabled = !enabled;
    audLine.className = enabled ? "mt-3 flex flex-wrap gap-4" : "mt-3 flex flex-wrap gap-4 opacity-50 pointer-events-none";
  }
  setAudienceEnabled(announce.input.checked);
  announce.input.addEventListener("change", () => setAudienceEnabled(announce.input.checked));

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

  if (mode === "edit") {
    const delBtn = button("Delete", "secondary");
    delBtn.className = "rounded-xl border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50";
    delBtn.addEventListener("click", async () => {
      if (!confirm("Delete this event?")) return;
      delBtn.disabled = true;
      const { error } = await supabase.from("school_calendar").delete().eq("id", event.id);
      if (error) {
        errorBox.textContent = error.message;
        errorBox.classList.remove("hidden");
        delBtn.disabled = false;
        return;
      }
      overlay.remove();
      await onSaved();
    });
    actions.insertBefore(delBtn, cancelBtn);
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorBox.classList.add("hidden");
    saveBtn.disabled = true;

    const payload = {
      type: type.value,
      title: title.value.trim(),
      start_date: startDate.value,
      end_date: endDate.value || startDate.value,
      grade_scope: gradeScope.value.trim() || "all",
      notes: notes.value.trim() || null,
      created_by: profileId,
    };

    if (!payload.title || !payload.start_date) {
      errorBox.textContent = "Title and start date are required.";
      errorBox.classList.remove("hidden");
      saveBtn.disabled = false;
      return;
    }

    const res =
      mode === "create"
        ? await supabase.from("school_calendar").insert(payload)
        : await supabase.from("school_calendar").update(payload).eq("id", event.id);

    if (res.error) {
      errorBox.textContent = res.error.message;
      errorBox.classList.remove("hidden");
      saveBtn.disabled = false;
      return;
    }

    if (announce.input.checked) {
      const dateRange =
        payload.end_date && payload.end_date !== payload.start_date
          ? `${payload.start_date} to ${payload.end_date}`
          : payload.start_date;
      const bodyText = `${payload.type.toUpperCase()} • ${dateRange}\nScope: ${payload.grade_scope}\n\n${payload.notes || ""}`.trim();
      const { error: annErr } = await supabase.from("announcements").insert({
        title: payload.title,
        body: bodyText,
        audience_teachers: audTeachers.input.checked,
        audience_parents: audParents.input.checked,
        audience_staff: audStaff.input.checked,
        created_by: profileId,
      });
      if (annErr) {
        errorBox.textContent = annErr.message;
        errorBox.classList.remove("hidden");
        saveBtn.disabled = false;
        return;
      }
    }

    overlay.remove();
    await onSaved();
  });

  content.appendChild(form);
  content.appendChild(errorBox);
  content.appendChild(actions);
}

function buildCalendarEvents(rows) {
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    start: r.start_date,
    end: addDaysIso(r.end_date || r.start_date, 1),
    allDay: true,
    backgroundColor: colorForType(r.type),
    borderColor: colorForType(r.type),
    extendedProps: { raw: r },
  }));
}

async function render(profileId) {
  calendarStatus.textContent = "Loading…";
  calendarApp.replaceChildren();

  const toolbar = el("div", "flex flex-col gap-2 md:flex-row md:items-center md:justify-between");
  toolbar.appendChild(
    el(
      "div",
      "text-sm text-slate-600",
      "Tip: click a date to add an event; click an event to edit or delete."
    )
  );
  const addBtn = button("Add event", "primary");
  toolbar.appendChild(addBtn);

  const container = el("div", "mt-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200");
  const calendarEl = el("div", "");
  container.appendChild(calendarEl);

  calendarApp.appendChild(toolbar);
  calendarApp.appendChild(container);

  const rows = await loadEvents();

  const calendar = new window.FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    height: "auto",
    headerToolbar: { left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay" },
    events: buildCalendarEvents(rows),
    dateClick: (info) => {
      openEventModal({
        mode: "create",
        event: { type: "holiday", title: "", start_date: info.dateStr, end_date: info.dateStr, notes: "", grade_scope: "all" },
        profileId,
        onSaved: () => render(profileId),
      });
    },
    eventClick: (info) => {
      const raw = info.event.extendedProps?.raw;
      if (!raw) return;
      openEventModal({ mode: "edit", event: raw, profileId, onSaved: () => render(profileId) });
    },
  });

  calendar.render();
  addBtn.addEventListener("click", () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const iso = `${yyyy}-${mm}-${dd}`;
    openEventModal({
      mode: "create",
      event: { type: "holiday", title: "", start_date: iso, end_date: iso, notes: "", grade_scope: "all" },
      profileId,
      onSaved: () => render(profileId),
    });
  });

  calendarStatus.textContent = `Loaded ${rows.length} event(s).`;
}

async function init() {
  const { profile, error } = await initAdminPage();
  if (error) return;
  try {
    await render(profile.id);
  } catch (e) {
    calendarStatus.textContent = e?.message ?? "Failed to load calendar.";
  }
}

init();
