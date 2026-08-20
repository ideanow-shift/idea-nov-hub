import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { STORE_MONTHLY_METRICS } from "../portal/management-app/dbf-business-data-contract.js";

export const HISTORICAL_HEADER = Object.freeze(["fiscal_month", "company_key", "store_key", "metric_code", "value", "definition_version", "confirmation_status"]);
export const HISTORICAL_MONTHS = Object.freeze(monthRange("2024-07", "2026-06"));

function monthRange(start, end) {
  const result = [];
  let [year, month] = start.split("-").map(Number);
  while (`${year}-${String(month).padStart(2, "0")}` <= end) {
    result.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month === 13) { year += 1; month = 1; }
  }
  return result;
}

function parseCsv(text) {
  const rows = []; let row = []; let cell = ""; let quoted = false;
  const source = String(text || "").replace(/^\uFEFF/u, "").replace(/\r\n?/gu, "\n");
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') { cell += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(cell); cell = ""; }
    else if (char === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += char;
  }
  if (quoted) throw new Error("CSV_QUOTE_UNCLOSED");
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((candidate) => candidate.some((value) => value.trim()));
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function grain(row) { return `${row.fiscal_month}\u0000${row.company_key}\u0000${row.store_key}\u0000${row.metric_code}`; }

export function prepareHistoricalStoreData({ csvText, officialStores, protectedGrains = [], budgetScopes = [] }) {
  const records = parseCsv(csvText);
  if (!records.length || records[0].length !== HISTORICAL_HEADER.length || !records[0].every((value, index) => value.trim() === HISTORICAL_HEADER[index])) throw new Error("CSV_HEADER_INVALID");
  const storeKeys = new Set((officialStores || []).map(String));
  if (storeKeys.size !== 20) throw new Error("OFFICIAL_STORE_BASELINE_INVALID");
  const metrics = new Set(Object.keys(STORE_MONTHLY_METRICS));
  const allowedMonths = new Set(HISTORICAL_MONTHS);
  const protectedSet = new Set(protectedGrains);
  const budgetSet = new Set(budgetScopes);
  const seen = new Set(); const rows = []; const issues = [];
  for (const [offset, cells] of records.slice(1).entries()) {
    const line = offset + 2;
    if (cells.length !== HISTORICAL_HEADER.length) { issues.push({ severity: "error", code: "CSV_COLUMN_COUNT_INVALID", line }); continue; }
    const row = Object.fromEntries(HISTORICAL_HEADER.map((key, index) => [key, cells[index].normalize("NFKC").trim()]));
    if (!allowedMonths.has(row.fiscal_month)) issues.push({ severity: "error", code: "FISCAL_MONTH_OUT_OF_RANGE", line });
    if (!row.company_key) issues.push({ severity: "error", code: "COMPANY_KEY_REQUIRED", line });
    if (!storeKeys.has(row.store_key)) issues.push({ severity: "error", code: "STORE_MAPPING_UNRESOLVED", line });
    if (!metrics.has(row.metric_code)) issues.push({ severity: "error", code: "METRIC_CODE_INVALID", line });
    if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(row.value) || !Number.isFinite(Number(row.value))) issues.push({ severity: "error", code: "VALUE_INVALID", line });
    if (!row.definition_version) issues.push({ severity: "error", code: "DEFINITION_VERSION_REQUIRED", line });
    if (!new Set(["provisional", "confirmed"]).has(row.confirmation_status)) issues.push({ severity: "error", code: "CONFIRMATION_STATUS_INVALID", line });
    const metricKind = STORE_MONTHLY_METRICS[row.metric_code];
    const value = Number(row.value);
    if (metricKind === "rate" && (value < 0 || value > 1)) issues.push({ severity: "error", code: "RATE_OUT_OF_RANGE_0_TO_1", line });
    if (metricKind === "quantity" && (!Number.isInteger(value) || value < 0)) issues.push({ severity: "error", code: "QUANTITY_INVALID", line });
    const key = grain(row);
    if (seen.has(key)) issues.push({ severity: "error", code: "DUPLICATE_GRAIN_IN_SOURCE", line });
    if (protectedSet.has(key)) issues.push({ severity: "error", code: "ACTIVE_FACT_COLLISION_CORRECTION_REQUIRED", line });
    seen.add(key); rows.push(row);
  }

  const byScope = new Map();
  for (const row of rows) {
    const key = `${row.fiscal_month}\u0000${row.store_key}`;
    if (!byScope.has(key)) byScope.set(key, new Map());
    byScope.get(key).set(row.metric_code, Number(row.value));
  }
  for (const [scope, values] of byScope) {
    const [fiscalMonth, storeKey] = scope.split("\u0000");
    if (["TECHNICAL_SALES", "RETAIL_SALES", "MID_SALES", "EC_ALLOCATED_SALES"].every((code) => values.has(code)) && values.has("TOTAL_SALES")) {
      const components = values.get("TECHNICAL_SALES") + values.get("RETAIL_SALES") + values.get("MID_SALES") + values.get("EC_ALLOCATED_SALES");
      if (Math.abs(values.get("TOTAL_SALES") - components) > 0.000001) issues.push({ severity: "warning", code: "TOTAL_SALES_COMPONENT_MISMATCH", fiscalMonth, storeKey });
    }
    if (["NEW_CUSTOMERS", "EXISTING_CUSTOMERS"].every((code) => values.has(code)) && values.has("TOTAL_CUSTOMERS") && values.get("TOTAL_CUSTOMERS") !== values.get("NEW_CUSTOMERS") + values.get("EXISTING_CUSTOMERS")) issues.push({ severity: "warning", code: "TOTAL_CUSTOMERS_COMPONENT_MISMATCH", fiscalMonth, storeKey });
  }

  const matrix = HISTORICAL_MONTHS.flatMap((fiscalMonth) => [...storeKeys].map((storeKey) => {
    const present = byScope.get(`${fiscalMonth}\u0000${storeKey}`) || new Map();
    const scopeRows = rows.filter((row) => row.fiscal_month === fiscalMonth && row.store_key === storeKey);
    const previousYearMonth = `${Number(fiscalMonth.slice(0, 4)) - 1}${fiscalMonth.slice(4)}`;
    const fiscalYearStart = `${Number(fiscalMonth.slice(0, 4)) - (Number(fiscalMonth.slice(5)) < 9 ? 1 : 0)}-09`;
    const ytdMonths = monthRange(fiscalYearStart, fiscalMonth).filter((month) => allowedMonths.has(month));
    const trailingMonths = HISTORICAL_MONTHS.filter((month) => month <= fiscalMonth).slice(-6);
    const complete = (month) => (byScope.get(`${month}\u0000${storeKey}`) || new Map()).size === metrics.size;
    return {
      fiscalMonth, storeKey, presentMetricCount: present.size,
      confirmedCount: scopeRows.filter((row) => row.confirmation_status === "confirmed").length,
      provisionalCount: scopeRows.filter((row) => row.confirmation_status === "provisional").length,
      missingCount: metrics.size - present.size,
      missingMetricCodes: [...metrics].filter((code) => !present.has(code)),
      budgetAvailable: budgetSet.has(`${fiscalMonth}\u0000${storeKey}`),
      yoyReady: allowedMonths.has(previousYearMonth) && complete(fiscalMonth) && complete(previousYearMonth),
      ytdReady: ytdMonths.length > 0 && ytdMonths.every(complete),
      trendReady: trailingMonths.length === 6 && trailingMonths.every(complete),
    };
  }));
  const errors = issues.filter((item) => item.severity === "error");
  const monthlyFiles = errors.length ? [] : HISTORICAL_MONTHS.map((fiscalMonth) => {
    const monthRows = rows.filter((row) => row.fiscal_month === fiscalMonth);
    return { name: `store-operating-result-${fiscalMonth}.csv`, content: `${HISTORICAL_HEADER.join(",")}\n${monthRows.map((row) => HISTORICAL_HEADER.map((key) => csvCell(row[key])).join(",")).join("\n")}${monthRows.length ? "\n" : ""}` };
  });
  return Object.freeze({ ready: errors.length === 0, rows: rows.length, issues, matrix, monthlyFiles });
}

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map((value) => value.split("=", 2)));
  if (!args["--input"] || !args["--stores"] || !args["--output"]) throw new Error("USAGE: --input=history.csv --stores=official-store-keys.json --output=directory [--protected=active-grains.json] [--budgets=budget-scopes.json]");
  const [csvText, storesText, protectedText, budgetText] = await Promise.all([readFile(resolve(args["--input"]), "utf8"), readFile(resolve(args["--stores"]), "utf8"), args["--protected"] ? readFile(resolve(args["--protected"]), "utf8") : "[]", args["--budgets"] ? readFile(resolve(args["--budgets"]), "utf8") : "[]"]);
  const result = prepareHistoricalStoreData({ csvText, officialStores: JSON.parse(storesText), protectedGrains: JSON.parse(protectedText), budgetScopes: JSON.parse(budgetText) });
  const output = resolve(args["--output"]); await mkdir(output, { recursive: true });
  await writeFile(resolve(output, "rehearsal-report.json"), `${JSON.stringify({ ready: result.ready, rows: result.rows, issues: result.issues, matrix: result.matrix }, null, 2)}\n`, "utf8");
  if (!result.ready) throw new Error("HISTORICAL_REHEARSAL_BLOCKED");
  await Promise.all(result.monthlyFiles.map((file) => writeFile(resolve(output, file.name), file.content, "utf8")));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
