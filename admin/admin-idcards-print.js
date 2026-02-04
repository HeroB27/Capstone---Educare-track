import { supabase } from "../core/core.js";
import { initAdminPage } from "./admin-common.js";

const classSelect = document.getElementById("classSelect");
const loadBtn = document.getElementById("loadBtn");
const printBtn = document.getElementById("printBtn");
const statusBox = document.getElementById("statusBox");
const cardsGrid = document.getElementById("cardsGrid");

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

async function loadClasses() {
  const { data, error } = await supabase.from("classes").select("id,grade_level,strand,room").order("grade_level", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function loadStudentsWithIds({ classId }) {
  let query = supabase
    .from("student_ids")
    .select("id,qr_code,is_active,student:students(id,full_name,grade_level,class_id)")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (classId) {
    query = query.eq("student.class_id", classId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).filter((r) => r.student);
}

function renderCards(rows) {
  cardsGrid.replaceChildren();
  if (!rows.length) {
    cardsGrid.appendChild(el("div", "text-sm text-slate-600", "No student IDs found for this selection."));
    return;
  }

  for (const r of rows) {
    const card = el("div", "rounded-xl border border-slate-300 bg-white p-3 print:break-inside-avoid");
    const top = el(
      "div",
      "flex items-start justify-between gap-2",
      `<div><div class="text-sm font-semibold text-slate-900">${escapeHtml(r.student.full_name)}</div><div class="text-xs text-slate-600">${escapeHtml(r.student.grade_level ?? "")}</div></div><div class="text-xs font-semibold text-slate-700">EDUCARE</div>`
    );
    const qrWrap = el("div", "mt-3 flex items-center justify-center");
    const canvas = document.createElement("canvas");
    canvas.width = 120;
    canvas.height = 120;
    qrWrap.appendChild(canvas);
    const code = el("div", "mt-2 text-center text-[10px] text-slate-700", escapeHtml(r.qr_code));

    card.appendChild(top);
    card.appendChild(qrWrap);
    card.appendChild(code);
    cardsGrid.appendChild(card);

    window.QRCode.toCanvas(canvas, r.qr_code, { width: 120, margin: 1 }, () => {});
  }
}

function getClassIdFromQuery() {
  const url = new URL(window.location.href);
  const value = url.searchParams.get("class_id");
  return value && value.trim() ? value.trim() : "";
}

async function init() {
  const { error } = await initAdminPage();
  if (error) return;

  const classes = await loadClasses();
  classSelect.replaceChildren();
  classSelect.appendChild(new Option("All classes", ""));
  for (const c of classes) {
    const label = `${c.grade_level}${c.strand ? ` • ${c.strand}` : ""}${c.room ? ` • ${c.room}` : ""}`;
    classSelect.appendChild(new Option(label, c.id));
  }

  const initialClassId = getClassIdFromQuery();
  if (initialClassId) classSelect.value = initialClassId;

  async function load() {
    statusBox.textContent = "Loading…";
    const rows = await loadStudentsWithIds({ classId: classSelect.value });
    renderCards(rows);
    statusBox.textContent = `Loaded ${rows.length} cards.`;
  }

  loadBtn.addEventListener("click", load);
  printBtn.addEventListener("click", () => window.print());

  await load();
}

init().catch((e) => {
  statusBox.textContent = e?.message ?? "Failed to load.";
});

