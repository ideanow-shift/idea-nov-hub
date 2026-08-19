import {
  buildCorporateAccountingActualProjection,
  buildStoreMonthlyActualProjection,
  resolveCorporateCompany,
  resolveOfficialOperatingStores,
} from "../supabase/functions/dbf-business-data-api/consumer-read.ts";
import { handleDbfBusinessDataRequest } from "../supabase/functions/dbf-business-data-api/index.ts";

const COMPANY = "e4059116-bdb3-4e13-9763-bbc77bdfe062";
const OTHER_COMPANY = "20000000-0000-4000-8000-000000000002";
const TOKEN = "staging-session-token-1234567890";

function assert(value: unknown, message = "assertion failed"): asserts value {
  if (!value) throw new Error(message);
}

function assertEquals(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

function master() {
  const companies = [
    { id: COMPANY, code: "IDEA_NOV", name: "IDEA NOV" },
    { id: OTHER_COMPANY, code: "UNO", name: "UNO" },
  ];
  const stores = [{
    id: "30000000-0000-4000-8999-000000000001",
    code: "honbu",
    name: "本部",
    companyId: COMPANY,
  }, ...Array.from({ length: 20 }, (_, index) => ({
    id: `30000000-0000-4000-8${String(index).padStart(3, "0")}-000000000001`,
    code: `store-${String(index + 1).padStart(2, "0")}`,
    name: `Store ${index + 1}`,
    companyId: index < 13 ? COMPANY : OTHER_COMPANY,
  }))];
  return { companies, stores };
}

Deno.test("trusted master resolves the exact 20-store baseline without a Production projection", () => {
  const stores = resolveOfficialOperatingStores(master());
  const projection = buildStoreMonthlyActualProjection("2026-06", stores, []);
  assertEquals(projection.stores.length, 20);
  assertEquals(
    projection.stores.filter((row) => row.ownership === "DIRECT").length,
    13,
  );
  assertEquals(
    projection.stores.filter((row) => row.ownership === "FC").length,
    7,
  );
  assertEquals(projection.readiness.confirmedStoreCount, 0);
  assertEquals(projection.readiness.missingStoreCount, 20);
  assert(
    projection.stores.every((row) =>
      row.dataState === "preparing" && row.metrics.length === 0
    ),
  );
  assert(
    !JSON.stringify(projection).includes("30000000-"),
    "raw store UUID leaked",
  );
});

function expectStoreResolutionFailure(
  mutate: (value: ReturnType<typeof master>) => void,
  expectedCode: string,
) {
  const value = master();
  mutate(value);
  try {
    resolveOfficialOperatingStores(value);
    throw new Error("expected store resolution to fail");
  } catch (error) {
    assertEquals((error as { code?: string }).code, expectedCode);
  }
}

Deno.test("official store resolution rejects missing or malformed headquarters", () => {
  expectStoreResolutionFailure(
    (value) => value.stores.splice(0, 1),
    "OFFICIAL_STORE_HEADQUARTERS_REJECTED",
  );
  expectStoreResolutionFailure(
    (value) => value.stores[0].name = "Head Office",
    "OFFICIAL_STORE_HEADQUARTERS_REJECTED",
  );
  expectStoreResolutionFailure(
    (value) => value.stores[0].code = "head-office",
    "OFFICIAL_STORE_HEADQUARTERS_REJECTED",
  );
  expectStoreResolutionFailure(
    (value) => value.stores[0].companyId = OTHER_COMPANY,
    "OFFICIAL_STORE_HEADQUARTERS_REJECTED",
  );
});

Deno.test("official store resolution rejects count and ownership drift", () => {
  expectStoreResolutionFailure(
    (value) => value.stores.push({
      id: "30000000-0000-4000-8998-000000000001",
      code: "store-21",
      name: "Store 21",
      companyId: OTHER_COMPANY,
    }),
    "OFFICIAL_STORE_BASELINE_REJECTED",
  );
  expectStoreResolutionFailure(
    (value) => value.stores[1].companyId = OTHER_COMPANY,
    "OFFICIAL_STORE_BASELINE_REJECTED",
  );
});

Deno.test("official store resolution rejects duplicate code and id", () => {
  expectStoreResolutionFailure(
    (value) => value.stores[2].code = value.stores[1].code,
    "CANONICAL_STORE_SET_INVALID",
  );
  expectStoreResolutionFailure(
    (value) => value.stores[2].id = value.stores[1].id,
    "CANONICAL_STORE_SET_INVALID",
  );
});

Deno.test("corporate projection returns preparing instead of fabricated zero facts", () => {
  const company = resolveCorporateCompany(master());
  const preparing = buildCorporateAccountingActualProjection(
    "2026-06",
    company,
    [],
  );
  assertEquals(preparing.dataState, "preparing");
  assertEquals(preparing.lineCount, 0);
  assertEquals(preparing.lines, []);
  assert(
    !JSON.stringify(preparing).includes(COMPANY),
    "raw company UUID leaked",
  );

  const confirmed = buildCorporateAccountingActualProjection(
    "2026-06",
    company,
    [{
      fiscal_month: "2026-06-01",
      company_id: COMPANY,
      statement_type: "pl",
      line_type: "detail",
      account_code: "PL-01",
      account_name: "Sales",
      amount_value: "123.45",
      classification: null,
      aggregate_scope: null,
      row_semantics: "POSTABLE_DETAIL",
      is_additive: true,
      source_type: "dbf",
      source_file_sha256: "a".repeat(64),
      imported_at: "2026-08-19T00:00:00Z",
      fact_version: 1,
    }],
  );
  assertEquals(confirmed.dataState, "confirmed");
  assertEquals(confirmed.lines[0].amount, "123.45");
});

function request(action: string) {
  return new Request(
    "https://zgkoofphhivesclehrom.supabase.co/functions/v1/dbf-business-data-api",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ action, payload: { selectedMonth: "2026-06" } }),
    },
  );
}

function runtime() {
  const calls: Array<{ target: string; action?: string; rpc?: string }> = [];
  let activeRpcCalls = 0;
  let maxConcurrentRpcCalls = 0;
  const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = JSON.parse(String(init?.body || "{}"));
    if (url === "https://hub.example/api") {
      calls.push({ target: "hub", action: body.action });
      if (body.action === "dbfBusinessDataAdminAuthorizeV1") {
        return Response.json({
          ok: true,
          data: {
            actorEmployeeId: "90000000-0000-4000-8000-000000000001",
            capability: { businessDataAdmin: true },
            scope: "all",
          },
        });
      }
      if (body.action === "dbfCanonicalMasterOptionsV1") {
        return Response.json({ ok: true, data: master() });
      }
    }
    const rpc = url.split("/rest/v1/rpc/")[1] || "";
    calls.push({ target: "staging", rpc });
    activeRpcCalls += 1;
    maxConcurrentRpcCalls = Math.max(maxConcurrentRpcCalls, activeRpcCalls);
    await Promise.resolve();
    activeRpcCalls -= 1;
    return Response.json([]);
  };
  return {
    calls,
    get maxConcurrentRpcCalls() {
      return maxConcurrentRpcCalls;
    },
    value: {
      hubApiUrl: "https://hub.example/api",
      supabaseUrl: "https://zgkoofphhivesclehrom.supabase.co",
      serviceRoleKey: "service-role-test-key",
      expectedProjectRef: "zgkoofphhivesclehrom",
      runtimeImport: "ENABLED",
      productionWrite: "DISABLED",
      corporateAccountingExecution: "DISABLED",
      corporatePromotionManifestJson: "",
      fetchImpl,
    },
  };
}

Deno.test("staging Store Monthly route uses server master and Staging fact RPC only", async () => {
  const fixture = runtime();
  const response = await handleDbfBusinessDataRequest(
    request("storeMonthlyActualProjectionV1"),
    fixture.value,
  );
  const body = await response.json();
  assertEquals(response.status, 200);
  assertEquals(body.data.readiness.missingStoreCount, 20);
  assertEquals(
    fixture.calls.filter((call) =>
      call.action === "dbfCanonicalMasterOptionsV1"
    ).length,
    1,
  );
  assertEquals(
    fixture.calls.filter((call) =>
      call.action === "storeMonthlyActualProjectionV1"
    ).length,
    0,
  );
  assertEquals(
    fixture.calls.filter((call) =>
      call.rpc === "dbf_store_monthly_actual_read_v1"
    ).length,
    2,
  );
  assertEquals(fixture.maxConcurrentRpcCalls, 1);
});

Deno.test("corporate read remains available while Approval and Promotion execution are disabled", async () => {
  const fixture = runtime();
  const response = await handleDbfBusinessDataRequest(
    request("dbfCorporateAccountingActualProjectionV1"),
    fixture.value,
  );
  const body = await response.json();
  assertEquals(response.status, 200);
  assertEquals(body.data.dataState, "preparing");
  assertEquals(
    fixture.calls.filter((call) =>
      call.rpc === "dbf_corporate_accounting_actual_read_v1"
    ).length,
    1,
  );
  assertEquals(
    fixture.calls.filter((call) =>
      call.rpc === "dbf_corporate_accounting_approve_v1"
    ).length,
    0,
  );
  assertEquals(
    fixture.calls.filter((call) =>
      call.rpc === "dbf_import_promote_corporate_accounting_v1"
    ).length,
    0,
  );
});
