export const DBF_IMPORT_ACTIONS = Object.freeze([
  "dbfImportStartV1",
  "dbfImportResolveMappingsV1",
  "dbfImportQuarantineMappingsV1",
  "dbfImportConfirmMappingV1",
  "dbfImportValidateV1",
  "dbfImportPreviewV1",
  "dbfImportApproveV1",
  "dbfImportPromoteV1",
  "dbfImportHistoryV1",
  "dbfImportMasterOptionsV1",
  "dbfPilotMonthPreviewV1",
  "dbfAccountReviewInitializeV1",
  "dbfAccountReviewListV1",
  "dbfAccountReviewDecideV1",
] as const);

export type DbfImportAction = typeof DBF_IMPORT_ACTIONS[number];
export type FactKind = "pl" | "bs" | "store_operating_result" | "budget";

export const STORE_METRIC_KINDS = Object.freeze({
  TOTAL_SALES: "amount", TECHNICAL_SALES: "amount", RETAIL_SALES: "amount", MID_SALES: "amount",
  EC_ALLOCATED_SALES: "amount", TOTAL_CUSTOMERS: "quantity", NEW_CUSTOMERS: "quantity",
  EXISTING_CUSTOMERS: "quantity", TOTAL_UNIT_PRICE: "amount", TECHNICAL_UNIT_PRICE: "amount",
  TOTAL_REPEAT_RATE: "rate", NEW_REPEAT_RATE: "rate", SECOND_REPEAT_RATE: "rate",
  THIRD_REPEAT_RATE: "rate", FIXED_REPEAT_RATE: "rate", TOTAL_PRODUCTIVITY: "amount",
  TECHNICAL_PRODUCTIVITY: "amount", RETAIL_PURCHASE_RATE: "rate", OPERATING_PROFIT: "amount",
} as const);

const ACTION_SET = new Set<string>(DBF_IMPORT_ACTIONS);
const FACT_KIND_SET = new Set<FactKind>(["pl", "bs", "store_operating_result", "budget"]);
const MONTH = /^20\d{2}-(0[1-9]|1[0-2])$/u;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA256 = /^[0-9a-f]{64}$/u;
const SAFE_TEXT = /^[^\u0000-\u001f\u007f]{1,160}$/u;
const PILOT_COMPANY_ID = "e4059116-bdb3-4e13-9763-bbc77bdfe062";

export class DbfRuntimeError extends Error {
  constructor(public code: string, public status = 400) {
    super(code);
  }
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new DbfRuntimeError("INVALID_OBJECT");
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[]) {
  const allow = new Set(allowed);
  if (Object.keys(value).some((key) => !allow.has(key))) throw new DbfRuntimeError("UNEXPECTED_FIELD");
}

function safeText(value: unknown, code: string, max = 160) {
  const text = String(value ?? "");
  if (!SAFE_TEXT.test(text) || text !== text.trim() || text !== text.normalize("NFC") || text.length > max) {
    throw new DbfRuntimeError(code);
  }
  return text;
}

function optionalSafeText(value: unknown, code: string, max = 160) {
  return value === null || value === undefined || value === "" ? null : safeText(value, code, max);
}

function uuid(value: unknown, code: string) {
  const text = String(value ?? "");
  if (!UUID.test(text) || text === "00000000-0000-0000-0000-000000000000") throw new DbfRuntimeError(code);
  return text.toLowerCase();
}

function optionalUuid(value: unknown, code: string) {
  return value === null || value === undefined || value === "" ? null : uuid(value, code);
}

function number(value: unknown, code: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new DbfRuntimeError(code);
  return value;
}

function fiscalMonth(value: unknown) {
  const text = String(value ?? "");
  if (!MONTH.test(text)) throw new DbfRuntimeError("INVALID_FISCAL_MONTH");
  return `${text}-01`;
}

function boundedArray(value: unknown, code: string, max = 10_000) {
  if (!Array.isArray(value) || value.length === 0 || value.length > max) throw new DbfRuntimeError(code);
  return value;
}

function normalizeRawRows(value: unknown) {
  const seen = new Set<number>();
  return boundedArray(value, "RAW_ROWS_INVALID").map((candidate) => {
    const row = object(candidate);
    exactKeys(row, ["sourceRowNumber", "payload", "payloadSha256"]);
    const sourceRowNumber = Number(row.sourceRowNumber);
    if (!Number.isInteger(sourceRowNumber) || sourceRowNumber < 1 || seen.has(sourceRowNumber)) {
      throw new DbfRuntimeError("SOURCE_ROW_NUMBER_INVALID");
    }
    seen.add(sourceRowNumber);
    const payload = object(row.payload);
    const payloadSha256 = String(row.payloadSha256 ?? "").toLowerCase();
    if (!SHA256.test(payloadSha256)) throw new DbfRuntimeError("RAW_ROW_DIGEST_INVALID");
    return { sourceRowNumber, payload, payloadSha256 };
  });
}

function normalizeParserReceipt(value: unknown, factKind: FactKind) {
  const receipt = object(value);
  exactKeys(receipt, ["statement", "status", "balanceCheck", "parserVersion"]);
  const expected = factKind === "pl" ? "PL" : factKind === "bs" ? "BS" : factKind === "budget" ? "BUDGET" : "STORE_OPERATING_RESULT";
  if (String(receipt.statement || "") !== expected || String(receipt.status || "") !== "PARSED") {
    throw new DbfRuntimeError("PARSER_RECEIPT_INVALID");
  }
  if (factKind === "bs" && String(receipt.balanceCheck || "") !== "BALANCED") {
    throw new DbfRuntimeError("BS_BALANCE_CHECK_FAILED");
  }
  return {
    statement: expected,
    status: "PARSED",
    balanceCheck: factKind === "bs" ? "BALANCED" : null,
    parserVersion: safeText(receipt.parserVersion, "PARSER_VERSION_INVALID", 80),
  };
}

function normalizeRowBase(row: Record<string, unknown>, fiscalMonthValue: string) {
  if (fiscalMonth(row.fiscalMonth) !== fiscalMonthValue) throw new DbfRuntimeError("ROW_MONTH_MISMATCH");
  const sourceRowNumber = Number(row.sourceRowNumber);
  if (!Number.isInteger(sourceRowNumber) || sourceRowNumber < 1) throw new DbfRuntimeError("SOURCE_ROW_NUMBER_INVALID");
  return {
    sourceRowNumber,
    companyId: uuid(row.companyId, "COMPANY_ID_INVALID"),
    storeId: optionalUuid(row.storeId, "STORE_ID_INVALID"),
    companyMappingId: uuid(row.companyMappingId, "COMPANY_MAPPING_ID_INVALID"),
    storeMappingId: optionalUuid(row.storeMappingId, "STORE_MAPPING_ID_INVALID"),
  };
}

function normalizeValidatedRows(value: unknown, factKind: FactKind, monthValue: string) {
  const seen = new Set<number>();
  const rows = boundedArray(value, "VALIDATED_ROWS_INVALID").map((candidate) => {
    const row = object(candidate);
    const base = normalizeRowBase(row, monthValue);
    if (seen.has(base.sourceRowNumber)) throw new DbfRuntimeError("SOURCE_ROW_NUMBER_DUPLICATE");
    seen.add(base.sourceRowNumber);
    if (Boolean(base.storeId) !== Boolean(base.storeMappingId)) throw new DbfRuntimeError("STORE_MAPPING_BINDING_INVALID");

    if (factKind === "pl") {
      exactKeys(row, ["sourceRowNumber", "fiscalMonth", "companyId", "storeId", "companyMappingId", "storeMappingId", "accountCode", "accountName", "amount", "sourceRowCategory", "aggregateScope", "confirmationStatus"]);
      const sourceRowCategory = String(row.sourceRowCategory || "");
      if (!new Set(["detail", "aggregate"]).has(sourceRowCategory)) throw new DbfRuntimeError("PL_ROW_CATEGORY_INVALID");
      const aggregateScope = optionalSafeText(row.aggregateScope, "PL_AGGREGATE_SCOPE_INVALID", 40);
      if (sourceRowCategory === "aggregate" && (base.storeId || !new Set(["head_office", "company_total"]).has(String(aggregateScope)))) {
        throw new DbfRuntimeError("PL_AGGREGATE_SCOPE_INVALID");
      }
      if (sourceRowCategory === "detail" && aggregateScope) throw new DbfRuntimeError("PL_DETAIL_SCOPE_INVALID");
      return { ...base, accountCode: safeText(row.accountCode, "PL_ACCOUNT_CODE_INVALID", 100), accountName: safeText(row.accountName, "PL_ACCOUNT_NAME_INVALID", 160), amount: number(row.amount, "PL_AMOUNT_INVALID"), sourceRowCategory, normalizedPayload: { aggregateScope, confirmationStatus: confirmationStatus(row.confirmationStatus) } };
    }

    if (factKind === "bs") {
      exactKeys(row, ["sourceRowNumber", "fiscalMonth", "companyId", "storeId", "companyMappingId", "storeMappingId", "accountCode", "accountName", "amount", "classification", "confirmationStatus"]);
      if (base.storeId) throw new DbfRuntimeError("BS_STORE_SCOPE_PROHIBITED");
      const classification = String(row.classification || "");
      if (!new Set(["asset", "liability", "equity"]).has(classification)) throw new DbfRuntimeError("BS_CLASSIFICATION_INVALID");
      return { ...base, accountCode: safeText(row.accountCode, "BS_ACCOUNT_CODE_INVALID", 100), accountName: safeText(row.accountName, "BS_ACCOUNT_NAME_INVALID", 160), amount: number(row.amount, "BS_AMOUNT_INVALID"), sourceRowCategory: "detail", normalizedPayload: { classification, confirmationStatus: confirmationStatus(row.confirmationStatus) } };
    }

    if (factKind === "store_operating_result") {
      exactKeys(row, ["sourceRowNumber", "fiscalMonth", "companyId", "storeId", "companyMappingId", "storeMappingId", "metricCode", "value", "definitionVersion", "confirmationStatus"]);
      if (!base.storeId || !base.storeMappingId) throw new DbfRuntimeError("STORE_SCOPE_REQUIRED");
      const metricCode = String(row.metricCode || "") as keyof typeof STORE_METRIC_KINDS;
      const valueKind = STORE_METRIC_KINDS[metricCode];
      if (!valueKind) throw new DbfRuntimeError("STORE_METRIC_CODE_INVALID");
      const metricValue = number(row.value, "STORE_METRIC_VALUE_INVALID");
      if (valueKind === "quantity" && (!Number.isInteger(metricValue) || metricValue < 0)) throw new DbfRuntimeError("STORE_METRIC_QUANTITY_INVALID");
      if (valueKind === "rate" && (metricValue < 0 || metricValue > 1)) throw new DbfRuntimeError("STORE_METRIC_RATE_INVALID");
      const definitionVersion = safeText(row.definitionVersion, "METRIC_DEFINITION_VERSION_INVALID", 80);
      if (definitionVersion !== "v1") throw new DbfRuntimeError("METRIC_DEFINITION_VERSION_INVALID");
      return { ...base, metricCode, [valueKind]: metricValue, sourceRowCategory: "detail", normalizedPayload: { definitionVersion, confirmationStatus: confirmationStatus(row.confirmationStatus) } };
    }

    exactKeys(row, ["sourceRowNumber", "fiscalMonth", "companyId", "storeId", "companyMappingId", "storeMappingId", "organizationId", "scenarioCode", "accountCode", "metricCode", "amount", "confirmationStatus"]);
    const accountCode = optionalSafeText(row.accountCode, "BUDGET_ACCOUNT_CODE_INVALID", 100);
    const metricCode = optionalSafeText(row.metricCode, "BUDGET_METRIC_CODE_INVALID", 100);
    if (Boolean(accountCode) === Boolean(metricCode)) throw new DbfRuntimeError("BUDGET_MEASURE_AMBIGUOUS");
    if (row.organizationId !== null && row.organizationId !== undefined && row.organizationId !== "") {
      throw new DbfRuntimeError("BUDGET_ORGANIZATION_SCOPE_UNSUPPORTED");
    }
    return { ...base, organizationId: null, accountCode, metricCode, amount: number(row.amount, "BUDGET_AMOUNT_INVALID"), sourceRowCategory: "detail", normalizedPayload: { scenarioCode: safeText(row.scenarioCode, "BUDGET_SCENARIO_INVALID", 80), confirmationStatus: confirmationStatus(row.confirmationStatus) } };
  });

  const grains = new Set<string>();
  for (const normalizedRow of rows) {
    const row = normalizedRow as {
      companyId: string;
      storeId: string | null;
      sourceRowCategory: string;
      accountCode?: string | null;
      metricCode?: string | null;
      normalizedPayload: { aggregateScope?: string | null; scenarioCode?: string };
    };
    const grain = factKind === "pl"
      ? row.sourceRowCategory === "aggregate"
        ? ["pl_aggregate", row.companyId, row.normalizedPayload.aggregateScope, row.accountCode]
        : ["pl_detail", row.companyId, row.storeId, row.accountCode]
      : factKind === "bs"
      ? ["bs", row.companyId, row.accountCode]
      : factKind === "store_operating_result"
      ? ["store_operating_result", row.companyId, row.storeId, row.metricCode]
      : ["budget", row.companyId, row.storeId, row.normalizedPayload.scenarioCode, row.accountCode, row.metricCode];
    const key = JSON.stringify(grain);
    if (grains.has(key)) throw new DbfRuntimeError("CANONICAL_GRAIN_DUPLICATE");
    grains.add(key);
  }
  return rows;
}

function confirmationStatus(value: unknown) {
  const text = String(value || "provisional");
  if (!new Set(["provisional", "confirmed"]).has(text)) throw new DbfRuntimeError("CONFIRMATION_STATUS_INVALID");
  return text;
}

export function parseAction(value: unknown): DbfImportAction {
  const action = String(value || "");
  if (!ACTION_SET.has(action)) throw new DbfRuntimeError("ACTION_NOT_FOUND", 404);
  return action as DbfImportAction;
}

export function normalizeActionPayload(action: DbfImportAction, value: unknown) {
  const payload = object(value || {});
  if (action === "dbfImportStartV1") {
    exactKeys(payload, ["file", "factKind", "fiscalMonth", "sourceType", "sourceSystem", "rawRows", "correctionOfBatchId", "correctionReason"]);
    const file = object(payload.file);
    exactKeys(file, ["sha256", "byteSize", "originalFileName", "mediaType"]);
    const factKind = String(payload.factKind || "") as FactKind;
    if (!FACT_KIND_SET.has(factKind)) throw new DbfRuntimeError("FACT_KIND_INVALID");
    const sha256 = String(file.sha256 || "").toLowerCase();
    if (!SHA256.test(sha256)) throw new DbfRuntimeError("SOURCE_FILE_DIGEST_INVALID");
    const byteSize = Number(file.byteSize);
    if (!Number.isSafeInteger(byteSize) || byteSize < 1 || byteSize > 25_000_000) throw new DbfRuntimeError("SOURCE_FILE_SIZE_INVALID");
    const correctionOfBatchId = optionalUuid(payload.correctionOfBatchId, "CORRECTION_BATCH_ID_INVALID");
    const correctionReason = optionalSafeText(payload.correctionReason, "CORRECTION_REASON_INVALID", 500);
    if (Boolean(correctionOfBatchId) !== Boolean(correctionReason)) throw new DbfRuntimeError("CORRECTION_LINEAGE_INVALID");
    return { file: { sha256, byteSize, originalFileName: safeText(file.originalFileName, "SOURCE_FILE_NAME_INVALID", 255), mediaType: safeText(file.mediaType, "SOURCE_FILE_MEDIA_TYPE_INVALID", 100) }, factKind, fiscalMonth: fiscalMonth(payload.fiscalMonth), sourceType: safeText(payload.sourceType, "SOURCE_TYPE_INVALID", 80), sourceSystem: safeText(payload.sourceSystem, "SOURCE_SYSTEM_INVALID", 80), rawRows: normalizeRawRows(payload.rawRows), correctionOfBatchId, correctionReason };
  }
  if (action === "dbfImportValidateV1") {
    exactKeys(payload, ["batchId", "factKind", "fiscalMonth", "parserReceipt", "rows", "warnings"]);
    const factKind = String(payload.factKind || "") as FactKind;
    if (!FACT_KIND_SET.has(factKind)) throw new DbfRuntimeError("FACT_KIND_INVALID");
    const monthValue = fiscalMonth(payload.fiscalMonth);
    const warnings = Array.isArray(payload.warnings) ? payload.warnings.map((item) => safeText(item, "WARNING_CODE_INVALID", 100)).slice(0, 100) : [];
    const parserReceipt = normalizeParserReceipt(payload.parserReceipt, factKind);
    const rows = normalizeValidatedRows(payload.rows, factKind, monthValue);
    if (factKind === "bs") {
      const totals = rows.reduce((sum, row: any) => {
        const classification = String(row.normalizedPayload?.classification || "");
        sum[classification] = (sum[classification] || 0) + Number(row.amount || 0);
        return sum;
      }, {} as Record<string, number>);
      if (Math.abs(Number(totals.asset || 0) - Number(totals.liability || 0) - Number(totals.equity || 0)) > 0.005) {
        throw new DbfRuntimeError("BS_BALANCE_CHECK_FAILED");
      }
    }
    return { batchId: uuid(payload.batchId, "BATCH_ID_INVALID"), factKind, fiscalMonth: monthValue, parserReceipt, rows, warnings };
  }
  if (action === "dbfImportResolveMappingsV1") {
    exactKeys(payload, ["sourceSystem", "requests"]);
    const requests = boundedArray(payload.requests, "MAPPING_REQUESTS_INVALID", 2000).map((candidate) => {
      const request = object(candidate);
      exactKeys(request, ["entityType", "sourceKey"]);
      const entityType = String(request.entityType || "");
      if (!new Set(["company", "store"]).has(entityType)) throw new DbfRuntimeError("MAPPING_ENTITY_TYPE_INVALID");
      return { entityType, sourceKey: safeText(request.sourceKey, "MAPPING_SOURCE_KEY_INVALID", 200) };
    });
    return { sourceSystem: safeText(payload.sourceSystem, "SOURCE_SYSTEM_INVALID", 80), requests };
  }
  if (action === "dbfImportQuarantineMappingsV1") {
    exactKeys(payload, ["batchId", "sourceSystem", "mappings"]);
    const mappings = boundedArray(payload.mappings, "MAPPINGS_INVALID", 2000).map((candidate) => {
      const mapping = object(candidate);
      exactKeys(mapping, ["entityType", "sourceKey", "sourceLabel"]);
      const entityType = String(mapping.entityType || "");
      if (!new Set(["company", "store"]).has(entityType)) throw new DbfRuntimeError("MAPPING_ENTITY_TYPE_INVALID");
      return { entityType, sourceKey: safeText(mapping.sourceKey, "MAPPING_SOURCE_KEY_INVALID", 200), sourceLabel: optionalSafeText(mapping.sourceLabel, "MAPPING_SOURCE_LABEL_INVALID", 200) };
    });
    return { batchId: uuid(payload.batchId, "BATCH_ID_INVALID"), sourceSystem: safeText(payload.sourceSystem, "SOURCE_SYSTEM_INVALID", 80), mappings };
  }
  if (action === "dbfImportConfirmMappingV1") {
    exactKeys(payload, ["batchId", "sourceSystem", "entityType", "sourceKey", "canonicalId", "companyCanonicalId"]);
    const entityType = String(payload.entityType || "");
    if (!new Set(["company", "store"]).has(entityType)) throw new DbfRuntimeError("MAPPING_ENTITY_TYPE_INVALID");
    const companyCanonicalId = optionalUuid(payload.companyCanonicalId, "COMPANY_CANONICAL_ID_INVALID");
    if ((entityType === "store") !== Boolean(companyCanonicalId)) throw new DbfRuntimeError("MAPPING_PARENT_COMPANY_INVALID");
    return { batchId: uuid(payload.batchId, "BATCH_ID_INVALID"), sourceSystem: safeText(payload.sourceSystem, "SOURCE_SYSTEM_INVALID", 80), entityType, sourceKey: safeText(payload.sourceKey, "MAPPING_SOURCE_KEY_INVALID", 200), canonicalId: uuid(payload.canonicalId, "CANONICAL_ID_INVALID"), companyCanonicalId };
  }
  if (action === "dbfImportApproveV1") {
    exactKeys(payload, ["batchId", "ownerConfirmation"]);
    if (payload.ownerConfirmation !== true) throw new DbfRuntimeError("OWNER_CONFIRMATION_REQUIRED");
    return { batchId: uuid(payload.batchId, "BATCH_ID_INVALID") };
  }
  if (action === "dbfImportPromoteV1") {
    exactKeys(payload, ["batchId"]);
    return { batchId: uuid(payload.batchId, "BATCH_ID_INVALID") };
  }
  if (action === "dbfImportPreviewV1") {
    exactKeys(payload, ["batchId"]);
    return { batchId: uuid(payload.batchId, "BATCH_ID_INVALID") };
  }
  if (action === "dbfImportMasterOptionsV1") {
    exactKeys(payload, []);
    return {};
  }
  if (action === "dbfPilotMonthPreviewV1") {
    exactKeys(payload, ["fiscalMonth", "section"]);
    const section = String(payload.section || "all");
    if (!new Set(["all", "source", "batches", "validation", "reconciliation", "summary", "detail"]).has(section)) {
      throw new DbfRuntimeError("PILOT_PREVIEW_SECTION_INVALID");
    }
    return { fiscalMonth: fiscalMonth(payload.fiscalMonth), section };
  }
  if (action === "dbfAccountReviewInitializeV1") {
    exactKeys(payload, ["companyId", "mappingVersion", "mappingDigest"]);
    const mappingDigest = String(payload.mappingDigest || "").toLowerCase();
    if (!SHA256.test(mappingDigest)) throw new DbfRuntimeError("MAPPING_DIGEST_INVALID");
    const companyId = uuid(payload.companyId, "COMPANY_ID_INVALID");
    if (companyId !== PILOT_COMPANY_ID) throw new DbfRuntimeError("COMPANY_SCOPE_REJECTED", 403);
    return { companyId, mappingVersion: safeText(payload.mappingVersion, "MAPPING_VERSION_INVALID", 128), mappingDigest };
  }
  if (action === "dbfAccountReviewListV1") {
    exactKeys(payload, ["companyId", "fiscalMonth"]);
    const companyId = uuid(payload.companyId, "COMPANY_ID_INVALID");
    if (companyId !== PILOT_COMPANY_ID || fiscalMonth(payload.fiscalMonth) !== "2026-06-01") throw new DbfRuntimeError("COMPANY_SCOPE_REJECTED", 403);
    return { companyId, fiscalMonth: "2026-06" };
  }
  if (action === "dbfAccountReviewDecideV1") {
    exactKeys(payload, ["candidateId", "requestId", "decision", "proposedAccountCode", "proposedAccountName", "accountCategory", "normalBalance", "parentCandidateId", "hierarchyLevel", "rowSemantics", "isPostable", "isControlTotal"]);
    const decision = String(payload.decision || "");
    if (!new Set(["APPROVE", "EDIT_AND_APPROVE", "EXCLUDE", "NEEDS_REVIEW"]).has(decision)) throw new DbfRuntimeError("DECISION_INVALID");
    const rowSemantics = payload.rowSemantics === null ? null : String(payload.rowSemantics || "");
    if (rowSemantics !== null && !new Set(["POSTABLE_DETAIL", "DERIVED_SUBTOTAL", "CONTROL_TOTAL", "DISPLAY_ONLY", "NEEDS_OWNER_REVIEW"]).has(rowSemantics)) throw new DbfRuntimeError("ROW_SEMANTICS_INVALID");
    const hierarchyLevel = payload.hierarchyLevel === null ? null : Number(payload.hierarchyLevel);
    if (hierarchyLevel !== null && (!Number.isInteger(hierarchyLevel) || hierarchyLevel < 0 || hierarchyLevel > 32)) throw new DbfRuntimeError("HIERARCHY_LEVEL_INVALID");
    return {
      candidateId: uuid(payload.candidateId, "CANDIDATE_ID_INVALID"), requestId: uuid(payload.requestId, "REQUEST_ID_INVALID"), decision,
      proposedAccountCode: optionalSafeText(payload.proposedAccountCode, "ACCOUNT_CODE_INVALID", 64),
      proposedAccountName: optionalSafeText(payload.proposedAccountName, "ACCOUNT_NAME_INVALID", 256),
      accountCategory: optionalSafeText(payload.accountCategory, "ACCOUNT_CATEGORY_INVALID", 64),
      normalBalance: optionalSafeText(payload.normalBalance, "NORMAL_BALANCE_INVALID", 16),
      parentCandidateId: optionalUuid(payload.parentCandidateId, "PARENT_CANDIDATE_ID_INVALID"), hierarchyLevel, rowSemantics,
      isPostable: typeof payload.isPostable === "boolean" ? payload.isPostable : null,
      isControlTotal: typeof payload.isControlTotal === "boolean" ? payload.isControlTotal : null,
    };
  }
  exactKeys(payload, ["fiscalMonth", "factKind", "limit"]);
  const factKind = payload.factKind ? String(payload.factKind) as FactKind : null;
  if (factKind && !FACT_KIND_SET.has(factKind)) throw new DbfRuntimeError("FACT_KIND_INVALID");
  const limit = payload.limit === undefined ? 50 : Number(payload.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw new DbfRuntimeError("LIMIT_INVALID");
  return { fiscalMonth: payload.fiscalMonth ? fiscalMonth(payload.fiscalMonth) : null, factKind, limit };
}

export function toStagingRows(rows: Array<Record<string, unknown>>) {
  return rows.map((row) => ({
    sourceRowNumber: row.sourceRowNumber,
    companyMappingId: row.companyMappingId,
    storeMappingId: row.storeMappingId,
    companyId: row.companyId,
    storeId: row.storeId,
    employeeId: row.employeeId ?? null,
    organizationId: row.organizationId ?? null,
    accountCode: row.accountCode ?? null,
    accountName: row.accountName ?? null,
    metricCode: row.metricCode ?? null,
    amount: row.amount ?? null,
    quantity: row.quantity ?? null,
    rate: row.rate ?? null,
    sourceRowCategory: row.sourceRowCategory,
    mappingStatus: "resolved",
    validationStatus: "valid",
    normalizedPayload: row.normalizedPayload ?? {},
  }));
}
