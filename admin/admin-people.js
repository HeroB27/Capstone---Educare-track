import { initAppShell } from "../core/shell.js";
import { initAdminPage } from "./admin-common.js";

initAppShell({ role: "admin", active: "people" });

const peopleStatus = document.getElementById("peopleStatus");

async function init() {
  const { error } = await initAdminPage();
  if (error) return;
  peopleStatus.textContent = "Ready.";
}

init();

