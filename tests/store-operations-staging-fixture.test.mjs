import assert from "node:assert/strict";
import test from "node:test";
import { createStoreOperationsStagingFixture } from "../deploy/store-operations-staging-ui/staging-fixture.mjs";
import { validateDbfStoreMonthlyProjection } from "../portal/store-sales/adapters/dbf-store-monthly.js";

test("Staging fixture is exactly 20 fictional stores and contains no private identifiers", () => {
  const raw = createStoreOperationsStagingFixture({ selectedMonth: "2026-06" });
  const projection = validateDbfStoreMonthlyProjection(raw);
  assert.equal(projection.stores.length, 20);
  assert.equal(projection.stores.filter((store) => store.ownership === "Direct").length, 13);
  assert.equal(projection.stores.filter((store) => store.ownership === "FC").length, 7);
  assert.ok(projection.stores.every((store) => store.storeName.startsWith("架空")));
  assert.doesNotMatch(JSON.stringify(raw), /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/iu);
  assert.equal(projection.readiness.fixtureData, true);
  assert.equal(projection.readiness.fixtureLabel, "架空20店舗");
});

test("June fixture has confirmed direct-store profit", () => {
  const projection = validateDbfStoreMonthlyProjection(createStoreOperationsStagingFixture({ selectedMonth: "2026-06" }));
  assert.equal(projection.accounting.confirmationState, "confirmed");
  assert.equal(projection.accounting.confirmedThroughPeriod, "2026-06");
  assert.ok(projection.stores.filter((store) => store.ownership === "Direct")
    .every((store) => store.metrics.operatingProfit.dataState === "available"));
});

test("July fixture keeps profit preparing and confirmed through June", () => {
  const projection = validateDbfStoreMonthlyProjection(createStoreOperationsStagingFixture({ selectedMonth: "2026-07" }));
  assert.equal(projection.accounting.confirmationState, "preparing");
  assert.equal(projection.accounting.confirmedThroughPeriod, "2026-06");
  assert.ok(projection.stores.filter((store) => store.ownership === "Direct")
    .every((store) => store.metrics.operatingProfit.dataState === "preparing"));
});

test("fixture selected-store read is one safe fictional store", () => {
  const projection = validateDbfStoreMonthlyProjection(createStoreOperationsStagingFixture({ selectedMonth: "2026-07", selectedStoreKey: "fixture-store-14" }));
  assert.equal(projection.selectedStoreKey, "fixture-store-14");
  assert.equal(projection.stores.length, 1);
  assert.equal(projection.stores[0].storeName, "架空FC01");
  assert.throws(() => createStoreOperationsStagingFixture({ selectedMonth: "2026-07", selectedStoreKey: "real-store" }), /FIXTURE_STORE_NOT_AVAILABLE/u);
});

test("fixture rejects months outside the explicit UAT range", () => {
  assert.throws(() => createStoreOperationsStagingFixture({ selectedMonth: "2026-08" }), /FIXTURE_PERIOD_NOT_AVAILABLE/u);
});
