import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import { DbfRuntimeError, normalizeActionPayload, toStagingRows } from "../supabase/functions/dbf-business-data-api/domain.ts";

const COMPANY = "11111111-1111-4111-8111-111111111111";
const STORE = "22222222-2222-4222-8222-222222222222";
const COMPANY_MAPPING = "33333333-3333-4333-8333-333333333333";
const STORE_MAPPING = "44444444-4444-4444-8444-444444444444";

Deno.test("Phase C validates PL detail and keeps canonical UUID mappings", () => {
  const result: any = normalizeActionPayload("dbfImportValidateV1", {
    batchId: "55555555-5555-4555-8555-555555555555",
    factKind: "pl",
    fiscalMonth: "2026-07",
    parserReceipt: { statement: "PL", status: "PARSED", balanceCheck: null, parserVersion: "yayoi-xlsx-v1" },
    rows: [{ sourceRowNumber: 1, fiscalMonth: "2026-07", companyId: COMPANY, storeId: STORE,
      companyMappingId: COMPANY_MAPPING, storeMappingId: STORE_MAPPING, accountCode: "4000",
      accountName: "売上高", amount: 1000, sourceRowCategory: "detail", aggregateScope: null,
      confirmationStatus: "confirmed" }],
    warnings: [],
  });
  assertEquals(result.fiscalMonth, "2026-07-01");
  assertEquals(toStagingRows(result.rows)[0], {
    sourceRowNumber: 1, companyMappingId: COMPANY_MAPPING, storeMappingId: STORE_MAPPING,
    companyId: COMPANY, storeId: STORE, employeeId: null, organizationId: null,
    accountCode: "4000", accountName: "売上高", metricCode: null, amount: 1000,
    quantity: null, rate: null, sourceRowCategory: "detail", mappingStatus: "resolved",
    validationStatus: "valid", normalizedPayload: { aggregateScope: null, confirmationStatus: "confirmed" },
  });
});

Deno.test("unbalanced B/S fails before staging", async () => {
  await assertRejects(async () => normalizeActionPayload("dbfImportValidateV1", {
    batchId: "55555555-5555-4555-8555-555555555555", factKind: "bs", fiscalMonth: "2026-07",
    parserReceipt: { statement: "BS", status: "PARSED", balanceCheck: "IMBALANCED", parserVersion: "yayoi-xlsx-v1" },
    rows: [], warnings: [],
  }), DbfRuntimeError, "BS_BALANCE_CHECK_FAILED");
});

Deno.test("backend recalculates B/S balance instead of trusting parser receipt", async () => {
  await assertRejects(async () => normalizeActionPayload("dbfImportValidateV1", {
    batchId: "55555555-5555-4555-8555-555555555555", factKind: "bs", fiscalMonth: "2026-07",
    parserReceipt: { statement: "BS", status: "PARSED", balanceCheck: "BALANCED", parserVersion: "dbf-normalized-csv-v1" },
    rows: [
      { sourceRowNumber: 1, fiscalMonth: "2026-07", companyId: COMPANY, storeId: null,
        companyMappingId: COMPANY_MAPPING, storeMappingId: null, accountCode: "1000", accountName: "Assets",
        amount: 100, classification: "asset", confirmationStatus: "confirmed" },
      { sourceRowNumber: 2, fiscalMonth: "2026-07", companyId: COMPANY, storeId: null,
        companyMappingId: COMPANY_MAPPING, storeMappingId: null, accountCode: "2000", accountName: "Liabilities",
        amount: 90, classification: "liability", confirmationStatus: "confirmed" },
    ], warnings: [],
  }), DbfRuntimeError, "BS_BALANCE_CHECK_FAILED");
});

Deno.test("store metrics reject out-of-range rates", async () => {
  await assertRejects(async () => normalizeActionPayload("dbfImportValidateV1", {
    batchId: "55555555-5555-4555-8555-555555555555", factKind: "store_operating_result", fiscalMonth: "2026-07",
    parserReceipt: { statement: "STORE_OPERATING_RESULT", status: "PARSED", balanceCheck: null, parserVersion: "store-csv-v1" },
    rows: [{ sourceRowNumber: 1, fiscalMonth: "2026-07", companyId: COMPANY, storeId: STORE,
      companyMappingId: COMPANY_MAPPING, storeMappingId: STORE_MAPPING, metricCode: "TOTAL_REPEAT_RATE",
      value: 1.5, definitionVersion: "v1", confirmationStatus: "provisional" }], warnings: [],
  }), DbfRuntimeError, "STORE_METRIC_RATE_INVALID");
});

Deno.test("frontend authorization fields cannot spoof backend capability", async () => {
  await assertRejects(async () => normalizeActionPayload("dbfImportApproveV1", {
    batchId: "55555555-5555-4555-8555-555555555555", ownerConfirmation: true,
    businessDataAdmin: true,
  }), DbfRuntimeError, "UNEXPECTED_FIELD");
});

Deno.test("budget rejects organization scope until a Canonical Organization binding is implemented", async () => {
  await assertRejects(async () => normalizeActionPayload("dbfImportValidateV1", {
    batchId: "55555555-5555-4555-8555-555555555555", factKind: "budget", fiscalMonth: "2026-07",
    parserReceipt: { statement: "BUDGET", status: "PARSED", balanceCheck: null, parserVersion: "dbf-normalized-csv-v1" },
    rows: [{ sourceRowNumber: 1, fiscalMonth: "2026-07", companyId: COMPANY, storeId: null,
      companyMappingId: COMPANY_MAPPING, storeMappingId: null,
      organizationId: "66666666-6666-4666-8666-666666666666", scenarioCode: "base",
      accountCode: "4000", metricCode: null, amount: 1000, confirmationStatus: "confirmed" }], warnings: [],
  }), DbfRuntimeError, "BUDGET_ORGANIZATION_SCOPE_UNSUPPORTED");
});

Deno.test("duplicate Canonical grain is rejected before staging", async () => {
  const row = { fiscalMonth: "2026-07", companyId: COMPANY, storeId: STORE,
    companyMappingId: COMPANY_MAPPING, storeMappingId: STORE_MAPPING, metricCode: "TOTAL_SALES",
    value: 1000, definitionVersion: "v1", confirmationStatus: "confirmed" };
  await assertRejects(async () => normalizeActionPayload("dbfImportValidateV1", {
    batchId: "55555555-5555-4555-8555-555555555555", factKind: "store_operating_result", fiscalMonth: "2026-07",
    parserReceipt: { statement: "STORE_OPERATING_RESULT", status: "PARSED", balanceCheck: null, parserVersion: "dbf-normalized-csv-v1" },
    rows: [{ ...row, sourceRowNumber: 1 }, { ...row, sourceRowNumber: 2 }], warnings: [],
  }), DbfRuntimeError, "CANONICAL_GRAIN_DUPLICATE");
});

Deno.test("mapping confirmation accepts only Phase 1 master UUIDs and no browser evidence digest", async () => {
  const result: any = normalizeActionPayload("dbfImportConfirmMappingV1", {
    batchId: "55555555-5555-4555-8555-555555555555",
    sourceSystem: "pilot-csv-v1",
    entityType: "store",
    sourceKey: "0001",
    canonicalId: STORE,
    companyCanonicalId: COMPANY,
  });
  assertEquals(result.canonicalId, STORE);
  assertEquals(result.companyCanonicalId, COMPANY);
  await assertRejects(async () => normalizeActionPayload("dbfImportConfirmMappingV1", {
    batchId: "55555555-5555-4555-8555-555555555555",
    sourceSystem: "pilot-csv-v1",
    entityType: "store",
    sourceKey: "0001",
    canonicalId: STORE,
    companyCanonicalId: COMPANY,
    canonicalEvidenceSha256: "a".repeat(64),
  }), DbfRuntimeError, "UNEXPECTED_FIELD");
});

Deno.test("Pilot 2026-06 Preview accepts only bounded read-only sections", async () => {
  const result: any = normalizeActionPayload("dbfPilotMonthPreviewV1", {
    fiscalMonth: "2026-06",
    section: "reconciliation",
  });
  assertEquals(result, { fiscalMonth: "2026-06-01", section: "reconciliation" });
  await assertRejects(async () => normalizeActionPayload("dbfPilotMonthPreviewV1", {
    fiscalMonth: "2026-06",
    section: "raw_rows",
  }), DbfRuntimeError, "PILOT_PREVIEW_SECTION_INVALID");
  await assertRejects(async () => normalizeActionPayload("dbfPilotMonthPreviewV1", {
    fiscalMonth: "2026-06",
    section: "all",
    promote: true,
  }), DbfRuntimeError, "UNEXPECTED_FIELD");
});

Deno.test("Account review list accepts the exact Pilot company and normalized 2026-06 month", () => {
  const result: any = normalizeActionPayload("dbfAccountReviewListV1", {
    companyId: "e4059116-bdb3-4e13-9763-bbc77bdfe062",
    fiscalMonth: "2026-06",
  });
  assertEquals(result, {
    companyId: "e4059116-bdb3-4e13-9763-bbc77bdfe062",
    fiscalMonth: "2026-06",
  });
});

Deno.test("Account review list rejects a non-Pilot company or month", async () => {
  await assertRejects(async () => normalizeActionPayload("dbfAccountReviewListV1", {
    companyId: COMPANY,
    fiscalMonth: "2026-06",
  }), DbfRuntimeError, "COMPANY_SCOPE_REJECTED");
  await assertRejects(async () => normalizeActionPayload("dbfAccountReviewListV1", {
    companyId: "e4059116-bdb3-4e13-9763-bbc77bdfe062",
    fiscalMonth: "2026-07",
  }), DbfRuntimeError, "COMPANY_SCOPE_REJECTED");
});

Deno.test("account review derives an exact fail-closed semantics contract", async () => {
  const base = {
    candidateId: "77777777-7777-4777-8777-777777777777",
    requestId: "88888888-8888-4888-8888-888888888888",
    decision: "APPROVE",
    proposedAccountCode: "PL.TEST",
    proposedAccountName: "Test account",
    accountCategory: "revenue",
    normalBalance: "credit",
    parentCandidateId: null,
    hierarchyLevel: 1,
    rowSemantics: "DERIVED_SUBTOTAL",
    isPostable: false,
    isControlTotal: false,
  };
  const valid: any = normalizeActionPayload("dbfAccountReviewDecideV1", base);
  assertEquals(valid.rowSemantics, "DERIVED_SUBTOTAL");
  assertEquals(valid.isPostable, false);
  assertEquals(valid.isControlTotal, false);

  await assertRejects(async () => normalizeActionPayload("dbfAccountReviewDecideV1", {
    ...base,
    isPostable: true,
  }), DbfRuntimeError, "ROW_SEMANTICS_FLAGS_MISMATCH");

  await assertRejects(async () => normalizeActionPayload("dbfAccountReviewDecideV1", {
    ...base,
    rowSemantics: "NEEDS_OWNER_REVIEW",
  }), DbfRuntimeError, "APPROVAL_FIELDS_REQUIRED");
});
