export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function el(tag, className, html) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
}

export function textInput({ value = "", placeholder = "", type = "text", disabled = false } = {}) {
  const i = document.createElement("input");
  i.type = type;
  i.value = value;
  i.placeholder = placeholder;
  i.disabled = disabled;
  i.className =
    "w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100";
  return i;
}

export function textArea({ value = "", placeholder = "", rows = 3 } = {}) {
  const t = document.createElement("textarea");
  t.value = value;
  t.placeholder = placeholder;
  t.rows = rows;
  t.className =
    "w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200";
  return t;
}

export function selectInput(options, value) {
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

export function checkbox(label, checked = false, accentClass = "text-blue-600 focus:ring-blue-500") {
  const wrap = el("label", "inline-flex items-center gap-2 text-sm text-slate-700");
  const c = document.createElement("input");
  c.type = "checkbox";
  c.checked = checked;
  c.className = `h-4 w-4 rounded border-slate-300 ${accentClass}`;
  wrap.appendChild(c);
  wrap.appendChild(document.createTextNode(label));
  return { wrap, input: c };
}

export function button(label, variant = "primary", accent = "violet") {
  const b = document.createElement("button");
  b.type = "button";
  const isPrimary = variant === "primary";
  const isGhost = variant === "ghost";
  if (isPrimary) {
    const map = {
      violet: "bg-violet-600 hover:bg-violet-700",
      blue: "bg-blue-600 hover:bg-blue-700",
      green: "bg-green-600 hover:bg-green-700",
      red: "bg-red-600 hover:bg-red-700",
      slate: "bg-slate-800 hover:bg-slate-900",
    };
    const cls = map[accent] ?? map.violet;
    b.className = `rounded-xl px-4 py-2 text-sm font-semibold text-white ${cls}`;
  } else if (isGhost) {
    b.className = "rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50";
  } else {
    b.className =
      "rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50";
  }
  b.textContent = label;
  return b;
}

export function openModal(contentEl, { maxWidthClass = "max-w-3xl" } = {}) {
  const overlay = el("div", "fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4");
  const card = el("div", `w-full ${maxWidthClass} rounded-2xl bg-white p-5 shadow-lg`);
  card.appendChild(contentEl);
  overlay.appendChild(card);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
  return overlay;
}

export function formatLocalDateTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleString();
}

export function isoDate(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

