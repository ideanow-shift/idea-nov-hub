import {
  CURRENT_STORE_BASELINE,
  jsonResponse,
  STORE_SALES_API_VERSION,
  STORE_SALES_STAGING_ENVIRONMENT,
  type AccountingStoreProjection,
  type HubActor,
  type StoreMasterRow,
  type StoreSalesDependencies,
} from "./contract.ts";

const PERIOD = /^20\d{2}-(0[1-9]|1[0-2])$/;

function safeError(status: number, code: string) {
  return jsonResponse({ ok: false, environment: STORE_SALES_STAGING_ENVIRONMENT, error: { code } }, status);
}

function bearer(request: Request): string | null {
  const value = request.headers.get("authorization") || "";
  const match = /^Bearer\s+(.+)$/i.exec(value);
  return match?.[1]?.trim() || null;
}

function scopeFor(actor: HubActor, stores: StoreMasterRow[]): StoreMasterRow[] | null {
  if (actor.roles.some((role) => role === "representative" || role === "executive")) return stores;
  if (actor.roles.includes("sales_director")) return stores.filter((store) => store.storeClass === "DIRECT");
  if (actor.roles.includes("area_manager")) return null; // No approved AM assignment source: deny by default.
  if (actor.roles.includes("store_manager")) return stores.filter((store) => store.storeCode === actor.ownStoreCode);
  if (actor.roles.includes("fc_owner")) return stores.filter((store) => store.storeClass === "FC" && store.operatorCode === actor.fcOperatorCode);
  return [];
}

function baselineIsExact(stores: StoreMasterRow[]): boolean {
  const actual = new Map(stores.map((store) => [store.storeCode, store.storeClass]));
  return stores.length === 20 && CURRENT_STORE_BASELINE.length === 20 &&
    CURRENT_STORE_BASELINE.every(([code, storeClass]) => actual.get(code) === storeClass);
}

function metricFor(store: StoreMasterRow, source: AccountingStoreProjection | undefined) {
  const confirmed = source?.confirmed === true && source.taxBasis === "exclusive";
  const totalRevenue = confirmed ? source?.totalRevenue ?? null : null;
  // V1 intentionally suppresses FC profit and all unconfirmed profit.
  const operatingProfit = confirmed && store.storeClass === "DIRECT" ? source?.operatingProfit ?? null : null;
  const operatingProfitMargin = operatingProfit !== null && totalRevenue !== null && totalRevenue > 0
    ? operatingProfit / totalRevenue
    : null;
  return {
    totalRevenue,
    operatingProfit,
    operatingProfitMargin,
    confirmedThroughPeriod: confirmed ? source?.confirmedThroughPeriod ?? null : null,
    dataState: confirmed ? "confirmed" : "preparing",
    profitState: store.storeClass === "FC" ? "unavailable" : confirmed && operatingProfit !== null ? "confirmed" : "preparing",
  };
}

function dashboard(period: string, scoped: StoreMasterRow[], accounting: AccountingStoreProjection[]) {
  const byStore = new Map(accounting.map((item) => [item.canonicalStoreId, item]));
  return {
    ok: true,
    contractVersion: STORE_SALES_API_VERSION,
    environment: STORE_SALES_STAGING_ENVIRONMENT,
    period,
    stores: scoped.map((store) => ({
      storeId: store.canonicalStoreId,
      storeCode: store.storeCode,
      displayName: store.displayName,
      storeClass: store.storeClass,
      metrics: metricFor(store, byStore.get(store.canonicalStoreId)),
    })),
  };
}

export function createStoreSalesStagingHandler(deps: StoreSalesDependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "GET") return safeError(405, "METHOD_NOT_ALLOWED");
    const token = bearer(request);
    if (!token) return safeError(401, "SESSION_REQUIRED");
    const actor = await deps.sessionVerifier.verifyHubSession(token);
    if (!actor) return safeError(401, "SESSION_INVALID");
    const url = new URL(request.url);
    const period = url.searchParams.get("period") || "";
    if (!PERIOD.test(period)) return safeError(422, "PERIOD_INVALID");
    const stores = (await deps.storeMaster.listCurrentStores()).filter((store) => store.active);
    if (!baselineIsExact(stores)) return safeError(503, "STORE_MASTER_UNAVAILABLE");
    const scoped = scopeFor(actor, stores);
    if (scoped === null) return safeError(403, "AM_SCOPE_UNASSIGNED");
    if (scoped.length === 0) return safeError(403, "STORE_SCOPE_DENIED");

    const detail = /^\/v1\/store-sales\/stores\/([^/]+)$/.exec(url.pathname);
    let selected = scoped;
    if (detail) {
      const rawReference = decodeURIComponent(detail[1]);
      const canonical = await deps.storeMaster.resolveLegacyStoreReference(rawReference) || rawReference;
      const store = scoped.find((candidate) => candidate.canonicalStoreId === canonical);
      if (!store) return safeError(404, "STORE_NOT_IN_SCOPE");
      selected = [store];
    } else if (url.pathname !== "/v1/store-sales/dashboard") {
      return safeError(404, "ENDPOINT_NOT_FOUND");
    }

    const accounting = await deps.accounting.readStoreProjection({
      canonicalStoreIds: selected.map((store) => store.canonicalStoreId),
      period,
    });
    return jsonResponse(dashboard(period, selected, accounting));
  };
}
