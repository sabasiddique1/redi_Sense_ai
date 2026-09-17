import { chromium } from "playwright-core";
const [base, out] = process.argv.slice(2);
const browser = await chromium.launch({ channel: "chrome", headless: true });
for (const theme of ["dark", "light"]) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript((t) => { localStorage.setItem("redisense-theme", t); localStorage.setItem("redisense-demo-mode", "true"); localStorage.setItem("redisense-selected-patient", "1"); }, theme);
  const page = await context.newPage();
  await page.goto(base + "/knowledge-center?query=pulmonary%20nodule", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Ask Copilot about this" }).first().click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Send" }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/copilot-${theme}.png` });
  await context.close();
}
await browser.close();
console.log("copilot shots done");
