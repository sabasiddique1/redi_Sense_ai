/**
 * Pure geometry helpers for the chart kit. No DOM, no React, fully unit-tested.
 * All functions take explicit pixel sizes so components can reserve height.
 */

export type Point = { x: number; y: number };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function extent(values: number[]): { min: number; max: number } {
  if (values.length === 0) return { min: 0, max: 1 };
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (min === max) {
    // flat series: give it a band so the line sits mid-height
    return { min: min - 1, max: max + 1 };
  }
  return { min, max };
}

/** Map a series onto a width × height box with vertical padding, x evenly spaced. */
export function scalePoints(
  values: number[],
  width: number,
  height: number,
  options: { pad?: number; min?: number; max?: number } = {},
): Point[] {
  const pad = options.pad ?? 2;
  const { min, max } = { ...extent(values), ...stripUndefined(options) };
  const span = max - min || 1;
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  return values.map((v, i) => ({
    x: values.length > 1 ? i * step : width / 2,
    y: pad + (height - pad * 2) * (1 - (v - min) / span),
  }));
}

function stripUndefined(o: { min?: number; max?: number }) {
  const out: { min?: number; max?: number } = {};
  if (o.min !== undefined) out.min = o.min;
  if (o.max !== undefined) out.max = o.max;
  return out;
}

const fmt = (n: number) => Number(n.toFixed(2)).toString();

export function polylinePoints(points: Point[]): string {
  return points.map((p) => `${fmt(p.x)},${fmt(p.y)}`).join(" ");
}

/** Closed area under a line, down to the baseline (height). */
export function areaPath(points: Point[], height: number): string {
  if (points.length === 0) return "";
  const first = points[0];
  const last = points[points.length - 1];
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${fmt(p.x)},${fmt(p.y)}`).join(" ");
  return `${line} L${fmt(last.x)},${fmt(height)} L${fmt(first.x)},${fmt(height)} Z`;
}

/** Orthogonal step path: hold the previous value until the next x. */
export function stepPath(points: Point[]): string {
  if (points.length === 0) return "";
  let d = `M${fmt(points[0].x)},${fmt(points[0].y)}`;
  for (let i = 1; i < points.length; i += 1) {
    d += ` L${fmt(points[i].x)},${fmt(points[i - 1].y)} L${fmt(points[i].x)},${fmt(points[i].y)}`;
  }
  return d;
}

/** Circular arc path from startAngle to endAngle in degrees (0 = 12 o'clock, clockwise). */
export function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const toXY = (angle: number) => {
    const rad = ((angle - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };
  const start = toXY(startAngle);
  const end = toXY(endAngle);
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return `M${fmt(start.x)},${fmt(start.y)} A${fmt(r)},${fmt(r)} 0 ${large} 1 ${fmt(end.x)},${fmt(end.y)}`;
}

export type DonutSegment<T> = T & { dasharray: string; dashoffset: number; percent: number };

/** Stroke-dasharray/offset per segment for a ring of the given radius. Zero totals yield a single empty ring. */
export function donutSegments<T extends { value: number }>(segments: T[], radius: number): DonutSegment<T>[] {
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0);
  let consumed = 0;
  return segments.map((segment) => {
    const fraction = total > 0 ? Math.max(0, segment.value) / total : 0;
    const length = circumference * fraction;
    const item = {
      ...segment,
      percent: Math.round(fraction * 100),
      dasharray: `${fmt(length)} ${fmt(circumference - length)}`,
      dashoffset: consumed === 0 ? 0 : -consumed,
    };
    consumed += length;
    return item;
  });
}

/** Needle angle for a semicircle gauge with `bands` equal bands (0 = left, 180 = right). */
export function gaugeAngle(index: number, bands: number): number {
  const width = 180 / bands;
  return clamp(index, 0, bands - 1) * width + width / 2;
}

/** Quantise a value into `steps` buckets (0..steps-1) relative to `max`. */
export function quantize(value: number, max: number, steps: number): number {
  if (max <= 0 || value <= 0) return 0;
  return clamp(Math.ceil((value / max) * steps) - 1, 0, steps - 1);
}

/** Percentage widths for a stacked bar; guarantees they sum to 100 when total > 0. */
export function stackedWidths(values: number[]): number[] {
  const total = values.reduce((s, v) => s + Math.max(0, v), 0);
  if (total <= 0) return values.map(() => 0);
  const raw = values.map((v) => (Math.max(0, v) / total) * 100);
  const floored = raw.map(Math.floor);
  let remainder = 100 - floored.reduce((s, v) => s + v, 0);
  const order = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  for (const { i } of order) {
    if (remainder <= 0) break;
    floored[i] += 1;
    remainder -= 1;
  }
  return floored;
}

/** Ring arc length values for a 0–100 percentage on a circle of radius r. */
export function ringDash(percent: number | null, radius: number): { dasharray: string; circumference: number } {
  const circumference = 2 * Math.PI * radius;
  const p = percent == null ? 0 : clamp(percent, 0, 100) / 100;
  return { dasharray: `${fmt(circumference * p)} ${fmt(circumference * (1 - p))}`, circumference };
}
