// Educare Track App Shell - Phase 7 Enhanced Version
import { addConnectivityListeners } from "./pwa.js";
import { showToast } from "./ui.js";

const ROLE_LABEL = {
  admin: "Admin",
  teacher: "Teacher",
  parent: "Parent",
  guard: "Guard",
  clinic: "Clinic",
};

const ROLE_COLOR_VAR = {
  admin: "--admin-color",
  teacher: "--teacher-color",
  parent: "--parent-color",
  guard: "--guard-color",
  clinic: "--clinic-color",
};

const NAV_ITEMS = {
  admin: [
    { key: "dashboard", label: "Dashboard", href: "./admin-dashboard.html" },
    { key: "people", label: "People", href: "./admin-people.html" },
    { key: "academics", label: "Academics", href: "./admin-classes.html" },
    { key: "attendance", label: "Attendance", href: "./admin-attendance.html" },
    { key: "communications", label: "Communications", href: "./admin-communications.html" },
    { key: "settings", label: "Settings", href: "./admin-settings.html" },
  ],
  teacher: [
    { key: "dashboard", label: "Dashboard", href: "./teacher-dashboard.html" },
    { key: "subject-attendance", label: "Subject Attendance", href: "./teacher-subject-attendance.html" },
    { key: "excuse", label: "Excuse Letters", href: "./teacher-excuse.html" },
    { key: "announcements", label: "Announcements", href: "./teacher-announcements.html" },
    { key: "gatekeeper-scanner", label: "Gatekeeper Scanner", href: "./teacher-gatekeeper-scanner.html" },
  ],
  parent: [
    { key: "dashboard", label: "Dashboard", href: "./parent-dashboard.html" },
    { key: "excuse-upload", label: "Excuse Upload", href: "./parent-excuse-upload.html" },
  ],
  guard: [
    { key: "dashboard", label: "Gatekeeper", href: "./guard-dashboard.html" },
    { key: "scanner", label: "Scanner", href: "./guard-scanner.html" },
  ],
  clinic: [
    { key: "dashboard", label: "Dashboard", href: "./clinic-dashboard.html" },
    { key: "pass-approval", label: "Pass Approval", href: "./clinic-pass-approval.html" },
    { key: "scanner", label: "Scanner", href: "./clinic-scanner.html" },
  ],
};

function safeRole(role) {
  const value = String(role ?? "").toLowerCase();
  if (value in ROLE_LABEL) return value;
  return "admin";
}

function colorStyleForRole(role) {
  const colorVar = ROLE_COLOR_VAR[role] ?? "--primary-600";
  return `background: var(${colorVar});`;
}

function el(id) {
  return document.getElementById(id);
}

// Network status indicator
let networkStatusElement = null;

function createNetworkStatusIndicator() {
  const indicator = document.createElement("div");
  indicator.id = "network-status";
  indicator.className = "network-status";
  indicator.innerHTML = `
    <span class="network-status-dot"></span>
    <span class="network-status-text"></span>
  `;
  document.body.insertBefore(indicator, document.body.firstChild);
  networkStatusElement = indicator;
  return indicator;
}

function updateNetworkStatus(online) {
  const indicator = networkStatusElement || createNetworkStatusIndicator();
  const dot = indicator.querySelector(".network-status-dot");
  const text = indicator.querySelector(".network-status-text");
  
  if (online) {
    indicator.classList.remove("offline", "reconnecting");
    indicator.classList.add("online");
    dot.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
    text.textContent = "Online";
  } else {
    indicator.classList.remove("online", "reconnecting");
    indicator.classList.add("offline");
    dot.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.58 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>`;
    text.textContent = "Offline - Data will sync when connected";
  }
}

function renderSidebar({ role, activeKey }) {
  const sidebar = el("appSidebar");
  if (!sidebar) return;

  const items = NAV_ITEMS[role] ?? [];
  const navHtml = items
    .map((item) => {
      const isActive = item.key === activeKey;
      return `<a class="nav-item${isActive ? " active" : ""}" href="${item.href}">${item.label}</a>`;
    })
    .join("");

  sidebar.innerHTML = `
    <div class="sidebar-header">
      <div style="display:flex;align-items:center;gap:0.75rem;">
        <div style="width:0.5rem;height:2.25rem;border-radius:9999px;${colorStyleForRole(role)}"></div>
        <div>
          <div style="font-size:0.875rem;font-weight:700;color:white;">${ROLE_LABEL[role] ?? "User"}</div>
          <div style="font-size:0.75rem;color:rgba(255,255,255,0.7);">Educare Track</div>
        </div>
      </div>
    </div>
    <div style="padding: 1rem 1rem 0;">
      <div id="profileBadge" class="hidden" style="border-radius:0.75rem;background:rgba(255,255,255,0.1);padding:0.5rem 0.75rem;font-size:0.75rem;color:rgba(255,255,255,0.85);"></div>
    </div>
    <nav style="padding:0.5rem 0.5rem 1rem;font-size:0.875rem;">
      ${navHtml}
    </nav>
    <div style="border-top:1px solid rgba(255,255,255,0.1);padding:1rem;">
      <button id="signOutBtn" class="btn btn-secondary" style="width:100%;justify-content:center;">Sign out</button>
    </div>
  `;
}

function renderTopbar({ role }) {
  const topbar = el("topbar");
  if (!topbar) return;

  const notifHref = role === "admin"
    ? "/admin/admin-dashboard.html"
    : role === "teacher"
      ? "/teacher/teacher-dashboard.html"
      : role === "parent"
        ? "/parent/parent-dashboard.html"
        : role === "guard"
          ? "/guard/guard-dashboard.html"
          : "/clinic/clinic-dashboard.html";

  topbar.innerHTML = `
    <div class="topbar-inner">
      <div class="topbar-title">
        <button id="sidebarToggleBtn" class="btn btn-secondary" style="padding:0.5rem 0.75rem;">Menu</button>
        <div class="topbar-rolebar" style="${colorStyleForRole(role)}"></div>
        <div style="display:flex;flex-direction:column;line-height:1.1;">
          <div id="topbarUserName" style="font-size:0.875rem;font-weight:800;">${ROLE_LABEL[role] ?? "User"}</div>
          <div style="display:flex;align-items:center;gap:0.5rem;">
            <span id="topbarRoleBadge" style="display:inline-flex;align-items:center;gap:0.375rem;padding:0.2rem 0.55rem;border-radius:9999px;font-size:0.7rem;font-weight:800;background:rgba(15,23,42,0.06);color:var(--secondary-700);">
              ${ROLE_LABEL[role] ?? "User"}
            </span>
            <span style="font-size:0.75rem;color:var(--secondary-600);">Educare Track</span>
          </div>
        </div>
      </div>
      <div class="topbar-actions">
        <a id="notifBtn" class="btn btn-secondary" href="${notifHref}" style="position:relative;padding:0.5rem 0.75rem;" aria-label="Notifications" title="Notifications">
          🔔
          <span id="notifCount" style="display:none;position:absolute;top:-0.35rem;right:-0.35rem;min-width:1.2rem;height:1.2rem;padding:0 0.3rem;border-radius:9999px;background:var(${ROLE_COLOR_VAR[role] ?? "--primary-600"});color:white;font-size:0.7rem;font-weight:800;line-height:1.2rem;text-align:center;"></span>
        </a>
        <button id="topbarSignOutBtn" class="btn btn-secondary" style="padding:0.5rem 0.75rem;">Sign out</button>
      </div>
    </div>
  `;

  const topbarSignOutBtn = el("topbarSignOutBtn");
  const sidebarSignOutBtn = el("signOutBtn");
  if (topbarSignOutBtn && sidebarSignOutBtn) {
    topbarSignOutBtn.addEventListener("click", () => sidebarSignOutBtn.click());
  }
}

export function setShellProfile({ fullName, role } = {}) {
  const name = String(fullName ?? "").trim();
  const roleLabel = ROLE_LABEL[String(role ?? "").toLowerCase()] ?? String(role ?? "").toUpperCase();

  const topName = el("topbarUserName");
  const topRole = el("topbarRoleBadge");
  if (topName && name) topName.textContent = name;
  if (topRole && roleLabel) topRole.textContent = roleLabel;

  const badge = el("profileBadge");
  if (badge && name && roleLabel) {
    badge.textContent = `${name} • ${roleLabel}`;
    badge.classList.remove("hidden");
  }
}

export function setShellNotificationsCount(count) {
  const n = Number(count);
  const elCount = el("notifCount");
  if (!elCount) return;
  if (!Number.isFinite(n) || n <= 0) {
    elCount.style.display = "none";
    elCount.textContent = "";
    return;
  }
  elCount.textContent = n > 99 ? "99+" : String(n);
  elCount.style.display = "inline-block";
}

function setRoleClass(role) {
  const body = document.body;
  if (!body) return;

  const roleClass = `role-${role}`;
  if (!body.classList.contains(roleClass)) {
    body.classList.add(roleClass);
  }
}

function closeSidebar() {
  const sidebar = el("appSidebar");
  const overlay = el("sidebarOverlay");
  if (sidebar) sidebar.classList.remove("open");
  if (overlay) overlay.classList.remove("open");
}

function openSidebar() {
  const sidebar = el("appSidebar");
  const overlay = el("sidebarOverlay");
  if (sidebar) sidebar.classList.add("open");
  if (overlay) overlay.classList.add("open");
}

function wireMobileSidebar() {
  const toggle = el("sidebarToggleBtn");
  const overlay = el("sidebarOverlay");

  if (toggle) {
    toggle.addEventListener("click", () => {
      const sidebar = el("appSidebar");
      const isOpen = !!sidebar?.classList.contains("open");
      if (isOpen) closeSidebar();
      else openSidebar();
    });
  }

  if (overlay) {
    overlay.addEventListener("click", closeSidebar);
  }

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSidebar();
  });
}

export function initAppShell({ role, active } = {}) {
  const safe = safeRole(role);
  setRoleClass(safe);
  renderSidebar({ role: safe, activeKey: String(active ?? "") });
  renderTopbar({ role: safe });
  wireMobileSidebar();
  
  // Initialize network status indicator (prevent duplicates)
  const existingIndicator = document.getElementById("network-status");
  if (!existingIndicator) {
    createNetworkStatusIndicator();
    updateNetworkStatus(navigator.onLine);
  }
  
  // Add connectivity listeners (prevent duplicates)
  if (!window._shellCleanup) {
    const cleanupConnectivity = addConnectivityListeners(
      () => {
        updateNetworkStatus(true);
        showToast("Back online - syncing data", "success");
      },
      () => {
        updateNetworkStatus(false);
        showToast("You are offline - changes will be synced when connected", "warning");
      }
    );
    window._shellCleanup = cleanupConnectivity;
  }

  // Store cleanup function for page unload
  window._shellCleanupFn = () => {
    if (window._shellCleanup) {
      window._shellCleanup();
      window._shellCleanup = null;
    }
  };
}

export function updateNetworkStatusIndicator(online) {
  updateNetworkStatus(online);
}

export default {
  initAppShell,
  setShellProfile,
  setShellNotificationsCount,
  updateNetworkStatusIndicator,
};
