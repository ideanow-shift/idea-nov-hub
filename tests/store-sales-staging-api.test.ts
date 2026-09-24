import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createStoreSalesStagingHandler } from "../supabase/functions/store-sales-staging-api/handler.ts";
import { CURRENT_STORE_BASELINE, type StoreSalesDependencies } from "../supabase/functions/store-sales-staging-api/contract.ts";

const stores = CURRENT_STORE_BASELINE.map(([storeCode, storeClass], index) => ({
  canonicalStoreId: `canonical-${index}`,
  storeCode,
  displayName: storeCode,
  storeClass,
  active: true,
  operatorCode: storeClass === "FC" ? "fc-owner-a" : null,
}));
const tokenActors: Record<string, { subject: string; roles: any[]; ownStoreCode: string | null; fcOperatorCode: string | null }> = {
  representative: { subject: "r", roles: ["representative"], ownStoreCode: null, fcOperatorCode: null },
  sales: { subject: "s", roles: ["sales_director"], ownStoreCode: null, fcOperatorCode: null },
  am: { subject: "a", roles: ["area_manager"], ownStoreCode: null, fcOperatorCode: null },
  manager: { subject: "m", roles: ["store_manager"], ownStoreCode: "tokorozawa", fcOperatorCode: null },
  employee: { subject: "e", roles: ["employee"], ownStoreCode: null, fcOperatorCode: null },
};
const deps: StoreSalesDependencies = {
  sessionVerifier: { verifyHubSession: async (token) => tokenActors[token] || null },
  storeMaster: {
    listCurrentStores: async () => stores,
    resolveLegacyStoreReference: async (value) => value === "legacy-tokorozawa" ? "canonical-0" : null,
  },
  accounting: {
    readStoreProjection: async ({ canonicalStoreIds, period }) => canonicalStoreIds.map((canonicalStoreId) => ({
      canonicalStoreId, period, confirmedThroughPeriod: period, totalRevenue: 100, operatingProfit: 20, taxBasis: "exclusive", confirmed: true,
    })),
  },
};
const handler = createStoreSalesStagingHandler(deps);
async function request(token: string, path = "/v1/store-sales/dashboard?period=2026-07") {
  return await handler(new Request(`https://staging.example${path}`, { headers: { authorization: `Bearer ${token}` } }));
}

Deno.test("representative receives the exact 20-store baseline", async () => {
  const response = await request("representative");
  const body = await response.json();
  assertEquals(response.status, 200); assertEquals(body.stores.length, 20);
});
Deno.test("sales director receives only direct 13", async () => {
  const body = await (await request("sales")).json();
  assertEquals(body.stores.length, 13); assertEquals(body.stores.every((store: any) => store.storeClass === "DIRECT"), true);
});
Deno.test("unassigned AM is denied", async () => assertEquals((await request("am")).status, 403));
Deno.test("store manager receives only own store", async () => {
  const body = await (await request("manager")).json(); assertEquals(body.stores.length, 1); assertEquals(body.stores[0].storeCode, "tokorozawa");
});
Deno.test("employee is denied", async () => assertEquals((await request("employee")).status, 403));
Deno.test("legacy Tokorozawa reference resolves only through the server port", async () => {
  const body = await (await request("manager", "/v1/store-sales/stores/legacy-tokorozawa?period=2026-07")).json(); assertEquals(body.stores[0].storeCode, "tokorozawa");
});
Deno.test("FC profit is unavailable and never synthesized", async () => {
  const body = await (await request("representative")).json(); const fc = body.stores.find((store: any) => store.storeClass === "FC");
  assertEquals(fc.metrics.operatingProfit, null); assertEquals(fc.metrics.profitState, "unavailable");
});

Deno.test("missing accounting projection remains null and preparing", async () => {
  const handlerWithoutProjection = createStoreSalesStagingHandler({ ...deps, accounting: { readStoreProjection: async () => [] } });
  const response = await handlerWithoutProjection(new Request("https://staging.example/v1/store-sales/dashboard?period=2026-07", {
    headers: { authorization: "Bearer representative" },
  }));
  const body = await response.json();
  assertEquals(body.stores[0].metrics.totalRevenue, null);
  assertEquals(body.stores[0].metrics.operatingProfit, null);
  assertEquals(body.stores[0].metrics.dataState, "preparing");
});

Deno.test("a Store Master baseline mismatch fails closed", async () => {
  const handlerWithExtraStore = createStoreSalesStagingHandler({
    ...deps,
    storeMaster: { ...deps.storeMaster, listCurrentStores: async () => [...stores, { ...stores[0], canonicalStoreId: "extra", storeCode: "extra" }] },
  });
  const response = await handlerWithExtraStore(new Request("https://staging.example/v1/store-sales/dashboard?period=2026-07", {
    headers: { authorization: "Bearer representative" },
  }));
  assertEquals(response.status, 503);
});
