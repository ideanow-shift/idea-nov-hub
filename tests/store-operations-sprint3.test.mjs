import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createProjectionAdapter } from "../portal/store-sales/adapters/projection.js";
import { createStoreViewSelector } from "../portal/store-sales/store-view-selector.js";
import { createRuntimeDiagnostics } from "../portal/store-sales/runtime/diagnostics.js";
import { mapRuntimeError, runtimePresentation } from "../portal/store-sales/runtime/error-mapping.js";
import { createStoreSalesRuntime } from "../portal/store-sales/runtime/store-sales-runtime.js";
import { SYNTHETIC_STORES } from "../supabase/functions/store-sales-projection/synthetic-data.js";

const location = { hostname: "127.0.0.1", search: "" };
const projection = (stores = [{ storeKey: "synthetic-01" }]) => ({ stores, accounting: {}, executiveSummary: { metrics: [] }, priorityActions: [], businessDrivers: {} });
const runtimeWithAdapter = (adapter, dependencies = {}) => createStoreSalesRuntime({
  location, runtimeConfig: { featureFlag: "mock", mode: "mock", requireHubSession: false },
  dependencies: { isOnline: () => true, createAdapter: () => ({ config: { mode: "mock" }, adapter }), ...dependencies }
});

test("diagnostics logger records only allowlisted non-sensitive fields", () => {
  const logged = [];
  const diagnostics = createRuntimeDiagnostics({ logger: (entry) => logged.push(entry), now: () => 10 });
  diagnostics.record("runtime_transition", { status: "ready", token: "secret", employeeId: "private" });
  assert.deepEqual(logged[0], { timestamp: 10, event: "runtime_transition", status: "ready" });
});

test("diagnostics uses a bounded ring buffer", () => {
  const diagnostics = createRuntimeDiagnostics({ limit: 10 });
  for (let index = 0; index < 15; index += 1) diagnostics.record("runtime_transition", { retryCount: index });
  assert.equal(diagnostics.entries().length, 10);
  assert.equal(diagnostics.entries()[0].retryCount, 5);
});

test("runtime exposes sanitized transition diagnostics", async () => {
  const runtime = runtimeWithAdapter({ loadDashboard: async () => projection(), clear() {} });
  await runtime.initialize({ period: "2026-07" });
  assert.deepEqual(runtime.getDiagnostics().map((entry) => entry.to), ["initializing", "loading", "ready"]);
  assert.equal(runtime.getSnapshot().diagnostics.eventCount, 3);
});

test("retry is ignored for non-retryable states", async () => {
  let loads = 0;
  const runtime = runtimeWithAdapter({ loadDashboard: async () => { loads += 1; return projection(); }, clear() {} });
  await runtime.initialize({ period: "2026-07" });
  await runtime.retry();
  assert.equal(loads, 1);
  assert.equal(runtime.getSnapshot().retryCount, 0);
});

test("concurrent retry clicks share one request", async () => {
  let loads = 0;
  let release;
  const runtime = runtimeWithAdapter({
    async loadDashboard() {
      loads += 1;
      if (loads === 1) throw Object.assign(new Error("timeout"), { code: "TIMEOUT", status: 408 });
      return new Promise((resolve) => { release = () => resolve(projection()); });
    }, clear() {}
  });
  await runtime.initialize({ period: "2026-07" });
  const first = runtime.retry();
  const second = runtime.retry();
  release();
  assert.equal((await first).status, "ready");
  assert.equal((await second).status, "ready");
  assert.equal(loads, 2);
  assert.equal(runtime.getSnapshot().retryCount, 1);
});

test("adapter clear aborts an active request", async () => {
  const adapter = createProjectionAdapter({ mode: "integration", endpoint: "http://localhost/projection", timeoutMs: 20000, contractVersion: "store-sales-projection-v1" }, {
    getSessionToken: () => "session",
    fetchImpl: (_url, options) => new Promise((_resolve, reject) => {
      const abort = () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
      if (options.signal.aborted) abort();
      else options.signal.addEventListener("abort", abort);
    })
  });
  const pending = adapter.loadDashboard({ period: "2026-07" });
  adapter.clear();
  await assert.rejects(pending, (error) => error.code === "REQUEST_ABORTED");
});

test("second adapter load aborts the obsolete request", async () => {
  let calls = 0;
  const adapter = createProjectionAdapter({ mode: "integration", endpoint: "http://localhost/projection", timeoutMs: 20000, contractVersion: "store-sales-projection-v1" }, {
    getSessionToken: () => "session",
    fetchImpl: (_url, options) => new Promise((_resolve, reject) => {
      calls += 1;
      const abort = () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
      if (options.signal.aborted) abort();
      else options.signal.addEventListener("abort", abort);
    })
  });
  const obsolete = adapter.loadDashboard({ period: "2026-07" });
  const current = adapter.loadDashboard({ period: "2026-07" });
  await assert.rejects(obsolete, (error) => error.code === "REQUEST_ABORTED");
  adapter.clear();
  await assert.rejects(current, (error) => error.code === "REQUEST_ABORTED");
  assert.equal(calls, 2);
});

for (const [status, phrase] of [
  ["loading", "データを取得しています"], ["collecting", "集計しています"], ["preparing", "準備しています"],
  ["unavailable", "取得できない"], ["validation_error", "データを表示できません"],
  ["offline", "ネットワークに接続できません"], ["maintenance", "メンテナンス中です"]
]) {
  test(`${status} has sales-review wording`, () => assert.match(runtimePresentation(status).title, new RegExp(phrase)));
}

test("unknown runtime presentation fails safe", () => {
  const presentation = runtimePresentation("unknown_state");
  assert.equal(presentation.title, "表示状態を確認できません");
  assert.equal(presentation.retryable, false);
});

test("forbidden and empty mappings stay distinct", () => {
  assert.equal(mapRuntimeError({ code: "FORBIDDEN", status: 403 }).status, "forbidden");
  assert.equal(mapRuntimeError({ code: "NOT_FOUND", status: 404 }).status, "empty");
});

test("store view selector memoizes identical projection conditions", () => {
  const stores = Object.freeze([{ storeKey: "a", status: "Good", ownership: "Direct", metrics: {} }]);
  const select = createStoreViewSelector();
  assert.equal(select(stores, "All", "All", "status"), select(stores, "All", "All", "status"));
});

test("store view selector filters and sorts 500 stores without mutation", () => {
  const stores = Object.freeze(Array.from({ length: 500 }, (_, index) => ({
    storeKey: `store-${index}`, status: index % 2 ? "Good" : "Needs Attention",
    ownership: index % 3 ? "Direct" : "FC", metrics: { sales: { rawValue: index } }
  })));
  const started = performance.now();
  const result = createStoreViewSelector()(stores, "Direct", "Good", "sales-desc");
  assert.ok(result.length > 0);
  assert.ok(result.every((store) => store.ownership === "Direct" && store.status === "Good"));
  assert.ok(result.every((store, index) => index === 0 || result[index - 1].metrics.sales.rawValue >= store.metrics.sales.rawValue));
  assert.ok(performance.now() - started < 100);
  assert.equal(stores[0].storeKey, "store-0");
});

test("projection cache remains disabled and network requests remain no-store", async () => {
  let cacheMode;
  const adapter = createProjectionAdapter({ mode: "integration", endpoint: "http://localhost/projection", timeoutMs: 1000, contractVersion: "store-sales-projection-v1" }, {
    getSessionToken: () => "session",
    fetchImpl: async (_url, options) => {
      cacheMode = options.cache;
      return { ok: false, status: 404, json: async () => ({}) };
    }
  });
  await assert.rejects(adapter.loadDashboard({ period: "2026-07" }));
  assert.equal(cacheMode, "no-store");
});

test("synthetic sales values match their displayed yen amounts", () => {
  assert.equal(SYNTHETIC_STORES[0].sales_gross.value, 18_600_000);
  assert.equal(SYNTHETIC_STORES.reduce((sum, store) => sum + store.sales_gross.value, 0), 277_800_000);
});

test("store manager detail guards optional integration guidance", () => {
  const app = readFileSync(new URL("../portal/store-sales/app.js", import.meta.url), "utf8");
  assert.match(app, /Array\.isArray\(state\.selectedStore\.otherChecks\)/);
  assert.match(app, /state\.selectedStore\.nextCheck \|\|/);
});
