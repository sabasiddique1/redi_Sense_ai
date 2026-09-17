import test from "node:test";
import assert from "node:assert/strict";

import { THEME_INIT_SCRIPT, resolveTheme } from "../lib/theme.ts";

test("theme resolution follows the preference and the system query", () => {
  assert.equal(resolveTheme("light", true), "light");
  assert.equal(resolveTheme("dark", false), "dark");
  assert.equal(resolveTheme("system", true), "dark");
  assert.equal(resolveTheme("system", false), "light");
});

test("inline init script sets data-theme before hydration without depending on React", () => {
  assert.match(THEME_INIT_SCRIPT, /localStorage\.getItem\("redisense-theme"\)/);
  assert.match(THEME_INIT_SCRIPT, /setAttribute\("data-theme",r\)/);
  assert.match(THEME_INIT_SCRIPT, /prefers-color-scheme: dark/);
  assert.doesNotMatch(THEME_INIT_SCRIPT, /import|require|React/);
});
