import { supabase } from "../core/core.js";
import { initAdminPage } from "./admin-common.js";

// [Date Checked: 2026-02-11] | [Remarks: Added defensive code to prevent null reference errors when DOM elements are missing]
const classSelect = document.getElementById("classSelect") ?? document.createElement("select");
const loadBtn = document.getElementById("loadBtn") ?? document.createElement("button");
const printBtn = document.getElementById("printBtn") ?? document.createElement("button");
const statusBox = document.getElementById("statusBox") ?? document.createElement("div");
const cardsGrid = document.getElementById("cardsGrid") ?? document.createElement("div");
if (!document.getElementById("statusBox") && cardsGrid?.parentElement) {
  statusBox.id = "statusBox";
  statusBox.className = "text-sm text-slate-600 mb-4 p-4";
  cardsGrid.parentElement.insertBefore(statusBox, cardsGrid);
}
// Initialize fallback elements if original elements don't exist
if (!document.getElementById("classSelect")) {
  classSelect.id = "classSelect";
  classSelect.className = "rounded-xl border border-slate-300 px-3 py-2 text-sm";
}
if (!document.getElementById("loadBtn")) {
  loadBtn.id = "loadBtn";
  loadBtn.type = "button";
  loadBtn.className = "rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700";
  loadBtn.textContent = "Load";
}
if (!document.getElementById("printBtn")) {
  printBtn.id = "printBtn";
  printBtn.type = "button";
  printBtn.className = "rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700";
  printBtn.textContent = "Print";
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

async function loadClasses() {
  const { data, error } = await supabase.from("classes").select("id,grade_level,strand,room").order("grade_level", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function loadStudentsWithIds({ classId }) {
  let query = supabase
    .from("student_ids")
    .select(`
      id,
      qr_code,
      is_active,
      student:students(
        id,
        full_name,
        lrn,
        grade_level,
        strand,
        class_id,
        address,
        photo_path,
        parent_id,
        parent:profiles!students_parent_id_fkey(full_name, phone)
      )
    `)
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
  // [Date Checked: 2026-02-11] | [Remarks: Enhanced ID card print layout with student photo, address, parent info, student ID, and lost return note]
  cardsGrid.replaceChildren();
  if (!rows.length) {
    cardsGrid.appendChild(el("div", "text-sm text-slate-600", "No student IDs found for this selection."));
    return;
  }

  for (const r of rows) {
    const card = el("div", "rounded-xl border border-slate-300 bg-white p-3 print:break-inside-avoid");
    
    // Header with photo and student info
    const header = el("div", "flex items-start justify-between gap-2");
    
    // Student photo (if available)
    const photoContainer = el("div", "w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center overflow-hidden");
    if (r.student.photo_path) {
      const photoUrl = supabase.storage.from("student-photos").getPublicUrl(r.student.photo_path).data.publicUrl;
      photoContainer.innerHTML = `<img src="${photoUrl}" alt="Student Photo" class="w-full h-full object-cover" onerror="this.style.display='none'">`;
    } else {
      photoContainer.innerHTML = '<div class="text-2xl text-slate-400">👤</div>';
    }
    
    // Student info
    const studentInfo = el("div", "flex-1");
    studentInfo.innerHTML = `
      <div class="text-sm font-semibold text-slate-900 leading-tight">${escapeHtml(r.student.full_name)}</div>
      <div class="text-[10px] text-slate-600">ID: ${escapeHtml(r.student.lrn || "N/A")}</div>
      <div class="text-[10px] text-slate-600">${escapeHtml(r.student.grade_level || "")}${r.student.strand ? ` • ${escapeHtml(r.student.strand)}` : ""}</div>
    `;
    
    // School logo
    const schoolLogo = el("div", "text-xs font-semibold text-slate-700", "EDUCARE");
    
    header.appendChild(photoContainer);
    header.appendChild(studentInfo);
    header.appendChild(schoolLogo);
    
    // Contact information
    const contactInfo = el("div", "mt-2 text-[9px] text-slate-700 leading-tight");
    contactInfo.innerHTML = `
      <div>${escapeHtml(r.student.address || "Address not provided")}</div>
      ${r.student.parent ? `<div>Parent: ${escapeHtml(r.student.parent.full_name || "N/A")}</div>` : ""}
      ${r.student.parent?.phone ? `<div>Phone: ${escapeHtml(r.student.parent.phone)}</div>` : ""}
    `;
    
    // QR code section
    const qrWrap = el("div", "mt-2 flex flex-col items-center");
    const canvas = document.createElement("canvas");
    canvas.width = 100;
    canvas.height = 100;
    const code = el("div", "mt-1 text-center text-[8px] text-slate-700 font-mono", escapeHtml(r.qr_code));
    
    qrWrap.appendChild(canvas);
    qrWrap.appendChild(code);
    
    // Lost and found notice
    const notice = el("div", "mt-2 text-center text-[6px] text-slate-500 border-t border-slate-200 pt-1", 
      "If found, please return to EDUCARE COLLEGES INC. Reward may be offered."
    );
    
    card.appendChild(header);
    card.appendChild(contactInfo);
    card.appendChild(qrWrap);
    card.appendChild(notice);
    cardsGrid.appendChild(card);

    window.QRCode.toCanvas(canvas, r.qr_code, { width: 100, margin: 0 }, () => {});
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

