import test from "node:test";
import assert from "node:assert/strict";

import { readStorageWithLegacyFallback } from "../lib/api.ts";

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    snapshot: () => Object.fromEntries(map),
  };
}

test("legacy reportiq-* key is read once, migrated, and removed", () => {
  const storage = memoryStorage({ "reportiq-auth-token": "abc" });

  const value = readStorageWithLegacyFallback(storage, "redisense-auth-token", "reportiq-auth-token");

  assert.equal(value, "abc");
  assert.deepEqual(storage.snapshot(), { "redisense-auth-token": "abc" });
});

test("current key wins over legacy key and legacy is left untouched", () => {
  const storage = memoryStorage({
    "redisense-demo-mode": "false",
    "reportiq-demo-mode": "true",
  });

  const value = readStorageWithLegacyFallback(storage, "redisense-demo-mode", "reportiq-demo-mode");

  assert.equal(value, "false");
  assert.equal(storage.getItem("reportiq-demo-mode"), "true");
});

test("missing both keys returns null without writing", () => {
  const storage = memoryStorage();

  assert.equal(readStorageWithLegacyFallback(storage, "a", "b"), null);
  assert.deepEqual(storage.snapshot(), {});
});
