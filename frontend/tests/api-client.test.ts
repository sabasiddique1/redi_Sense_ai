import test from "node:test";
import assert from "node:assert/strict";

import { withDemoFallback } from "../lib/api.ts";


test("connected mode does not silently fall back to demo data on failure", async () => {
  await assert.rejects(
    () =>
      withDemoFallback(
        async () => {
          throw new Error("service unavailable");
        },
        {
          demoMode: false,
          fallback: () => ({ value: "demo" }),
          fallbackMessage: "demo fallback",
        },
      ),
    /service unavailable/,
  );
});

test("explicit demo mode returns demo content with demo mode metadata", async () => {
  const result = await withDemoFallback(
    async () => ({ value: "connected" }),
    {
      demoMode: true,
      fallback: () => ({ value: "demo" }),
      fallbackMessage: "demo fallback",
    },
  );

  assert.equal(result.mode, "demo");
  assert.equal(result.source, "demo");
  assert.equal(result.data.value, "demo");
  assert.equal(result.warning, "demo fallback");
});

test("structured API error modes remain truthful in connected mode", async () => {
  const result = await withDemoFallback(
    async () =>
      ({
        mode: "error",
        error_message: "Evidence index is unavailable.",
      }) as {
        mode: "error";
        error_message: string;
      },
    {
      demoMode: false,
      fallback: () =>
        ({
          mode: "error",
          error_message: "demo should not be used here",
        }) as {
          mode: "error";
          error_message: string;
        },
    },
  );

  assert.equal(result.mode, "error");
  assert.equal(result.source, "api");
  assert.equal(result.data.error_message, "Evidence index is unavailable.");
});
