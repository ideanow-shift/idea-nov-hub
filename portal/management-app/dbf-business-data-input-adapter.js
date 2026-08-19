import { STORE_MONTHLY_METRICS } from "./dbf-business-data-contract.js";
import { parseDbfNormalizedCsv } from "./dbf-business-data-normalized-csv.js";

export const DBF_INPUT_SOURCE_SYSTEM = "dbf_phase_c_normalized_csv_v1";

export const STORE_METRIC_LABELS = Object.freeze({
  TOTAL_SALES: "総売上", TECHNICAL_SALES: "技術売上", RETAIL_SALES: "商品売上", MID_SALES: "MID売上",
  EC_ALLOCATED_SALES: "EC按分売上", TOTAL_CUSTOMERS: "総客数", NEW_CUSTOMERS: "新規客数",
  EXISTING_CUSTOMERS: "既存客数", TOTAL_UNIT_PRICE: "総単価", TECHNICAL_UNIT_PRICE: "技術単価",
  TOTAL_REPEAT_RATE: "総リピート率", NEW_REPEAT_RATE: "新規リピート率", SECOND_REPEAT_RATE: "2回目リピート率",
  THIRD_REPEAT_RATE: "3回目リピート率", FIXED_REPEAT_RATE: "固定リピート率", TOTAL_PRODUCTIVITY: "総生産性",
  TECHNICAL_PRODUCTIVITY: "技術生産性", RETAIL_PURCHASE_RATE: "店販購買率", OPERATING_PROFIT: "営業利益",
});

export const STORE_METRIC_GROUPS = Object.freeze([
  Object.freeze({ key: "sales", label: "売上", metrics: Object.freeze(["TOTAL_SALES", "TECHNICAL_SALES", "RETAIL_SALES", "MID_SALES", "EC_ALLOCATED_SALES"]) }),
  Object.freeze({ key: "customers", label: "顧客", metrics: Object.freeze(["TOTAL_CUSTOMERS", "NEW_CUSTOMERS", "EXISTING_CUSTOMERS"]) }),
  Object.freeze({ key: "unit-price", label: "単価", metrics: Object.freeze(["TOTAL_UNIT_PRICE", "TECHNICAL_UNIT_PRICE"]) }),
  Object.freeze({ key: "repeat", label: "リピート", metrics: Object.freeze(["TOTAL_REPEAT_RATE", "NEW_REPEAT_RATE", "SECOND_REPEAT_RATE", "THIRD_REPEAT_RATE", "FIXED_REPEAT_RATE"]) }),
  Object.freeze({ key: "productivity", label: "生産性", metrics: Object.freeze(["TOTAL_PRODUCTIVITY", "TECHNICAL_PRODUCTIVITY", "RETAIL_PURCHASE_RATE", "OPERATING_PROFIT"]) }),
]);

function required(value, code) {
  const text = String(value ?? "").normalize("NFKC").trim();
  if (!text || /[\u0000-\u001f\u007f]/u.test(text)) throw new Error(code);
  return text;
}

function optional(value) { const text = String(value ?? "").normalize("NFKC").trim(); return text || null; }
function number(value, code) { const text = required(value, code); const result = Number(text.replaceAll(",", "")); if (!Number.isFinite(result)) throw new Error(code); return result; }
function confirmation(value, index) { const result = required(value, `CONFIRMATION_STATUS_INVALID:${index}`); if (!new Set(["provisional", "confirmed"]).has(result)) throw new Error(`CONFIRMATION_STATUS_INVALID:${index}`); return result; }
function mappingRequests(rows) {
  const result = []; const seen = new Set();
  for (const row of rows) for (const [entityType, sourceKey] of [["company", row.companyKey], ["store", row.storeKey]]) {
    if (!sourceKey || seen.has(`${entityType}:${sourceKey}`)) continue;
    seen.add(`${entityType}:${sourceKey}`); result.push({ entityType, sourceKey });
  }
  return result;
}

function csvCell(value) { const text = String(value ?? ""); return /[",\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }
function artifact(factKind, fiscalMonth, rows) {
  const keys = Object.keys(rows[0] || {});
  const content = `${keys.map(csvCell).join(",")}\n${rows.map((row) => keys.map((key) => csvCell(row[key])).join(",")).join("\n")}\n`;
  return Object.freeze({ name: `dbf-manual-${factKind}-${fiscalMonth}.csv`, mediaType: "text/csv;charset=utf-8", content });
}

export function parseClipboardGrid(text, expectedRows, expectedColumns) {
  const rows = String(text || "").replace(/\r\n?/gu, "\n").replace(/\n$/u, "").split("\n").map((row) => row.split("\t"));
  if (rows.length !== expectedRows || rows.some((row) => row.length !== expectedColumns)) throw new Error("CLIPBOARD_DIMENSION_MISMATCH");
  return rows;
}

export function validateOfficialStoreBaseline(master, directCompanyCode = "0001") {
  const companies = Array.isArray(master?.companies) ? master.companies : [];
  const stores = (Array.isArray(master?.stores) ? master.stores : []).filter((item) => item?.code !== "honbu" && item?.name !== "本部");
  const directCompany = companies.find((item) => item?.code === directCompanyCode);
  const direct = stores.filter((item) => item?.companyId === directCompany?.id).length;
  const fc = stores.length - direct;
  if (stores.length !== 20 || direct !== 13 || fc !== 7) throw new Error("OFFICIAL_STORE_BASELINE_INVALID");
  return Object.freeze({ stores: Object.freeze(stores), direct, fc });
}

export function prepareManualDbfInput({ factKind, fiscalMonth, rows }) {
  if (!/^20\d{2}-(?:0[1-9]|1[0-2])$/u.test(String(fiscalMonth))) throw new Error("FISCAL_MONTH_INVALID");
  if (!Array.isArray(rows) || rows.length === 0) throw new Error("MANUAL_ROWS_REQUIRED");
  const normalizedRows = rows.map((source, index) => {
    const base = { sourceRowNumber: index + 1, fiscalMonth, companyKey: required(source.companyKey, `COMPANY_KEY_REQUIRED:${index + 1}`), storeKey: optional(source.storeKey) };
    if (factKind === "store_operating_result") {
      const metricCode = required(source.metricCode, `METRIC_CODE_REQUIRED:${index + 1}`);
      const kind = STORE_MONTHLY_METRICS[metricCode];
      if (!kind || !base.storeKey) throw new Error(`STORE_METRIC_SCOPE_INVALID:${index + 1}`);
      let value = number(source.value, `STORE_METRIC_VALUE_INVALID:${index + 1}`);
      if (kind === "rate") { if (value < 0 || value > 100) throw new Error(`STORE_METRIC_RATE_INVALID:${index + 1}`); value /= 100; }
      if (kind === "quantity" && (!Number.isInteger(value) || value < 0)) throw new Error(`STORE_METRIC_QUANTITY_INVALID:${index + 1}`);
      return { ...base, metricCode, value, definitionVersion: required(source.definitionVersion || "v1", `METRIC_DEFINITION_VERSION_INVALID:${index + 1}`), confirmationStatus: confirmation(source.confirmationStatus || "provisional", index + 1) };
    }
    if (factKind === "budget") {
      const accountCode = optional(source.accountCode); const metricCode = optional(source.metricCode);
      if (Boolean(accountCode) === Boolean(metricCode)) throw new Error(`BUDGET_MEASURE_AMBIGUOUS:${index + 1}`);
      if (metricCode && !STORE_MONTHLY_METRICS[metricCode]) throw new Error(`BUDGET_METRIC_CODE_INVALID:${index + 1}`);
      return { ...base, scenarioCode: required(source.scenarioCode, `BUDGET_SCENARIO_INVALID:${index + 1}`), accountCode, metricCode, amount: number(source.amount, `BUDGET_AMOUNT_INVALID:${index + 1}`), confirmationStatus: confirmation(source.confirmationStatus || "confirmed", index + 1) };
    }
    const common = { ...base, accountCode: required(source.accountCode, `ACCOUNT_CODE_REQUIRED:${index + 1}`), accountName: required(source.accountName, `ACCOUNT_NAME_REQUIRED:${index + 1}`), amount: number(source.amount, `AMOUNT_INVALID:${index + 1}`), confirmationStatus: confirmation(source.confirmationStatus || "confirmed", index + 1) };
    if (factKind === "bs") { if (base.storeKey) throw new Error(`BS_STORE_SCOPE_PROHIBITED:${index + 1}`); const classification = required(source.classification, `BS_CLASSIFICATION_INVALID:${index + 1}`); if (!new Set(["asset", "liability", "equity"]).has(classification)) throw new Error(`BS_CLASSIFICATION_INVALID:${index + 1}`); return { ...common, classification }; }
    if (factKind === "pl") { const sourceRowCategory = required(source.sourceRowCategory || "detail", `PL_ROW_CATEGORY_INVALID:${index + 1}`); const aggregateScope = optional(source.aggregateScope); if (!new Set(["detail", "aggregate"]).has(sourceRowCategory) || (sourceRowCategory === "detail" && aggregateScope) || (sourceRowCategory === "aggregate" && (base.storeKey || !new Set(["head_office", "company_total"]).has(aggregateScope)))) throw new Error(`PL_ROW_CATEGORY_INVALID:${index + 1}`); return { ...common, sourceRowCategory, aggregateScope }; }
    throw new Error("FACT_KIND_INVALID");
  });
  if (factKind === "bs") {
    const totals = normalizedRows.reduce((sum, row) => ({ ...sum, [row.classification]: (sum[row.classification] || 0) + row.amount }), {});
    if (Math.abs((totals.asset || 0) - (totals.liability || 0) - (totals.equity || 0)) > 0.000001) throw new Error("BS_BALANCE_CHECK_FAILED");
  }
  return Object.freeze({ sourceType: "manual_entry", sourceSystem: DBF_INPUT_SOURCE_SYSTEM, sourceArtifact: artifact(factKind, fiscalMonth, normalizedRows), normalizedRows: Object.freeze(normalizedRows), mappingRequests: Object.freeze(mappingRequests(normalizedRows)), factKind, fiscalMonth });
}

export function prepareCsvDbfInput({ text, factKind, fiscalMonth, file }) {
  const parsed = parseDbfNormalizedCsv(text, factKind, fiscalMonth);
  return Object.freeze({ sourceType: "csv_upload", sourceSystem: DBF_INPUT_SOURCE_SYSTEM, sourceArtifact: file, normalizedRows: parsed.rows, mappingRequests: parsed.mappingRequests, factKind, fiscalMonth });
}

export function prepareDbfInput(options) {
  return options?.sourceType === "manual_entry" ? prepareManualDbfInput(options) : prepareCsvDbfInput(options);
}
