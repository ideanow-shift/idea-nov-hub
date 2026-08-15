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

Deno.test("Pilot 2026-06 read route composes validated RPC previews without a business write", async () => {
  const definitions = [
    { id: "10000000-0000-4000-8000-000000000001", factKind: "pl", sourceType: "monthly_pl_comparison_source_audit", status: "mapping_required", raw: 34, staged: 0,
      rules: ["DERIVED_VARIANCE_NOT_FACT", "PRIOR_COMPARISON_SOURCE_ONLY", "UNSUPPORTED_SCOPE_ROWS_QUARANTINED"] },
    { id: "10000000-0000-4000-8000-000000000002", factKind: "pl", sourceType: "monthly_pl_actual", status: "owner_review", raw: 164, staged: 164,
      rules: ["ACCOUNT_CODE_ABSENT_SOURCE_ROW_CANDIDATE", "PDF_TAX_BASIS_REVIEW"] },
    { id: "10000000-0000-4000-8000-000000000003", factKind: "budget", sourceType: "monthly_pl_plan", status: "owner_review", raw: 777, staged: 777,
      rules: ["ACCOUNT_CODE_ABSENT_SOURCE_ROW_CANDIDATE", "BUDGET_APPROVAL_UNVERIFIED", "PDF_TAX_BASIS_REVIEW"] },
    { id: "10000000-0000-4000-8000-000000000004", factKind: "pl", sourceType: "yayoi_monthly_pl_actual", status: "owner_review", raw: 852, staged: 852,
      rules: ["ACCOUNT_CODE_ABSENT_SOURCE_ROW_CANDIDATE", "PDF_EXCEL_RECONCILIATION_PASS"] },
    { id: "10000000-0000-4000-8000-000000000005", factKind: "bs", sourceType: "yayoi_monthly_bs", status: "owner_review", raw: 67, staged: 67,
      rules: ["ACCOUNT_CODE_ABSENT_SOURCE_ROW_CANDIDATE", "BS_BALANCE_PASS"] },
  ];
  const calls: Array<{ url: string; body: any }> = [];
  let previewInFlight = 0;
  let maxPreviewInFlight = 0;
  const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({ url, body });
    if (url.startsWith("https://hub.example")) return Response.json({ ok: true, data: {
      actorEmployeeId: ACTOR, capability: { businessDataAdmin: true }, scope: "all",
    }});
    if (url.endsWith("/rpc/dbf_import_history_v1")) return Response.json({ items: definitions.map((item) => ({
      batchId: item.id, factKind: item.factKind, fiscalMonth: "2026-06", sourceType: item.sourceType,
      status: item.status, revision: 1, rowCount: item.raw, errorCount: 0, warningCount: item.rules.length,
    })) });
    previewInFlight += 1;
    maxPreviewInFlight = Math.max(maxPreviewInFlight, previewInFlight);
    await new Promise((resolve) => setTimeout(resolve, 1));
    const item = definitions.find((candidate) => candidate.id === body?.p_batch_id)!;
    const response = Response.json({
      batchId: item.id, rowCount: item.staged, validCount: item.staged, quarantinedCount: 0,
      errorCount: 0, warningCount: item.rules.length, promotionAllowed: false,
      issues: item.rules.map((ruleCode) => ({ severity: "warning", ruleCode, fieldName: null, message: "Owner review required." })),
    });
    previewInFlight -= 1;
    return response;
  };
  const result = await handleDbfBusinessDataRequest(request("dbfPilotMonthPreviewV1", {
    fiscalMonth: "2026-06", section: "all",
  }), runtime(fetchImpl));
  const body = await result.json();
  assertEquals(result.status, 200);
  assertEquals(body.data.sourceStatus, "READY_FOR_OWNER_PREVIEW");
  assertEquals(body.data.summary, {
    sourceFiles: 2, importBatches: 5, rawRows: 1894, stagingRows: 1860,
    errors: 0, warnings: 12, promotionCandidates: 1860, canonicalFactWrites: 0,
    approvals: 0, promotions: 0,
  });
  assertEquals(body.data.pl.reconciliation, "PASS");
  assertEquals(body.data.bs.difference, 0);
  assertEquals(body.data.sourcePrecedence.duplicatePromotionCount, 0);
  assertEquals(body.data.gates.canonicalPromotion, "DISABLED");
  assertEquals(calls.length, 7);
  assertEquals(calls.filter((call) => call.url.includes("/rpc/dbf_import_preview_v1")).length, 5);
  assertEquals(maxPreviewInFlight, 1);
  assertEquals(calls.some((call) => /approve|promote/u.test(call.url)), false);
});
