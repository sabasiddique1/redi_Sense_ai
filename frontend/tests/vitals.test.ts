import test from "node:test";
import assert from "node:assert/strict";

import { assessVitals } from "../features/symptom-triage/vitals.ts";

test("vitals get reference-range annotations", () => {
  const [bp, hr, temp, spo2] = assessVitals({ systolicBp: "152", diastolicBp: "96", heartRate: "104", temperatureC: "37.1", spo2: "94" });
  assert.equal(bp.value, "152 / 96");
  assert.equal(bp.status, "above");
  assert.equal(hr.status, "above");
  assert.equal(temp.note, "normal");
  assert.equal(spo2.status, "low-normal");
});

test("empty vitals stay unannotated and low values read as below range", () => {
  const readings = assessVitals({ systolicBp: "", diastolicBp: "", heartRate: "", temperatureC: "", spo2: "" });
  assert.ok(readings.every((r) => r.value === "" && r.status === null));
  const [, hr, , spo2] = assessVitals({ systolicBp: "", diastolicBp: "", heartRate: "45", temperatureC: "", spo2: "90" });
  assert.equal(hr.note, "below range");
  assert.equal(spo2.note, "low");
});
