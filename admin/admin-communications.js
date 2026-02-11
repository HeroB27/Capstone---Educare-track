import { initAppShell } from "../core/shell.js";
import { initAdminPage } from "./admin-common.js";

initAppShell({ role: "admin", active: "communications" });

// [Date Checked: 2026-02-11] | [Remarks: Added defensive code to prevent null reference errors when DOM elements are missing]
const commStatus = document.getElementById("commStatus") ?? document.createElement("div");
const commApp = document.getElementById("communicationsApp");
if (!document.getElementById("commStatus") && commApp?.parentElement) {
  commStatus.id = "commStatus";
  commStatus.className = "text-sm text-slate-600 mb-4";
  commApp.parentElement.insertBefore(commStatus, commApp);
}

async function init() {
  const { error } = await initAdminPage();
  if (error) return;
  commStatus.textContent = "Ready.";
}

init();
