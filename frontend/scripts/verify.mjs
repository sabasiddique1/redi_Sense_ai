// Phase 3 verification: screenshots (both themes, both modes, 1440 + 1024),
// axe-core scans, hydration/console checks, interaction latency, keyboard
// order, reduced-motion. Drives the production build with playwright-core on
// the installed Google Chrome. Usage: node scripts/verify.mjs <baseUrl> <outDir>
import { chromium } from "playwright-core";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

const base = process.argv[2] ?? "http://localhost:3001";
const out = process.argv[3] ?? "verify-out";
mkdirSync(out, { recursive: true });

const PAGES = [
  { slug: "dashboard", path: "/" },
  { slug: "report-analyzer", path: "/report-analyzer" },
  { slug: "symptom-triage", path: "/symptom-triage" },
  { slug: "patient-profile", path: "/patient-profile" },
  { slug: "timeline", path: "/timeline" },
  { slug: "knowledge-center", path: "/knowledge-center?query=pulmonary%20nodule" },
  { slug: "settings", path: "/settings" },
];
const THEMES = ["light", "dark"];
const MODES = [false, true]; // demo mode?
const VIEWPORTS = [
  { name: "1440", width: 1440, height: 900 },
  { name: "1024", width: 1024, height: 768 },
];

const browser = await chromium.launch({ channel: "chrome", headless: true });
const report = { axe: [], console: [], interactions: [], keyboard: [], reducedMotion: [], flash: [] };

async function newPage(theme, demo, viewport) {
  const context = await browser.newContext({ viewport, colorScheme: "light" });
  await context.addInitScript(({ theme, demo }) => {
    localStorage.setItem("redisense-theme", theme);
    localStorage.setItem("redisense-demo-mode", String(demo));
    localStorage.setItem("redisense-selected-patient", "1");
  }, { theme, demo });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") errors.push(`${msg.type()}: ${msg.text().slice(0, 200)}`);
  });
  page.on("pageerror", (err) => errors.push(`pageerror: ${String(err).slice(0, 200)}`));
  return { context, page, errors };
}

for (const viewport of VIEWPORTS) {
  for (const theme of THEMES) {
    for (const demo of MODES) {
      for (const { slug, path } of PAGES) {
        const { context, page, errors } = await newPage(theme, demo, viewport);
        await page.goto(base + path, { waitUntil: "networkidle" });
        await page.waitForTimeout(800);
        const label = `${slug}-${theme}-${demo ? "demo" : "connected"}-${viewport.name}`;
        await page.screenshot({ path: join(out, `${label}.png`), fullPage: true });

        // theme applied before hydration: the attribute must match the stored preference
        const attr = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
        if (attr !== theme) report.flash.push({ label, expected: theme, got: attr });

        const hydration = errors.filter((e) => /hydrat|did not match|Warning:/i.test(e) && !/ERR_CONNECTION/.test(e));
        const other = errors.filter((e) => !/ERR_CONNECTION|Failed to load resource/.test(e));
        if (hydration.length || other.length) report.console.push({ label, hydration, other: other.slice(0, 3) });

        await page.addScriptTag({ content: axeSource });
        const axe = await page.evaluate(async () => {
          const results = await window.axe.run(document, { resultTypes: ["violations"] });
          return results.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help, targets: v.nodes.slice(0, 2).map((n) => n.target.join(" ")) }));
        });
        const serious = axe.filter((v) => v.impact === "serious" || v.impact === "critical");
        report.axe.push({ label, violations: axe.length, seriousOrCritical: serious.length, details: serious });
        await context.close();
      }
    }
  }
}

// Interaction latency: theme switch and table sort on the dashboard (demo, 1440)
{
  const { context, page } = await newPage("light", true, VIEWPORTS[0]);
  await page.goto(base + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const measure = async (name, action) => {
    const ms = await page.evaluate(async (actionSource) => {
      const start = performance.now();
      new Function(actionSource)();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      return performance.now() - start;
    }, action);
    report.interactions.push({ name, ms: +ms.toFixed(1) });
  };
  await measure("theme switch (button click → next paint)", `document.querySelector('button[aria-label^="Theme:"]').click()`);
  await measure("table sort (Risk header click → next paint)", `[...document.querySelectorAll('th button')].find(b => b.textContent.includes('Risk')).click()`);
  await measure("queue filter chip (High + Critical → next paint)", `[...document.querySelectorAll('button[aria-pressed]')][0].click()`);

  // Keyboard: tab order through sidebar + top bar + table rows, drawer trap and Escape
  await page.keyboard.press("Tab");
  const order = [];
  for (let i = 0; i < 24; i += 1) {
    order.push(await page.evaluate(() => {
      const el = document.activeElement;
      return `${el.tagName.toLowerCase()}${el.getAttribute("aria-label") ? `[${el.getAttribute("aria-label").slice(0, 28)}]` : ""}:${(el.textContent || "").trim().slice(0, 18)}`;
    }));
    await page.keyboard.press("Tab");
  }
  report.keyboard.push({ name: "first 24 tab stops", order });
  await page.click("[data-copilot-trigger]");
  await page.waitForTimeout(300);
  const inDrawer = [];
  for (let i = 0; i < 12; i += 1) {
    await page.keyboard.press("Tab");
    inDrawer.push(await page.evaluate(() => Boolean(document.querySelector('[role="dialog"]')?.contains(document.activeElement))));
  }
  const rowFocusable = await page.evaluate(() => [...document.querySelectorAll("tbody tr[tabindex='0']")].length);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  const closed = await page.evaluate(() => document.querySelector('[role="dialog"]')?.closest("[aria-hidden]")?.getAttribute("aria-hidden") === "true");
  report.keyboard.push({ name: "drawer trap", allTabsStayInside: inDrawer.every(Boolean), escapeCloses: closed, focusableTableRows: rowFocusable });
  await context.close();
}

// Reduced motion: chart transitions collapse to ~0
{
  const context = await browser.newContext({ viewport: VIEWPORTS[0], reducedMotion: "reduce" });
  await context.addInitScript(() => localStorage.setItem("redisense-demo-mode", "true"));
  const page = await context.newPage();
  await page.goto(base + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const durations = await page.evaluate(() =>
    [...document.querySelectorAll("svg circle, svg line, [class*='transition-']")].slice(0, 40).map((el) => getComputedStyle(el).transitionDuration).filter((d) => d && d !== "0s"),
  );
  report.reducedMotion.push({ nonZeroTransitionDurations: [...new Set(durations)] });
  await context.close();
}

await browser.close();
writeFileSync(join(out, "report.json"), JSON.stringify(report, null, 2));
const bad = report.axe.filter((a) => a.seriousOrCritical > 0);
console.log(`screenshots: ${PAGES.length * THEMES.length * MODES.length * VIEWPORTS.length}`);
console.log(`axe pages with serious/critical: ${bad.length}/${report.axe.length}`);
for (const b of bad) console.log("  ", b.label, JSON.stringify(b.details));
console.log("theme flash mismatches:", report.flash.length, JSON.stringify(report.flash));
console.log("console/hydration issues:", report.console.length, JSON.stringify(report.console.slice(0, 5)));
console.log("interactions:", JSON.stringify(report.interactions));
console.log("keyboard:", JSON.stringify(report.keyboard[1]));
console.log("tab order:", report.keyboard[0].order.join(" → "));
console.log("reduced motion:", JSON.stringify(report.reducedMotion));
