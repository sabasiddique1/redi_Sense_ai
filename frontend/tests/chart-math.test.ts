import test from "node:test";
import assert from "node:assert/strict";

import {
  arcPath,
  areaPath,
  donutSegments,
  extent,
  gaugeAngle,
  polylinePoints,
  quantize,
  ringDash,
  scalePoints,
  stackedWidths,
  stepPath,
} from "../components/charts/math.ts";

test("scalePoints maps a series into the box with padding and even x spacing", () => {
  const pts = scalePoints([0, 5, 10], 100, 30, { pad: 2 });
  assert.deepEqual(pts.map((p) => p.x), [0, 50, 100]);
  assert.equal(pts[0].y, 28);
  assert.equal(pts[2].y, 2);
  assert.equal(pts[1].y, 15);
});

test("flat series get a band so the line sits mid-height", () => {
  assert.deepEqual(extent([4, 4, 4]), { min: 3, max: 5 });
  const pts = scalePoints([4, 4], 10, 20, { pad: 0 });
  assert.equal(pts[0].y, 10);
});

test("polyline, area and step paths are well formed", () => {
  const pts = [{ x: 0, y: 10 }, { x: 10, y: 0 }];
  assert.equal(polylinePoints(pts), "0,10 10,0");
  assert.equal(areaPath(pts, 20), "M0,10 L10,0 L10,20 L0,20 Z");
  assert.equal(stepPath(pts), "M0,10 L10,10 L10,0");
  assert.equal(areaPath([], 20), "");
});

test("donut segments partition the circumference and report rounded percents", () => {
  const segs = donutSegments([{ value: 3 }, { value: 1 }], 10);
  const c = 2 * Math.PI * 10;
  assert.equal(segs[0].percent, 75);
  assert.equal(segs[1].percent, 25);
  assert.equal(segs[0].dashoffset, 0);
  assert.ok(Math.abs(segs[1].dashoffset + c * 0.75) < 0.05);
  assert.deepEqual(donutSegments([{ value: 0 }], 10)[0].percent, 0);
});

test("stacked widths always sum to 100 for a non-empty total", () => {
  assert.deepEqual(stackedWidths([1, 1, 1]), [34, 33, 33]);
  assert.deepEqual(stackedWidths([0, 0]), [0, 0]);
  assert.equal(stackedWidths([52, 28, 13, 7]).reduce((s, v) => s + v, 0), 100);
});

test("gauge angle lands in the middle of each band", () => {
  assert.equal(gaugeAngle(0, 4), 22.5);
  assert.equal(gaugeAngle(3, 4), 157.5);
  assert.equal(gaugeAngle(9, 4), 157.5);
});

test("quantize buckets values into steps and ring dash clamps percentages", () => {
  assert.equal(quantize(0, 10, 5), 0);
  assert.equal(quantize(10, 10, 5), 4);
  assert.equal(quantize(3, 10, 5), 1);
  const full = ringDash(150, 10);
  assert.ok(full.dasharray.startsWith(full.circumference.toFixed(2).replace(/\.?0+$/, "")));
  assert.equal(ringDash(null, 10).dasharray.startsWith("0 "), true);
});

test("arc path uses the large-arc flag past 180 degrees", () => {
  assert.match(arcPath(50, 50, 40, 0, 90), / 0 0 1 /);
  assert.match(arcPath(50, 50, 40, 0, 270), / 0 1 1 /);
});
