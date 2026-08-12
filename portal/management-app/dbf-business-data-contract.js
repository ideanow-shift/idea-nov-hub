export const DBF_FACT_KINDS = Object.freeze(["PL", "BS", "STORE_OPERATING_RESULT", "BUDGET"]);
export const DBF_IMPORT_FLOW = Object.freeze(["UPLOAD", "PARSE", "RAW", "MAPPING", "VALIDATION", "PREVIEW", "APPROVAL", "PROMOTION", "AUDIT"]);

export const STORE_MONTHLY_METRICS = Object.freeze({
  TOTAL_SALES: "amount", TECHNICAL_SALES: "amount", RETAIL_SALES: "amount", MID_SALES: "amount",
  EC_ALLOCATED_SALES: "amount", TOTAL_CUSTOMERS: "quantity", NEW_CUSTOMERS: "quantity",
  EXISTING_CUSTOMERS: "quantity", TOTAL_UNIT_PRICE: "amount", TECHNICAL_UNIT_PRICE: "amount",
  TOTAL_REPEAT_RATE: "rate", NEW_REPEAT_RATE: "rate", SECOND_REPEAT_RATE: "rate",
  THIRD_REPEAT_RATE: "rate", FIXED_REPEAT_RATE: "rate", TOTAL_PRODUCTIVITY: "amount",
  TECHNICAL_PRODUCTIVITY: "amount", RETAIL_PURCHASE_RATE: "rate", OPERATING_PROFIT: "amount",
});

const MONTH_RE = /^20\d{2}-(0[1-9]|1[0-2])$/u;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const ACCOUNT_RE = /^[^\u0000-\u001f\u007f]{1,100}$/u;
const TERMINAL_PARSER_FAILURE = /(?:FORMAT_INVALID|MONTH_COLUMNS_INVALID|FILE_|DUPLICATE_|BALANCE_CHECK_FAILED)$/u;

function issue(ruleCode, severity = "error", rowIndex = null) {
  return Object.freeze({ ruleCode, severity, rowIndex });
}

function uuid(value) { return typeof value === "string" && UUID_RE.test(value); }
function month(value) { return typeof value === "string" && MONTH_RE.test(value); }
function finite(value) { return typeof value === "number" && Number.isFinite(value); }
function safeText(value) { return typeof value === "string" && value === value.trim() && value === value.normalize("NFC") && ACCOUNT_RE.test(value); }

export function bindCanonicalEntities(rows, mappings, options = {}) {
  const sourceSystem = String(options.sourceSystem || "");
  const index = new Map((Array.isArray(mappings) ? mappings : [])
    .filter((mapping) => mapping?.status === "active" && mapping.sourceSystem === sourceSystem)
    .map((mapping) => [`${mapping.entityType}\u0000${mapping.sourceKey}`, mapping.canonicalId]));
  const boundRows = [];
  const issues = [];
  for (const [rowIndex, source] of (Array.isArray(rows) ? rows : []).entries()) {
    const companyId = index.get(`company\u0000${source.companyKey}`) || null;
    const storeId = source.storeKey ? index.get(`store\u0000${source.storeKey}`) || null : null;
    const rowIssues = [];
    if (!uuid(companyId)) rowIssues.push(issue("UNRESOLVED_COMPANY_MAPPING", "error", rowIndex));
    if (source.storeKey && !uuid(storeId)) rowIssues.push(issue("UNRESOLVED_STORE_MAPPING", "error", rowIndex));
    issues.push(...rowIssues);
    boundRows.push(Object.freeze({ ...source, companyId, storeId, validationStatus: rowIssues.length ? "quarantined" : "pending" }));
  }
  return Object.freeze({ rows: Object.freeze(boundRows), issues: Object.freeze(issues), quarantined: issues.length > 0 });
}

export function validatePlRows(rows, parserReceipt) {
  const issues = [];
  if (!parserReceipt || parserReceipt.statement !== "PL" || TERMINAL_PARSER_FAILURE.test(String(parserReceipt.status || ""))) {
    issues.push(issue("PL_PARSER_RECEIPT_INVALID"));
  }
  for (const [rowIndex, row] of (Array.isArray(rows) ? rows : []).entries()) {
    if (!month(row.fiscalMonth)) issues.push(issue("FISCAL_MONTH_INVALID", "error", rowIndex));
    if (!uuid(row.companyId)) issues.push(issue("COMPANY_ID_INVALID", "error", rowIndex));
    if (row.storeId !== null && row.storeId !== undefined && !uuid(row.storeId)) issues.push(issue("STORE_ID_INVALID", "error", rowIndex));
    if (!safeText(row.accountCode) || !safeText(row.accountName) || !finite(row.amount)) issues.push(issue("PL_ROW_MALFORMED", "error", rowIndex));
    if (!new Set(["detail", "aggregate"]).has(row.sourceRowCategory)) issues.push(issue("PL_ROW_CATEGORY_INVALID", "error", rowIndex));
    if (row.sourceRowCategory === "aggregate" && row.storeId) issues.push(issue("PL_AGGREGATE_STORE_MIXED", "error", rowIndex));
  }
  return Object.freeze({ valid: issues.length === 0, issues: Object.freeze(issues) });
}

export function validateBsRows(rows, parserReceipt) {
  const issues = [];
  if (!parserReceipt || parserReceipt.statement !== "BS" || parserReceipt.balanceCheck !== "BALANCED") issues.push(issue("BS_IMBALANCED"));
  for (const [rowIndex, row] of (Array.isArray(rows) ? rows : []).entries()) {
    if (!month(row.fiscalMonth) || !uuid(row.companyId) || !safeText(row.accountCode) || !safeText(row.accountName) || !finite(row.amount)) {
      issues.push(issue("BS_ROW_MALFORMED", "error", rowIndex));
    }
    if (!new Set(["asset", "liability", "equity"]).has(row.classification)) issues.push(issue("BS_CLASSIFICATION_INVALID", "error", rowIndex));
    if (row.storeId) issues.push(issue("BS_STORE_SCOPE_PROHIBITED", "error", rowIndex));
  }
  return Object.freeze({ valid: issues.length === 0, issues: Object.freeze(issues) });
}

export function validateStoreMetricRows(rows) {
  const issues = [];
  for (const [rowIndex, row] of (Array.isArray(rows) ? rows : []).entries()) {
    const kind = STORE_MONTHLY_METRICS[row.metricCode];
    if (!month(row.fiscalMonth) || !uuid(row.companyId) || !uuid(row.storeId)) issues.push(issue("STORE_METRIC_SCOPE_INVALID", "error", rowIndex));
    if (!kind || !safeText(row.definitionVersion)) issues.push(issue("STORE_METRIC_DEFINITION_INVALID", "error", rowIndex));
    if (!finite(row.value)) issues.push(issue("STORE_METRIC_VALUE_INVALID", "error", rowIndex));
    if (kind === "rate" && (row.value < 0 || row.value > 1)) issues.push(issue("STORE_METRIC_RATE_INVALID", "error", rowIndex));
    if (kind === "quantity" && (!Number.isInteger(row.value) || row.value < 0)) issues.push(issue("STORE_METRIC_QUANTITY_INVALID", "error", rowIndex));
  }
  return Object.freeze({ valid: issues.length === 0, issues: Object.freeze(issues) });
}

export function validateBudgetRows(rows) {
  const issues = [];
  for (const [rowIndex, row] of (Array.isArray(rows) ? rows : []).entries()) {
    if (!month(row.fiscalMonth) || !uuid(row.companyId)) issues.push(issue("BUDGET_SCOPE_INVALID", "error", rowIndex));
    if (row.storeId && !uuid(row.storeId)) issues.push(issue("BUDGET_STORE_INVALID", "error", rowIndex));
    if (Boolean(row.metricCode) === Boolean(row.accountCode)) issues.push(issue("BUDGET_MEASURE_AMBIGUOUS", "error", rowIndex));
    if (!finite(row.amount) || !safeText(row.scenarioCode)) issues.push(issue("BUDGET_ROW_MALFORMED", "error", rowIndex));
  }
  return Object.freeze({ valid: issues.length === 0, issues: Object.freeze(issues) });
}

export function buildImportPreview({ batch, rows, validation }) {
  const quarantined = (rows || []).filter((row) => row.validationStatus === "quarantined").length;
  const errors = (validation?.issues || []).filter((item) => item.severity === "error").length + quarantined;
  return Object.freeze({
    schemaVersion: "dbf-business-data-import-preview-v1",
    batchId: batch?.id || null,
    factKind: DBF_FACT_KINDS.includes(batch?.factKind) ? batch.factKind : null,
    fiscalMonth: month(batch?.fiscalMonth) ? batch.fiscalMonth : null,
    rowCount: Array.isArray(rows) ? rows.length : 0,
    quarantinedCount: quarantined,
    errorCount: errors,
    warningCount: (validation?.issues || []).filter((item) => item.severity === "warning").length,
    promotionAllowed: Boolean(batch?.approved) && errors === 0,
  });
}

export function promoteCanonicalVersion({ batch, candidate, activeFacts }) {
  if (!batch?.approved || batch.status !== "approved") throw new Error("OWNER_APPROVAL_REQUIRED");
  if (candidate.validationStatus === "quarantined") throw new Error("QUARANTINED_ROW_PROMOTION_PROHIBITED");
  const current = (activeFacts || []).find((fact) => fact.grainKey === candidate.grainKey && fact.isActive);
  if (current && !batch.correctionOfBatchId) throw new Error("DUPLICATE_ACTIVE_VERSION");
  const nextVersion = current ? current.version + 1 : 1;
  const superseded = current ? Object.freeze({ ...current, isActive: false, supersededAt: batch.promotedAt }) : null;
  const promoted = Object.freeze({ ...candidate, batchId: batch.id, version: nextVersion, isActive: true, status: candidate.status, correctionOfFactId: current?.id || null });
  return Object.freeze({ promoted, superseded, auditEvent: Object.freeze({ batchId: batch.id, eventType: current ? "CORRECTION_PROMOTED" : "VERSION_PROMOTED" }) });
}

export function storeOperationsMonthlyFactsV1({ fiscalMonth, metricCodes, storeIds }, facts, allowedStoreIds) {
  if (!month(fiscalMonth)) throw new Error("INVALID_FISCAL_MONTH");
  const allowed = new Set(allowedStoreIds || []);
  const requestedStores = storeIds?.length ? new Set(storeIds.filter((id) => allowed.has(id))) : allowed;
  const requestedMetrics = metricCodes?.length ? new Set(metricCodes.filter((code) => STORE_MONTHLY_METRICS[code])) : new Set(Object.keys(STORE_MONTHLY_METRICS));
  const rows = (facts || []).filter((fact) => fact.fiscalMonth === fiscalMonth
    && fact.isActive === true && fact.batchStatus === "promoted"
    && requestedStores.has(fact.storeId) && requestedMetrics.has(fact.metricCode));
  return Object.freeze({
    schemaVersion: "dbf-store-operations-monthly-facts-v1",
    fiscalMonth,
    rows: Object.freeze(rows.map((fact) => Object.freeze({
      storeId: fact.storeId, metricCode: fact.metricCode, value: fact.value,
      definitionVersion: fact.definitionVersion,
      confirmationStatus: fact.status === "closed" ? "confirmed" : "provisional",
    }))),
  });
}
