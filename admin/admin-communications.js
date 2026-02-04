import { initAppShell } from "../core/shell.js";
import { initAdminPage } from "./admin-common.js";

initAppShell({ role: "admin", active: "communications" });

const commStatus = document.getElementById("commStatus");

async function init() {
  const { error } = await initAdminPage();
  if (error) return;
  commStatus.textContent = "Ready.";
}

init();

