import { assertEquals, assertRejects, assertThrows } from "jsr:@std/assert@1";
import { handleDbfBusinessDataRequest } from "../supabase/functions/dbf-business-data-api/index.ts";
import {
  batchFromPilotPreflight,
  PRODUCTION_PILOT_GATE,
  PRODUCTION_PILOT_MANIFEST_REF,
  resolveProductionPilotCanonicalContext,
} from "../supabase/functions/dbf-business-data-api/production-pilot.ts";

const TOKEN = "x".repeat(32);
const ACTOR_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PRODUCTION_PROJECT_REF = "production-pilot-project";

function productionRuntime(overrides: Record<string, unknown> = {}) {
  return {
    hubApiUrl: "https://hub.example.test/nov-hub-api",
    supabaseUrl: `https://${PRODUCTION_PROJECT_REF}.supabase.co`,
    serviceRoleKey: "service-role-test-only",
    expectedProjectRef: PRODUCTION_PROJECT_REF,
    runtimeImport: "ENABLED",
    productionWrite: "DISABLED",
    fetchImpl: async () => new Response(JSON.stringify({
      ok: true,
      data: {
        actorEmployeeId: ACTOR_ID,
        capability: { businessDataAdmin: true },
        scope: "all",
      },
    }), { status: 200 }),
    ...overrides,
  };
}

function request(action: string, payload: unknown) {
  return new Request("https://edge.example.test", {
    method: "POST",
    headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ action, payload }),
  });
}

Deno.test("Production write actions fail closed unless the one-time pilot gate is exact", async () => {
  const response = await handleDbfBusinessDataRequest(
    request("dbfImportApproveV1", {
      batchId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      ownerConfirmation: true,
    }),
    productionRuntime() as never,
  );
  assertEquals(response.status, 503);
  assertEquals((await response.json()).code, "PRODUCTION_WRITE_DISABLED");
});

Deno.test("Production rejects non-pilot actions even when the pilot gate is enabled", async () => {
  const response = await handleDbfBusinessDataRequest(
    request("dbfCorporateAccountingPromotionPreflightV1", {}),
    productionRuntime({ productionWrite: PRODUCTION_PILOT_GATE }) as never,
  );
  assertEquals(response.status, 403);
  assertEquals((await response.json()).code, "PRODUCTION_PILOT_ACTION_REJECTED");
});

Deno.test("Production pilot start rejects a rowset that is not the sealed package", async () => {
  const response = await handleDbfBusinessDataRequest(
    request("dbfImportStartV1", {
      file: {
        sha256: "72bff469bf2d027e054176661445661fbb860a740cf30d1a937f38fb7f1946f9",
        byteSize: 1430,
        originalFileName: "2025-06-pilot-store-actual.csv",
        mediaType: "text/csv",
      },
      factKind: "store_operating_result",
      fiscalMonth: "2025-06",
      sourceType: "store_monthly_previous_year_actual",
      sourceSystem: "store-monthly-pilot-20260909",
      rawRows: [{
        sourceRowNumber: 1,
        payload: {
          fiscal_month: "2025-06",
          company_key: "0001",
          store_key: "ikebukuro",
          metric_code: "TOTAL_SALES",
          value: "1",
          definition_version: "v1",
          confirmation_status: "confirmed",
        },
        payloadSha256: "a".repeat(64),
      }],
      correctionOfBatchId: null,
      correctionReason: null,
    }),
    productionRuntime({ productionWrite: PRODUCTION_PILOT_GATE }) as never,
  );
  assertEquals(response.status, 403);
  assertEquals((await response.json()).code, "PRODUCTION_PILOT_SOURCE_REJECTED");
});

Deno.test("Canonical context binds the exact Production company and two pilot stores", () => {
  const context = resolveProductionPilotCanonicalContext({
    companies: [{
      id: "e4059116-bdb3-4e13-9763-bbc77bdfe062",
      code: "0001",
      name: "IDEA NOV",
    }],
    stores: [
      {
        id: "36c222de-0554-4265-b177-3b68285cc4a4",
        code: "ikebukuro",
        name: "BASSA池袋店",
        companyId: "e4059116-bdb3-4e13-9763-bbc77bdfe062",
      },
      {
        id: "1bcba30a-d063-4cdb-be74-425e250aeb25",
        code: "kamishakujii",
        name: "BASSA上石神井店",
        companyId: "e4059116-bdb3-4e13-9763-bbc77bdfe062",
      },
    ],
  });
  assertEquals(context.storeIds, [
    "1bcba30a-d063-4cdb-be74-425e250aeb25",
    "36c222de-0554-4265-b177-3b68285cc4a4",
  ]);
});

Deno.test("Canonical context rejects a renamed or rebound pilot store", () => {
  assertThrows(() => resolveProductionPilotCanonicalContext({
    companies: [{ id: "e4059116-bdb3-4e13-9763-bbc77bdfe062", code: "0001", name: "IDEA NOV" }],
    stores: [{
      id: "36c222de-0554-4265-b177-3b68285cc4a4",
      code: "ikebukuro",
      name: "renamed",
      companyId: "e4059116-bdb3-4e13-9763-bbc77bdfe062",
    }],
  }));
});

Deno.test("Pilot preflight accepts only the bound manifest and batch metadata", () => {
  const batch = batchFromPilotPreflight({
    manifestRef: PRODUCTION_PILOT_MANIFEST_REF,
    fileSha256: "bef80ca154226012ad44c59ce500cf91593425ed0289e5b1ef8dd16507acbac1",
    factKind: "budget",
    fiscalMonth: "2026-06",
    sourceType: "store_monthly_budget",
    rowCount: 6,
  });
  assertEquals(batch.factKind, "budget");
  assertRejects(async () => {
    batchFromPilotPreflight({
      manifestRef: "0".repeat(64),
      fileSha256: batch.fileSha256,
      factKind: batch.factKind,
      fiscalMonth: batch.fiscalMonth,
      sourceType: batch.sourceType,
      rowCount: batch.rowCount,
    });
  });
});
