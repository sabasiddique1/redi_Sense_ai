// Reads --rs-* tokens from app/globals.css for both themes, resolves var()
// references, converts hex / rgba / oklch to sRGB, composites translucent
// tints over their surface, and prints WCAG contrast for every text-on-surface
// pair the UI relies on. Exits 1 if any required pair is below 4.5:1.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, "..", "app", "globals.css"), "utf8");

function block(selector) {
  const start = css.indexOf(selector + " {");
  const end = css.indexOf("\n}", start);
  const body = css.slice(start, end);
  const tokens = {};
  for (const m of body.matchAll(/(--rs-[a-z0-9-]+):\s*([^;]+);/g)) tokens[m[1]] = m[2].trim();
  return tokens;
}
const light = block(":root");
const dark = { ...light, ...block('[data-theme="dark"]') };

function resolve(tokens, value, depth = 0) {
  if (depth > 8) throw new Error("var loop: " + value);
  const m = value.match(/^var\((--[a-z0-9-]+)\)$/);
  return m ? resolve(tokens, tokens[m[1]], depth + 1) : value;
}

// --- colour parsing -> {r,g,b,a} in 0..1 linear-light-free sRGB ---
function parse(value) {
  value = value.trim();
  let m;
  if ((m = value.match(/^#([0-9a-f]{6})$/i))) {
    const n = parseInt(m[1], 16);
    return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255, a: 1 };
  }
  if ((m = value.match(/^rgba?\(([^)]+)\)$/))) {
    const [r, g, b, a = "1"] = m[1].split(",").map((s) => s.trim());
    return { r: +r / 255, g: +g / 255, b: +b / 255, a: +a };
  }
  if ((m = value.match(/^oklch\(([^)]+)\)$/))) {
    const [main, alpha] = m[1].split("/");
    const [L, C, H] = main.trim().split(/\s+/);
    return { ...oklchToSrgb(parseFloat(L) / (L.endsWith("%") ? 100 : 1), parseFloat(C), parseFloat(H)), a: alpha ? parseFloat(alpha) : 1 };
  }
  throw new Error("unparsed colour: " + value);
}

function oklchToSrgb(L, C, h) {
  const hr = (h * Math.PI) / 180;
  const a = C * Math.cos(hr), b = C * Math.sin(hr);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  const lr = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  const gamma = (c) => {
    const v = Math.min(1, Math.max(0, c));
    return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
  };
  return { r: gamma(lr), g: gamma(lg), b: gamma(lb) };
}

const over = (fg, bg) => ({
  r: fg.r * fg.a + bg.r * (1 - fg.a),
  g: fg.g * fg.a + bg.g * (1 - fg.a),
  b: fg.b * fg.a + bg.b * (1 - fg.a),
  a: 1,
});
const lum = ({ r, g, b }) => {
  const f = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (fg, bg) => {
  const [hi, lo] = [lum(fg), lum(bg)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const hex = ({ r, g, b }) => "#" + [r, g, b].map((c) => Math.round(c * 255).toString(16).padStart(2, "0")).join("");

// [label, foreground token, background token, optional underlying surface for translucent bg, minimum]
const PAIRS = [
  ["severity-low chip", "--rs-severity-low", "--rs-severity-low-bg", "--rs-surface", 4.5],
  ["severity-moderate chip", "--rs-severity-moderate", "--rs-severity-moderate-bg", "--rs-surface", 4.5],
  ["severity-high chip", "--rs-severity-high", "--rs-severity-high-bg", "--rs-surface", 4.5],
  ["severity-critical chip", "--rs-severity-critical", "--rs-severity-critical-bg", "--rs-surface", 4.5],
  ["severity-low on surface", "--rs-severity-low", "--rs-surface", null, 4.5],
  ["severity-moderate on surface", "--rs-severity-moderate", "--rs-surface", null, 4.5],
  ["severity-high on surface", "--rs-severity-high", "--rs-surface", null, 4.5],
  ["severity-critical on surface", "--rs-severity-critical", "--rs-surface", null, 4.5],
  ["ink-on-accent on severity-low fill", "--rs-ink-on-accent", "--rs-severity-low", null, 4.5],
  ["ink-on-accent on severity-critical fill", "--rs-ink-on-accent", "--rs-severity-critical", null, 4.5],
  ["ink-900 on surface", "--rs-ink-900", "--rs-surface", null, 4.5],
  ["ink-900 on bg-shell", "--rs-ink-900", "--rs-bg-shell", null, 4.5],
  ["ink-700 on surface", "--rs-ink-700", "--rs-surface", null, 4.5],
  ["ink-500 on surface", "--rs-ink-500", "--rs-surface", null, 4.5],
  ["ink-500 on surface-sunken", "--rs-ink-500", "--rs-surface-sunken", null, 4.5],
  ["ink-400 on surface (captions)", "--rs-ink-400", "--rs-surface", null, 4.5],
  ["ink-400 on surface-sunken", "--rs-ink-400", "--rs-surface-sunken", null, 4.5],
  ["ink-on-accent on accent-700 (solid buttons)", "--rs-ink-on-accent", "--rs-accent-700", null, 4.5],
  ["ink-on-accent on accent-600 (design, informational)", "--rs-ink-on-accent", "--rs-accent-600", null, 0],
  ["accent-700 on surface (links, active nav)", "--rs-accent-700", "--rs-surface", null, 4.5],
  ["accent-700 on accent-050 (active nav)", "--rs-accent-700", "--rs-accent-050", "--rs-surface", 4.5],
  ["ink-300 on surface (decorative only)", "--rs-ink-300", "--rs-surface", null, 0],
];

let failed = false;
const rows = [];
for (const [themeName, tokens] of [["light", light], ["dark", dark]]) {
  for (const [label, fgTok, bgTok, underTok, min] of PAIRS) {
    const fg = parse(resolve(tokens, tokens[fgTok]));
    let bg = parse(resolve(tokens, tokens[bgTok]));
    if (underTok) bg = over(bg, parse(resolve(tokens, tokens[underTok])));
    else if (bg.a < 1) bg = over(bg, parse(resolve(tokens, tokens["--rs-surface"])));
    const fgFlat = fg.a < 1 ? over(fg, bg) : fg;
    const r = ratio(fgFlat, bg);
    const ok = min === 0 ? "n/a" : r >= min ? "pass" : "FAIL";
    if (ok === "FAIL") failed = true;
    rows.push({ theme: themeName, pair: label, fg: hex(fgFlat), bg: hex(bg), ratio: r.toFixed(2), result: ok });
  }
}
const pad = (s, n) => String(s).padEnd(n);
console.log(pad("theme", 6), pad("pair", 44), pad("fg", 8), pad("bg", 8), pad("ratio", 6), "result");
for (const r of rows) console.log(pad(r.theme, 6), pad(r.pair, 44), pad(r.fg, 8), pad(r.bg, 8), pad(r.ratio, 6), r.result);
if (failed) {
  console.error("\nContrast check failed: at least one required pair is below 4.5:1.");
  process.exit(1);
}
console.log("\nAll required pairs meet 4.5:1 in both themes.");
