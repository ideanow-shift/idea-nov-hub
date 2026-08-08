import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { CURRENT_STORE_BASELINE } from "../supabase/functions/store-sales-staging-api/contract.ts";
import { validateStoreSalesSnapshot } from "../supabase/functions/store-sales-staging-api/snapshot-manifest.ts";

const now = new Date("2026-08-01T00:00:00.000Z");
const snapshot = {
  format: "store-sales-staging-snapshot-v1",
  approvedAt: "2026-08-01T00:00:00.000Z",
  expiresAt: "2026-08-02T00:00:00.000Z",
  stores: CURRENT_STORE_BASELINE.map(([storeCode, storeClass], index) => ({ canonicalStoreId: `fixture-${index}`, storeCode, displayName: storeCode, storeClass, active: true, operatorCode: null })),
  accounting: [],
  legacyStoreReferences: { "legacy-fixture": "fixture-0" },
};

Deno.test("approved snapshot accepts only the exact 20 / 13 / 7 Store Master baseline", () => {
  assertEquals(validateStoreSalesSnapshot(snapshot, now).ok, true);
  assertEquals(validateStoreSalesSnapshot({ ...snapshot, stores: snapshot.stores.slice(1) }, now), { ok: false, code: "STORE_MASTER_BASELINE_INVALID" });
});

Deno.test("missing or expired snapshots fail closed", () => {
  assertEquals(validateStoreSalesSnapshot(null, now), { ok: false, code: "SNAPSHOT_MISSING" });
  assertEquals(validateStoreSalesSnapshot({ ...snapshot, expiresAt: "2026-08-01T00:00:00.000Z" }, now), { ok: false, code: "SNAPSHOT_EXPIRED" });
});

