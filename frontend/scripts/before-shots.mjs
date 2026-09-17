import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
const base = process.argv[2]; const out = process.argv[3];
mkdirSync(out, { recursive: true });
const PAGES = [["dashboard", "/"], ["report-analyzer", "/report-analyzer"], ["symptom-triage", "/symptom-triage"], ["patient-profile", "/patient-profile"], ["timeline", "/timeline"], ["knowledge-center", "/knowledge-center?query=pulmonary%20nodule"], ["settings", "/settings"]];
const browser = await chromium.launch({ channel: "chrome", headless: true });
for (const [slug, path] of PAGES) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => { localStorage.setItem("redisense-demo-mode", "true"); localStorage.setItem("redisense-selected-patient", "1"); });
  const page = await context.newPage();
  await page.goto(base + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/${slug}.png`, fullPage: true });
  await context.close();
}
await browser.close();
console.log("before screenshots written");
