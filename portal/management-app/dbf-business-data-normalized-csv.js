const FACT_HEADERS = Object.freeze({
  pl: Object.freeze(["fiscal_month", "company_key", "store_key", "account_code", "account_name", "amount", "source_row_category", "aggregate_scope", "confirmation_status"]),
  bs: Object.freeze(["fiscal_month", "company_key", "account_code", "account_name", "amount", "classification", "confirmation_status"]),
  store_operating_result: Object.freeze(["fiscal_month", "company_key", "store_key", "metric_code", "value", "definition_version", "confirmation_status"]),
  budget: Object.freeze(["fiscal_month", "company_key", "store_key", "scenario_code", "account_code", "metric_code", "amount", "confirmation_status"]),
});

const TEMPLATES = Object.freeze({
  pl: "fiscal_month,company_key,store_key,account_code,account_name,amount,source_row_category,aggregate_scope,confirmation_status\n2026-07,0001,0001,4000,技術売上,0,detail,,confirmed\n",
  bs: "fiscal_month,company_key,account_code,account_name,amount,classification,confirmation_status\n2026-07,0001,1000,現金,0,asset,confirmed\n2026-07,0001,2000,負債,0,liability,confirmed\n2026-07,0001,3000,純資産,0,equity,confirmed\n",
  store_operating_result: "fiscal_month,company_key,store_key,metric_code,value,definition_version,confirmation_status\n2026-07,0001,0001,TOTAL_SALES,0,v1,provisional\n",
  budget: "fiscal_month,company_key,store_key,scenario_code,account_code,metric_code,amount,confirmation_status\n2026-07,0001,,BASE,4000,,0,confirmed\n",
});

function csvRows(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  const source = String(text || "").replace(/^\uFEFF/u, "").replace(/\r\n?/gu, "\n");
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') { value += '"'; index += 1; continue; }
      if (char === '"') { quoted = false; continue; }
      value += char;
      continue;
    }
    if (char === '"') { quoted = true; continue; }
    if (char === ",") { row.push(value); value = ""; continue; }
    if (char === "\n") { row.push(value); rows.push(row); row = []; value = ""; continue; }
    value += char;
  }
  if (quoted) throw new Error("CSV_QUOTE_UNCLOSED");
  if (value || row.length) { row.push(value); rows.push(row); }
  return rows.filter((candidate) => candidate.some((cell) => String(cell).trim()));
}

function exactHeader(actual, expected) {
  return actual.length === expected.length && actual.every((value, index) => String(value).trim() === expected[index]);
}

function required(value, code, max = 200) {
  const result = String(value || "").normalize("NFKC").trim();
  if (!result || result.length > max || /[\u0000-\u001f\u007f]/u.test(result)) throw new Error(code);
  return result;
}

function optional(value, code, max = 200) {
  const result = String(value || "").normalize("NFKC").trim();
  if (!result) return null;
  if (result.length > max || /[\u0000-\u001f\u007f]/u.test(result)) throw new Error(code);
  return result;
}

function numeric(value, code) {
  const text = required(value, code, 80);
  if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(text)) throw new Error(code);
  const result = Number(text);
  if (!Number.isFinite(result) || Math.abs(result) > 1_000_000_000_000_000) throw new Error(code);
  return result;
}

function normalizeMonth(value) {
  const result = required(value, "FISCAL_MONTH_INVALID", 7);
  if (!/^\d{4}-(?:0[1-9]|1[0-2])$/u.test(result)) throw new Error("FISCAL_MONTH_INVALID");
  return result;
}

function confirmation(value) {
  const result = required(value, "CONFIRMATION_STATUS_INVALID", 20);
  if (!new Set(["provisional", "confirmed"]).has(result)) throw new Error("CONFIRMATION_STATUS_INVALID");
  return result;
}

export function dbfNormalizedCsvTemplate(factKind) {
  if (!TEMPLATES[factKind]) throw new Error("FACT_KIND_INVALID");
  return TEMPLATES[factKind];
}

export function parseDbfNormalizedCsv(text, factKind, expectedMonth) {
  const expected = FACT_HEADERS[factKind];
  if (!expected) throw new Error("FACT_KIND_INVALID");
  const records = csvRows(text);
  if (records.length < 2 || !exactHeader(records[0], expected)) throw new Error("CSV_HEADER_INVALID");
  if (records.length > 10_001) throw new Error("CSV_ROW_LIMIT_EXCEEDED");
  const month = normalizeMonth(expectedMonth);
  const rows = records.slice(1).map((cells, index) => {
    if (cells.length !== expected.length) throw new Error(`CSV_COLUMN_COUNT_INVALID:${index + 2}`);
    const record = Object.fromEntries(expected.map((header, column) => [header, cells[column]]));
    if (normalizeMonth(record.fiscal_month) !== month) throw new Error(`ROW_MONTH_MISMATCH:${index + 2}`);
    const companyKey = required(record.company_key, `COMPANY_KEY_INVALID:${index + 2}`);
    const storeKey = optional(record.store_key, `STORE_KEY_INVALID:${index + 2}`);
    const base = { sourceRowNumber: index + 1, fiscalMonth: month, companyKey, storeKey };
    if (factKind === "pl") {
      const sourceRowCategory = required(record.source_row_category, `PL_ROW_CATEGORY_INVALID:${index + 2}`, 20);
      const aggregateScope = optional(record.aggregate_scope, `PL_AGGREGATE_SCOPE_INVALID:${index + 2}`, 40);
      if (!new Set(["detail", "aggregate"]).has(sourceRowCategory)) throw new Error(`PL_ROW_CATEGORY_INVALID:${index + 2}`);
      if (sourceRowCategory === "aggregate" && (storeKey || !new Set(["head_office", "company_total"]).has(String(aggregateScope)))) throw new Error(`PL_AGGREGATE_SCOPE_INVALID:${index + 2}`);
      if (sourceRowCategory === "detail" && aggregateScope) throw new Error(`PL_DETAIL_SCOPE_INVALID:${index + 2}`);
      return { ...base, accountCode: required(record.account_code, `PL_ACCOUNT_CODE_INVALID:${index + 2}`, 100), accountName: required(record.account_name, `PL_ACCOUNT_NAME_INVALID:${index + 2}`, 160), amount: numeric(record.amount, `PL_AMOUNT_INVALID:${index + 2}`), sourceRowCategory, aggregateScope, confirmationStatus: confirmation(record.confirmation_status) };
    }
    if (factKind === "bs") {
      const classification = required(record.classification, `BS_CLASSIFICATION_INVALID:${index + 2}`, 20);
      if (storeKey || !new Set(["asset", "liability", "equity"]).has(classification)) throw new Error(`BS_SCOPE_OR_CLASSIFICATION_INVALID:${index + 2}`);
      return { ...base, accountCode: required(record.account_code, `BS_ACCOUNT_CODE_INVALID:${index + 2}`, 100), accountName: required(record.account_name, `BS_ACCOUNT_NAME_INVALID:${index + 2}`, 160), amount: numeric(record.amount, `BS_AMOUNT_INVALID:${index + 2}`), classification, confirmationStatus: confirmation(record.confirmation_status) };
    }
    if (factKind === "store_operating_result") {
      if (!storeKey) throw new Error(`STORE_KEY_REQUIRED:${index + 2}`);
      return { ...base, metricCode: required(record.metric_code, `STORE_METRIC_CODE_INVALID:${index + 2}`, 100), value: numeric(record.value, `STORE_METRIC_VALUE_INVALID:${index + 2}`), definitionVersion: required(record.definition_version, `METRIC_DEFINITION_VERSION_INVALID:${index + 2}`, 80), confirmationStatus: confirmation(record.confirmation_status) };
    }
    const accountCode = optional(record.account_code, `BUDGET_ACCOUNT_CODE_INVALID:${index + 2}`, 100);
    const metricCode = optional(record.metric_code, `BUDGET_METRIC_CODE_INVALID:${index + 2}`, 100);
    if (Boolean(accountCode) === Boolean(metricCode)) throw new Error(`BUDGET_MEASURE_AMBIGUOUS:${index + 2}`);
    return { ...base, scenarioCode: required(record.scenario_code, `BUDGET_SCENARIO_INVALID:${index + 2}`, 80), accountCode, metricCode, amount: numeric(record.amount, `BUDGET_AMOUNT_INVALID:${index + 2}`), confirmationStatus: confirmation(record.confirmation_status) };
  });
  const mappingRequests = [];
  const seen = new Set();
  for (const row of rows) {
    for (const [entityType, sourceKey] of [["company", row.companyKey], ["store", row.storeKey]]) {
      if (!sourceKey || seen.has(`${entityType}:${sourceKey}`)) continue;
      seen.add(`${entityType}:${sourceKey}`);
      mappingRequests.push({ entityType, sourceKey });
    }
  }
  return { factKind, fiscalMonth: month, rows, mappingRequests };
}

export function bindDbfCanonicalMappings(parsed, mappings) {
  const byKey = new Map((mappings || []).filter((item) => item?.status === "active" && item?.mappingId && item?.canonicalId)
    .map((item) => [`${item.entityType}:${item.sourceKey}`, item]));
  const unresolved = parsed.mappingRequests.filter((item) => !byKey.has(`${item.entityType}:${item.sourceKey}`));
  if (unresolved.length) return { unresolved, rows: [] };
  const rows = parsed.rows.map((row) => {
    const company = byKey.get(`company:${row.companyKey}`);
    const store = row.storeKey ? byKey.get(`store:${row.storeKey}`) : null;
    const base = {
      sourceRowNumber: row.sourceRowNumber,
      fiscalMonth: row.fiscalMonth,
      companyId: company.canonicalId,
      storeId: store?.canonicalId || null,
      companyMappingId: company.mappingId,
      storeMappingId: store?.mappingId || null,
    };
    if (parsed.factKind === "pl") return { ...base, accountCode: row.accountCode, accountName: row.accountName, amount: row.amount, sourceRowCategory: row.sourceRowCategory, aggregateScope: row.aggregateScope, confirmationStatus: row.confirmationStatus };
    if (parsed.factKind === "bs") return { ...base, accountCode: row.accountCode, accountName: row.accountName, amount: row.amount, classification: row.classification, confirmationStatus: row.confirmationStatus };
    if (parsed.factKind === "store_operating_result") return { ...base, metricCode: row.metricCode, value: row.value, definitionVersion: row.definitionVersion, confirmationStatus: row.confirmationStatus };
    return { ...base, organizationId: null, scenarioCode: row.scenarioCode, accountCode: row.accountCode, metricCode: row.metricCode, amount: row.amount, confirmationStatus: row.confirmationStatus };
  });
  return { unresolved: [], rows };
}
