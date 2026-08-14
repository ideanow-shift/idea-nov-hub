import { assertEquals } from "jsr:@std/assert@1";
import { handleDbfBusinessDataRequest } from "../supabase/functions/dbf-business-data-api/index.ts";

const TOKEN = `x.${"a".repeat(40)}.${"b".repeat(40)}`;
const ACTOR = "11111111-1111-4111-8111-111111111111";

function runtime(fetchImpl: typeof fetch, overrides = {}) {
  return {
    hubApiUrl: "https://hub.example/functions/v1/nov-hub-api",
    supabaseUrl: "https://zgkoofphhivesclehrom.supabase.co",
    serviceRoleKey: "server-only-service-role",
    expectedProjectRef: "zgkoofphhivesclehrom",
    runtimeImport: "ENABLED",
    productionWrite: "DISABLED",
    fetchImpl,
    ...overrides,
  };
}

function request(action: string, payload: unknown, token = TOKEN) {
  return new Request("https://staging.example/dbf-business-data-api", {
    method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, payload }),
  });
}

Deno.test("valid staging session and backend capability reach only the service-role RPC", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input); calls.push({ url, init });
    if (url.startsWith("https://hub.example")) return Response.json({ ok: true, data: {
      actorEmployeeId: ACTOR, capability: { businessDataAdmin: true }, scope: "all",
    }});
    return Response.json({ items: [] });
  };
  const result = await handleDbfBusinessDataRequest(request("dbfImportHistoryV1", { limit: 10 }), runtime(fetchImpl));
  assertEquals(result.status, 200);
  assertEquals(calls.length, 2);
  assertEquals(calls[1].url, "https://zgkoofphhivesclehrom.supabase.co/rest/v1/rpc/dbf_import_history_v1");
  assertEquals((calls[1].init?.headers as Record<string, string>).authorization, "Bearer server-only-service-role");
});

Deno.test("missing auth is 401 and performs no downstream call", async () => {
  let calls = 0;
  const result = await handleDbfBusinessDataRequest(new Request("https://staging.example", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "dbfImportHistoryV1", payload: {} }),
  }), runtime(async () => { calls += 1; return Response.json({}); }));
  assertEquals(result.status, 401);
  assertEquals(calls, 0);
});

Deno.test("authenticated but unauthorized is 403 and never calls DB", async () => {
  let calls = 0;
  const result = await handleDbfBusinessDataRequest(request("dbfImportHistoryV1", {}), runtime(async () => {
    calls += 1; return new Response(JSON.stringify({ ok: false }), { status: 403 });
  }));
  assertEquals(result.status, 403);
  assertEquals(calls, 1);
});

Deno.test("wrong project, disabled import, or enabled production writes fail closed", async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return Response.json({}); };
  for (const overrides of [
    { supabaseUrl: "https://unknown.supabase.co" },
    { runtimeImport: "DISABLED" },
    { productionWrite: "ENABLED" },
  ]) {
    const result = await handleDbfBusinessDataRequest(request("dbfImportHistoryV1", {}), runtime(fetchImpl, overrides));
    assertEquals(result.status, 503);
  }
  assertEquals(calls, 0);
});

Deno.test("mapping evidence is minted by Canonical Master backend and never trusted from browser", async () => {
  const calls: Array<{ url: string; body: any }> = [];
  const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({ url, body });
    if (body?.action === "dbfBusinessDataAdminAuthorizeV1") return Response.json({ ok: true, data: {
      actorEmployeeId: ACTOR, capability: { businessDataAdmin: true }, scope: "all",
    }});
    if (body?.action === "dbfCanonicalMasterVerifyV1") return Response.json({ ok: true, data: {
      canonicalId: "22222222-2222-4222-8222-222222222222",
      canonicalEvidenceSha256: "c".repeat(64),
    }});
    return Response.json({ mappingId: "33333333-3333-4333-8333-333333333333" });
  };
  const result = await handleDbfBusinessDataRequest(request("dbfImportConfirmMappingV1", {
    batchId: "55555555-5555-4555-8555-555555555555",
    sourceSystem: "pilot-csv-v1",
    entityType: "store",
    sourceKey: "0001",
    canonicalId: "22222222-2222-4222-8222-222222222222",
    companyCanonicalId: "11111111-1111-4111-8111-111111111111",
  }), runtime(fetchImpl));
  assertEquals(result.status, 200);
  assertEquals(calls.length, 3);
  assertEquals(calls[1].body.action, "dbfCanonicalMasterVerifyV1");
  assertEquals(calls[2].body.p_canonical_evidence_sha256, "c".repeat(64));
});

Deno.test("Canonical Master options are authorized by the HUB backend and never read from staging tables", async () => {
  const calls: Array<{ url: string; body: any }> = [];
  const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({ url, body });
    if (body?.action === "dbfBusinessDataAdminAuthorizeV1") return Response.json({ ok: true, data: {
      actorEmployeeId: ACTOR, capability: { businessDataAdmin: true }, scope: "all",
    }});
    if (body?.action === "dbfCanonicalMasterOptionsV1") return Response.json({ ok: true, data: {
      companies: [{ id: ACTOR, code: "0001", name: "IDEA NOV" }], stores: [],
    }});
    throw new Error(`unexpected downstream call: ${url}`);
  };
  const result = await handleDbfBusinessDataRequest(request("dbfImportMasterOptionsV1", {}), runtime(fetchImpl));
  assertEquals(result.status, 200);
  assertEquals(calls.length, 2);
  assertEquals(calls[1].body.action, "dbfCanonicalMasterOptionsV1");
});

Deno.test("validation re-verifies company and store UUID bindings before service-role staging RPC", async () => {
  const calls: Array<{ url: string; body: any }> = [];
  const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({ url, body });
    if (body?.action === "dbfBusinessDataAdminAuthorizeV1") return Response.json({ ok: true, data: {
      actorEmployeeId: ACTOR, capability: { businessDataAdmin: true }, scope: "all",
    }});
    if (body?.action === "dbfCanonicalMasterValidateBindingsV1") return Response.json({ ok: true, data: {
      valid: true, bindingCount: 1,
    }});
    return Response.json({ batchId: "55555555-5555-4555-8555-555555555555", status: "validated" });
  };
  const result = await handleDbfBusinessDataRequest(request("dbfImportValidateV1", {
    batchId: "55555555-5555-4555-8555-555555555555",
    factKind: "pl",
    fiscalMonth: "2026-07",
    parserReceipt: { statement: "PL", status: "PARSED", balanceCheck: null, parserVersion: "dbf-normalized-csv-v1" },
    rows: [{
      sourceRowNumber: 1, fiscalMonth: "2026-07", companyId: ACTOR,
      storeId: "22222222-2222-4222-8222-222222222222",
      companyMappingId: "33333333-3333-4333-8333-333333333333",
      storeMappingId: "44444444-4444-4444-8444-444444444444",
      accountCode: "4000", accountName: "Sales", amount: 1000,
      sourceRowCategory: "detail", aggregateScope: null, confirmationStatus: "confirmed",
    }],
    warnings: [],
  }), runtime(fetchImpl));
  assertEquals(result.status, 200);
  assertEquals(calls.length, 3);
  assertEquals(calls[1].body.action, "dbfCanonicalMasterValidateBindingsV1");
  assertEquals(calls[2].url, "https://zgkoofphhivesclehrom.supabase.co/rest/v1/rpc/dbf_import_stage_v1");
});
