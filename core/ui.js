// Educare Track UI Module - Phase 7 Enhanced Version

// HTML escaping for XSS prevention
export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Element creation helper
export function el(tag, className, html) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
}

// Text input component
export function textInput({ value = "", placeholder = "", type = "text", disabled = false, required = false } = {}) {
  const i = document.createElement("input");
  i.type = type;
  i.value = value;
  i.placeholder = placeholder;
  i.disabled = disabled;
  i.required = required;
  i.className = "form-input w-full rounded-xl border-slate-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-blue-500";
  return i;
}

// Textarea component
export function textArea({ value = "", placeholder = "", rows = 3, disabled = false, required = false } = {}) {
  const t = document.createElement("textarea");
  t.value = value;
  t.placeholder = placeholder;
  t.rows = rows;
  t.disabled = disabled;
  t.required = required;
  t.className = "form-input w-full rounded-xl border-slate-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-blue-500 resize-none";
  return t;
}

// Select input component
export function selectInput(options, value) {
  const s = document.createElement("select");
  s.className = "form-input w-full rounded-xl border-slate-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-blue-500";
  for (const o of options) {
    const opt = document.createElement("option");
    opt.value = o.value;
    opt.textContent = o.label;
    if (o.value === value) opt.selected = true;
    s.appendChild(opt);
  }
  return s;
}

// Checkbox component
export function checkbox(label, checked = false, accentClass = "text-blue-600 focus:ring-blue-500") {
  const wrap = el("label", "inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer");
  const c = document.createElement("input");
  c.type = "checkbox";
  c.checked = checked;
  c.className = `h-4 w-4 rounded border-slate-300 ${accentClass}`;
  wrap.appendChild(c);
  wrap.appendChild(document.createTextNode(label));
  return { wrap, input: c };
}

// Button component with variants
export function button(label, variant = "primary", accent = "blue") {
  const b = document.createElement("button");
  b.type = "button";
  
  const variants = {
    primary: `btn btn-${accent}`,
    secondary: "btn btn-secondary",
    danger: "btn btn-danger",
    ghost: "btn btn-ghost",
    outline: "btn btn-outline"
  };
  
  b.className = variants[variant] || variants.primary;
  b.textContent = label;
  return b;
}

// Icon button component
export function iconButton(iconSvg, label, variant = "primary", accent = "blue", size = "md") {
  const sizes = { sm: "p-1.5", md: "p-2", lg: "p-2.5" };
  const b = document.createElement("button");
  b.type = "button";
  b.className = `btn-icon btn-${variant} btn-${accent} ${sizes[size] || sizes.md}`;
  b.innerHTML = iconSvg;
  b.title = label;
  b.setAttribute("aria-label", label);
  return b;
}

// Loading spinner component
export function spinner(size = "md", color = "blue") {
  const sizes = { sm: "h-4 w-4", md: "h-8 w-8", lg: "h-12 w-12" };
  const colors = { blue: "border-blue-600", green: "border-green-600", red: "border-red-600", white: "border-white" };
  
  const spinner = el("div", `animate-spin rounded-full border-2 border-slate-200 ${sizes[size] || sizes.md} ${colors[color] || colors.blue}`);
  spinner.style.borderTopColor = "currentColor";
  return spinner;
}

// Skeleton loader component
export function skeletonLoader(lines = 3, width = "full") {
  const container = el("div", "animate-pulse space-y-3");
  
  for (let i = 0; i < lines; i++) {
    const line = el("div", "h-4 rounded bg-slate-200");
    if (width === "full") {
      line.style.width = "100%";
    } else if (width === "half") {
      line.style.width = "50%";
    } else if (typeof width === "string") {
      line.style.width = width;
    }
    container.appendChild(line);
  }
  
  return container;
}

// Card skeleton
export function cardSkeleton(title = true, content = true, image = false) {
  const card = el("div", "rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200");
  
  if (title) {
    const titleSkeleton = el("div", "h-5 w-3/4 rounded bg-slate-200 mb-3");
    card.appendChild(titleSkeleton);
  }
  
  if (content) {
    const contentSkeleton = el("div", "space-y-2");
    contentSkeleton.appendChild(el("div", "h-3 w-full rounded bg-slate-200"));
    contentSkeleton.appendChild(el("div", "h-3 w-5/6 rounded bg-slate-200"));
    contentSkeleton.appendChild(el("div", "h-3 w-4/6 rounded bg-slate-200"));
    card.appendChild(contentSkeleton);
  }
  
  return card;
}

// Toast notification system
const toastContainer = document.createElement("div");
toastContainer.id = "toast-container";
toastContainer.className = "fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none";
document.body.appendChild(toastContainer);

export function showToast(message, type = "info", duration = 4000) {
  const toast = el("div", "toast toast-" + type);
  toast.setAttribute("role", "alert");
  toast.setAttribute("aria-live", "polite");
  
  const icons = {
    success: `<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`,
    error: `<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>`,
    warning: `<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`,
    info: `<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`
  };
  
  toast.innerHTML = `
    <div class="flex items-center gap-3">
      <span class="flex-shrink-0">${icons[type] || icons.info}</span>
      <span class="text-sm font-medium">${escapeHtml(message)}</span>
      <button class="toast-close flex-shrink-0 ml-2" aria-label="Close">
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
      </button>
    </div>
  `;
  
  toastContainer.appendChild(toast);
  
  // Add close handler
  toast.querySelector(".toast-close").addEventListener("click", () => {
    toast.remove();
  });
  
  // Auto remove
  if (duration > 0) {
    setTimeout(() => {
      toast.classList.add("toast-exit");
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
  
  return toast;
}

// Convenience methods
export function showSuccess(message, duration) { return showToast(message, "success", duration); }
export function showError(message, duration) { return showToast(message, "error", duration); }
export function showWarning(message, duration) { return showToast(message, "warning", duration); }
export function showInfo(message, duration) { return showToast(message, "info", duration); }

// Modal component
export function openModal(contentEl, { maxWidthClass = "max-w-3xl", closeOnOverlay = true } = {}) {
  const overlay = el("div", "modal-overlay fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4");
  const card = el("div", `modal-card bg-white rounded-2xl shadow-xl max-h-[90vh] overflow-auto ${maxWidthClass || ""}`.trim());
  card.appendChild(contentEl);
  overlay.appendChild(card);
  
  if (closeOnOverlay) {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }
  
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay && closeOnOverlay) overlay.remove();
  });
  
  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden";
  
  const onKeyDown = (e) => {
    if (e.key === "Escape") {
      overlay.remove();
    }
  };
  window.addEventListener("keydown", onKeyDown);
  
  const origRemove = overlay.remove.bind(overlay);
  overlay.remove = () => {
    try {
      window.removeEventListener("keydown", onKeyDown);
    } catch (e) {}
    document.body.style.overflow = "";
    origRemove();
  };
  
  return overlay;
}

// Close modal helper
export function closeModal(overlay) {
  if (overlay) overlay.remove();
}

// Alert dialog
export function openAlert({ title, message, okText = "OK", onOk = null }) {
  const content = el("div", "p-4");
  content.appendChild(el("div", "text-lg font-semibold text-slate-900", escapeHtml(title)));
  if (message) {
    content.appendChild(el("div", "mt-2 text-sm text-slate-600", escapeHtml(message)));
  }
  const actions = el("div", "mt-4 flex justify-end");
  const okBtn = button(okText, "primary", "blue");
  okBtn.addEventListener("click", () => {
    if (onOk) onOk();
    overlay.remove();
  });
  actions.appendChild(okBtn);
  content.appendChild(actions);
  
  const overlay = openModal(content);
  return { overlay, close: () => overlay.remove() };
}

// Confirm dialog
export function openConfirm({ title, message, confirmText = "Confirm", cancelText = "Cancel", onConfirm = null, onCancel = null, danger = false }) {
  const content = el("div", "p-4");
  content.appendChild(el("div", "text-lg font-semibold text-slate-900", escapeHtml(title)));
  if (message) {
    content.appendChild(el("div", "mt-2 text-sm text-slate-600", escapeHtml(message)));
  }
  const actions = el("div", "mt-4 flex justify-end gap-2");
  const cancelBtn = button(cancelText, "ghost");
  const confirmBtn = button(confirmText, danger ? "danger" : "primary", danger ? "red" : "blue");
  
  cancelBtn.addEventListener("click", () => {
    if (onCancel) onCancel();
    overlay.remove();
  });
  
  confirmBtn.addEventListener("click", () => {
    if (onConfirm) onConfirm();
    overlay.remove();
  });
  
  actions.appendChild(cancelBtn);
  actions.appendChild(confirmBtn);
  content.appendChild(actions);
  
  const overlay = openModal(content);
  return { overlay, close: () => overlay.remove() };
}

// Date formatting
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

export function formatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatRelativeTime(value) {
  if (!value) return "";
  const date = new Date(value);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} days ago`;
  
  return formatLocalDateTime(value);
}

// Status badge helper
export function statusBadge(status, type = "default") {
  const statuses = {
    present: { class: "bg-green-100 text-green-700", label: "Present" },
    late: { class: "bg-yellow-100 text-yellow-800", label: "Late" },
    absent: { class: "bg-red-100 text-red-700", label: "Absent" },
    excused_absent: { class: "bg-slate-200 text-slate-700", label: "Excused" },
    partial: { class: "bg-amber-100 text-amber-800", label: "Partial" },
    unmarked: { class: "bg-slate-100 text-slate-700", label: "Unmarked" },
    in: { class: "bg-blue-100 text-blue-700", label: "In" },
    out: { class: "bg-slate-100 text-slate-700", label: "Out" },
    pending: { class: "bg-yellow-100 text-yellow-800", label: "Pending" },
    approved: { class: "bg-green-100 text-green-700", label: "Approved" },
    rejected: { class: "bg-red-100 text-red-700", label: "Rejected" },
    in_clinic: { class: "bg-purple-100 text-purple-700", label: "In Clinic" }
  };
  
  const s = statuses[status?.toLowerCase()] || { class: "bg-slate-100 text-slate-700", label: status || "Unknown" };
  
  const badge = el("span", `inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${s.class}`);
  badge.textContent = s.label || escapeHtml(status);
  return badge;
}

// Avatar component
export function avatar(name, size = "md") {
  const sizes = { sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm", lg: "h-12 w-12 text-base", xl: "h-16 w-16 text-lg" };
  const colors = [
    "bg-blue-500", "bg-green-500", "bg-yellow-500", "bg-red-500",
    "bg-purple-500", "bg-pink-500", "bg-indigo-500", "bg-teal-500"
  ];
  
  const initials = name
    ?.split(" ")
    .map(n => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";
  
  const colorIndex = (name || "").split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
  
  const avatar = el("span", `inline-flex items-center justify-center rounded-full text-white font-medium ${sizes[size] || sizes.md} ${colors[colorIndex]}`);
  avatar.textContent = initials;
  avatar.title = name;
  
  return avatar;
}

// Empty state component
export function emptyState({ icon, title, message, action = null }) {
  const container = el("div", "flex flex-col items-center justify-center py-12 px-4 text-center");
  
  if (icon) {
    const iconEl = el("div", "mx-auto h-12 w-12 text-slate-400");
    iconEl.innerHTML = icon;
    container.appendChild(iconEl);
  }
  
  container.appendChild(el("h3", "mt-4 text-lg font-semibold text-slate-900", escapeHtml(title)));
  container.appendChild(el("p", "mt-2 text-sm text-slate-600 max-w-sm", escapeHtml(message)));
  
  if (action) {
    container.appendChild(el("div", "mt-6", action));
  }
  
  return container;
}

// Loading overlay
export function loadingOverlay(message = "Loading...") {
  const overlay = el("div", "fixed inset-0 bg-white/80 z-50 flex flex-col items-center justify-center");
  overlay.appendChild(spinner("lg", "blue"));
  overlay.appendChild(el("div", "mt-4 text-sm font-medium text-slate-600", escapeHtml(message)));
  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden";
  
  return {
    remove: () => {
      document.body.style.overflow = "";
      overlay.remove();
    },
    update: (msg) => {
      overlay.lastChild.textContent = msg;
    }
  };
}

// Progress bar
export function progressBar({ value = 0, max = 100, showLabel = true, size = "md", color = "blue" }) {
  const sizes = { sm: "h-1", md: "h-2", lg: "h-3" };
  const colors = { blue: "bg-blue-600", green: "bg-green-600", red: "bg-red-600", yellow: "bg-yellow-500" };
  
  const container = el("div", "w-full");
  const track = el("div", `w-full rounded-full bg-slate-200 ${sizes[size] || sizes.md}`);
  const fill = el("div", `rounded-full transition-all duration-300 ${colors[color] || colors.blue}`);
  
  const percent = Math.min(100, Math.max(0, (value / max) * 100));
  fill.style.width = `${percent}%`;
  
  track.appendChild(fill);
  container.appendChild(track);
  
  if (showLabel) {
    container.appendChild(el("div", "mt-1 text-xs text-right text-slate-600", `${Math.round(percent)}%`));
  }
  
  return container;
}

// Optimistic update helper
export function createOptimisticUpdate({ onUpdate, onError, onComplete }) {
  let inProgress = false;
  
  const update = async (optimisticValue, asyncFn) => {
    if (inProgress) return;
    inProgress = true;
    
    // Apply optimistic update
    if (onUpdate) onUpdate(optimisticValue);
    
    try {
      const result = await asyncFn();
      if (onComplete) onComplete(result);
      return { success: true, data: result };
    } catch (error) {
      // Rollback optimistic update
      if (onError) onError(error);
      return { success: false, error };
    } finally {
      inProgress = false;
    }
  };
  
  return { update, isUpdating: () => inProgress };
}

// Debounce helper
export function debounce(fn, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

// Throttle helper
export function throttle(fn, limit) {
  let inThrottle;
  return (...args) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// Generate unique ID
export function generateId(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Deep clone helper
export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// Export all utilities
export default {
  escapeHtml,
  el,
  textInput,
  textArea,
  selectInput,
  checkbox,
  button,
  iconButton,
  spinner,
  skeletonLoader,
  cardSkeleton,
  showToast,
  showSuccess,
  showError,
  showWarning,
  showInfo,
  openModal,
  closeModal,
  openAlert,
  openConfirm,
  formatLocalDateTime,
  isoDate,
  formatTime,
  formatRelativeTime,
  statusBadge,
  avatar,
  emptyState,
  loadingOverlay,
  progressBar,
  createOptimisticUpdate,
  debounce,
  throttle,
  generateId,
  deepClone
};
