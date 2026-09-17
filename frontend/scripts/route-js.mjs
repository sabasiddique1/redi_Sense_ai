// Gzipped client JS actually loaded per route on a cold navigation.
// Usage: node scripts/route-js.mjs <baseUrl> [label]
import { chromium } from "playwright-core";
import { gzipSync } from "node:zlib";

const base = process.argv[2];
const label = process.argv[3] ?? base;
const ROUTES = ["/", "/report-analyzer", "/symptom-triage", "/patient-profile", "/timeline", "/knowledge-center", "/settings"];
const browser = await chromium.launch({ channel: "chrome", headless: true });
const rows = [];
for (const route of ROUTES) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const seen = new Map();
  page.on("response", async (response) => {
    const url = response.url();
    if (!/\.js(\?|$)/.test(url) || response.request().resourceType() !== "script") return;
    try {
      const body = await response.body();
      seen.set(url, gzipSync(body).length);
    } catch {
      // ignore
    }
  });
  await page.goto(base + route, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const total = [...seen.values()].reduce((s, v) => s + v, 0);
  rows.push({ route, scripts: seen.size, gzipKB: +(total / 1024).toFixed(1) });
  await context.close();
}
await browser.close();
console.log(JSON.stringify({ label, rows }));
