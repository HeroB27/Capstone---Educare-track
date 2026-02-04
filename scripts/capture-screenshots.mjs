import fs from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer";

const baseUrl = (process.env.BASE_URL || "http://localhost:5173").replace(/\/+$/, "");
const outDir = path.resolve(process.cwd(), "screenshots");

const adminUser = process.env.ADMIN_USER || "ADM-2026-0000-0001";
const adminPass = process.env.ADMIN_PASS || "Password123!";

async function ensureReady(page, selector) {
  await page.waitForFunction(
    (sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      const t = (el.innerText || "").toLowerCase();
      return t && !t.includes("loading");
    },
    { timeout: 60000 },
    selector
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function gotoAndShot(page, url, waitSelector, fileName) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  if (waitSelector) await ensureReady(page, waitSelector);
  await sleep(400);
  await page.screenshot({ path: path.join(outDir, fileName), fullPage: true });
}

async function run() {
  await fs.mkdir(outDir, { recursive: true });

  const browser = await puppeteer.launch({
    headless: "new",
    defaultViewport: { width: 1440, height: 900 },
  });

  const page = await browser.newPage();
  page.setDefaultTimeout(60000);

  await page.goto(`${baseUrl}/auth/login.html`, { waitUntil: "domcontentloaded" });
  await page.type("#userId", adminUser, { delay: 10 });
  await page.type("#password", adminPass, { delay: 10 });

  const startPath = new URL(page.url()).pathname;
  await page.click("#loginButton");
  await page.waitForFunction(
    (p) => {
      const err = document.querySelector("#errorBox");
      const hasError = err && !err.classList.contains("hidden") && (err.textContent || "").trim().length > 0;
      return hasError || window.location.pathname !== p;
    },
    { timeout: 60000 },
    startPath
  );

  const loginError = await page.evaluate(() => {
    const el = document.querySelector("#errorBox");
    if (!el) return "";
    if (el.classList.contains("hidden")) return "";
    return (el.textContent || "").trim();
  });
  if (loginError) {
    await page.screenshot({ path: path.join(outDir, "login-error.png"), fullPage: true });
    throw new Error(`Login failed: ${loginError}`);
  }

  await gotoAndShot(page, `${baseUrl}/admin/admin-dashboard.html`, "#statusBox", "dashboard.png");
  await gotoAndShot(page, `${baseUrl}/admin/admin-announcements.html`, "#announceStatus", "announcements.png");
  await gotoAndShot(page, `${baseUrl}/admin/admin-attendance.html`, "#attendanceStatus", "attendance.png");
  await gotoAndShot(page, `${baseUrl}/admin/admin-people.html`, "#peopleStatus", "people.png");
  await gotoAndShot(page, `${baseUrl}/admin/admin-settings.html`, "#settingsStatus", "settings.png");

  await browser.close();
  process.stdout.write(`Saved screenshots to ${outDir}\n`);
}

run().catch((e) => {
  process.stderr.write(`${e?.stack || e?.message || String(e)}\n`);
  process.exit(1);
});
