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

const NAV_ITEMS = {
  admin: [
    { key: "dashboard", label: "Dashboard", href: "./admin-dashboard.html", icon: "grid" },
    { key: "people", label: "People", href: "./admin-people.html", icon: "users" },
    { key: "academics", label: "Academics", href: "./admin-classes.html", icon: "book" },
    { key: "attendance", label: "Attendance", href: "./admin-attendance.html", icon: "calendar" },
    { key: "idcards", label: "ID Cards", href: "./admin-idcards.html", icon: "credit-card" },
    { key: "communications", label: "Communications", href: "./admin-communications.html", icon: "message-circle" },
    { key: "settings", label: "Settings", href: "./admin-settings.html", icon: "settings" },
  ],
  teacher: [
    { key: "dashboard", label: "Dashboard", href: "./teacher-dashboard.html", icon: "grid" },
    { key: "subject-attendance", label: "Subject Attendance", href: "./teacher-subject-attendance.html", icon: "check-circle" },
    { key: "excuse", label: "Excuse Letters", href: "./teacher-excuse.html", icon: "file-text" },
    { key: "announcements", label: "Announcements", href: "./teacher-announcements.html", icon: "bell" },
    { key: "gatekeeper-scanner", label: "Gatekeeper Scanner", href: "./teacher-gatekeeper-scanner.html", icon: "scan" },
  ],
  parent: [
    { key: "dashboard", label: "Dashboard", href: "./parent-dashboard.html", icon: "grid" },
    { key: "excuse-upload", label: "Excuse Upload", href: "./parent-excuse-upload.html", icon: "upload" },
  ],
  guard: [
    { key: "dashboard", label: "Gatekeeper", href: "./guard-dashboard.html", icon: "shield" },
    { key: "scanner", label: "Scanner", href: "./guard-scanner.html", icon: "scan" },
  ],
  clinic: [
    { key: "dashboard", label: "Dashboard", href: "./clinic-dashboard.html", icon: "activity" },
    { key: "pass-approval", label: "Pass Approval", href: "./clinic-pass-approval.html", icon: "check-square" },
    { key: "scanner", label: "Scanner", href: "./clinic-scanner.html", icon: "scan" },
  ],
};

// Simple Feather Icons mapping
const ICONS = {
  grid: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>`,
  users: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`,
  book: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>`,
  calendar: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`,
  "credit-card": `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>`,
  "message-circle": `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>`,
  settings: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`,
  "check-circle": `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`,
  "file-text": `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`,
  bell: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>`,
  scan: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"></path><path d="M17 3h2a2 2 0 0 1 2 2v2"></path><path d="M21 17v2a2 2 0 0 1-2 2h-2"></path><path d="M7 21H5a2 2 0 0 1-2-2v-2"></path></svg>`,
  upload: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>`,
  shield: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`,
  activity: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>`,
  "check-square": `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>`,
};

function safeRole(role) {
  const value = String(role ?? "").toLowerCase();
  if (value in ROLE_LABEL) return value;
  return "admin";
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
      const activeStyle = isActive 
        ? `background: rgba(255, 255, 255, 0.15); border-left: 3px solid white; color: white;` 
        : `color: rgba(255, 255, 255, 0.7); border-left: 3px solid transparent;`;
      
      return `
        <a href="${item.href}" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; border-radius: 0.5rem; text-decoration: none; transition: all 0.2s; font-weight: 500; font-size: 0.9rem; ${activeStyle}">
          ${ICONS[item.icon] || ""}
          <span>${item.label}</span>
        </a>
      `;
    })
    .join("<div style='height: 0.25rem'></div>");

  sidebar.style.background = `var(--theme-sidebar)`;
  sidebar.innerHTML = `
    <div class="sidebar-header" style="padding: 1.5rem; display: flex; align-items: center; gap: 0.75rem;">
      <div style="width: 2.5rem; height: 2.5rem; border-radius: 0.75rem; background: white; color: var(--theme-primary); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.25rem;">
        E
      </div>
      <div>
        <div style="font-family: var(--font-display); font-weight: 700; font-size: 1.1rem; letter-spacing: -0.02em;">Educare</div>
        <div style="font-size: 0.75rem; opacity: 0.7; font-weight: 500;">Track Platform</div>
      </div>
    </div>
    
    <nav style="flex: 1; padding: 0 0.75rem; overflow-y: auto;">
      ${navHtml}
    </nav>
    
    <div style="padding: 1rem;">
      <div id="profileBadge" class="hidden" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; background: rgba(0, 0, 0, 0.2); border-radius: 0.75rem; backdrop-filter: blur(10px);">
        <div style="width: 2rem; height: 2rem; border-radius: 999px; background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 0.85rem;">
          ${(ROLE_LABEL[role] || "U").charAt(0)}
        </div>
        <div style="flex: 1; min-width: 0;">
          <div id="sidebarUserName" style="font-size: 0.85rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">User</div>
          <div style="font-size: 0.7rem; opacity: 0.7;">${ROLE_LABEL[role]}</div>
        </div>
        <button id="signOutBtn" style="background: none; border: none; color: rgba(255,255,255,0.7); cursor: pointer; padding: 0.25rem;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
        </button>
      </div>
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

  topbar.className = "topbar glass-header";
  topbar.innerHTML = `
    <div class="topbar-inner">
      <div class="topbar-title">
        <button id="sidebarToggleBtn" class="btn btn-secondary lg:hidden" style="padding:0.5rem 0.75rem;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
        </button>
        <div class="lg:hidden" style="font-family: var(--font-display); font-weight: 700; color: var(--neutral-900);">Educare Track</div>
      </div>
      <div class="topbar-actions">
        <a id="notifBtn" class="btn btn-ghost" href="${notifHref}" style="position:relative; border-radius: 999px; width: 2.5rem; height: 2.5rem; padding: 0; display: flex; align-items: center; justify-content: center;" aria-label="Notifications">
          ${ICONS.bell}
          <span id="notifCount" style="display:none;position:absolute;top:0;right:0;width:0.75rem;height:0.75rem;border-radius:999px;background:var(--danger-500);border:2px solid white;"></span>
        </a>
      </div>
    </div>
  `;

  const sidebarSignOutBtn = el("signOutBtn");
  if (sidebarSignOutBtn) {
    // Already wired in renderSidebar HTML if exists, but we might need extra logic if we had a separate topbar signout
  }
}

export function setShellProfile({ fullName, role } = {}) {
  const name = String(fullName ?? "").trim();
  const roleLabel = ROLE_LABEL[String(role ?? "").toLowerCase()] ?? String(role ?? "").toUpperCase();

  const sidebarName = el("sidebarUserName");
  if (sidebarName && name) sidebarName.textContent = name;

  const badge = el("profileBadge");
  if (badge && name && roleLabel) {
    badge.classList.remove("hidden");
  }
}

export function setShellNotificationsCount(count) {
  const n = Number(count);
  const elCount = el("notifCount");
  if (!elCount) return;
  if (!Number.isFinite(n) || n <= 0) {
    elCount.style.display = "none";
    return;
  }
  elCount.style.display = "block";
}

function setRoleClass(role) {
  const body = document.body;
  if (!body) return;

  // Remove existing role classes
  body.className = body.className.replace(/role-\w+/g, "").trim();
  
  const roleClass = `role-${role}`;
  body.classList.add(roleClass);
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
  
  // Add connectivity listeners
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
};
