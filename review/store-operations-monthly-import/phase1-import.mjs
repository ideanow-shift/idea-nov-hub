import crypto from "node:crypto";
import { readZipEntries } from "../management-yayoi-pl-local-adapter.mjs";

export const PHASE1_MODE = "fixture_only";
export const REQUIRED_ACCOUNT_MAP = Object.freeze({
  "技術売上高": "technical_sales",
  "商品売上高": "monthly_product_sales",
  "ECサイト商品売上高": "monthly_ec_sales",
  "売上高合計": "monthly_sales",
  "売上原価": "cost_of_sales",
  "売上総損益金額": "gross_profit",
  "販売管理費計": "selling_general_admin_expenses",
  "営業損益金額": "monthly_profit",
});

const MONTH_RE = /^(?:(\d{4})年)?(\d{1,2})月(?:度)?$/u;
const FORBIDDEN_COLUMN_RE = /(半期|累計|当期残高|決算|比較)/u;
const xmlText = (text) => String(text ?? "")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
const attr = (tag, name) => tag.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? null;

function columnIndex(ref) {
  const letters = String(ref ?? "").match(/^[A-Z]+/i)?.[0]?.toUpperCase();
  if (!letters) return -1;
  return [...letters].reduce((value, letter) => value * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function parseWorkbook(entries) {
  const workbook = entries.get("xl/workbook.xml");
  const rels = entries.get("xl/_rels/workbook.xml.rels");
  if (!workbook || !rels) throw new Error("XLSX_WORKBOOK_MISSING");
  const targets = new Map([...rels.matchAll(/<Relationship\b[^>]*>/g)].map(([tag]) => {
    const target = attr(tag, "Target");
    return [attr(tag, "Id"), target?.startsWith("/") ? target.slice(1) : `xl/${target}`];
  }));
  return [...workbook.matchAll(/<sheet\b[^>]*>/g)].map(([tag]) => ({
    name: xmlText(attr(tag, "name")), path: targets.get(attr(tag, "r:id")),
  })).filter(({ name, path }) => name && path);
}

function parseRows(entries, sheet) {
  const xml = entries.get(sheet.path);
  if (!xml) throw new Error("XLSX_SHEET_MISSING");
  return [...xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)].map(([rowTag, body]) => {
    const number = Number(attr(rowTag, "r") ?? 0);
    const cells = [];
    for (const [cellXml] of body.matchAll(/<c\b[^>]*\/>|<c\b[^>]*>[\s\S]*?<\/c>/g)) {
      const tag = cellXml.match(/^<c\b[^>]*>/)?.[0] ?? cellXml;
      const column = columnIndex(attr(tag, "r"));
      const type = attr(tag, "t");
      const raw = cellXml.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      const inline = cellXml.match(/<is>([\s\S]*?)<\/is>/)?.[1];
      if (type === "inlineStr") cells[column] = xmlText(inline?.replace(/<[^>]+>/g, "") ?? "");
      else if (raw === undefined) cells[column] = null;
      else if (Number.isFinite(Number(raw))) cells[column] = Number(raw);
      else cells[column] = xmlText(raw);
    }
    return { number, cells };
  });
}

function category(value) {
  if (value === null || value === undefined || value === "") return "blank";
  if (typeof value === "number" && Number.isFinite(value)) return "number";
  if (typeof value === "string") return "string";
  return "invalid";
}

function issue(issueType, sheetName, rowNo, columnName, value, reason, suggestedAction) {
  return { issue_type: issueType, sheet_name: sheetName, row_no: rowNo ?? null,
    column_name: columnName ?? null, current_value_category: category(value), reason, suggested_action: suggestedAction };
}

function monthColumns(header, targetPeriod, fiscalYear, sheetName, issues) {
  const candidates = [];
  header.forEach((value, index) => {
    const label = String(value ?? "").trim();
    if (!label || FORBIDDEN_COLUMN_RE.test(label)) return;
    const match = label.match(MONTH_RE);
    if (!match) return;
    const month = Number(match[2]);
    const year = match[1] ? Number(match[1]) : month < 9 ? fiscalYear + 1 : fiscalYear;
    if (month < 1 || month > 12) {
      issues.push(issue("invalid_month_column", sheetName, 8, label, value, "month header is invalid", "correct the month header"));
      return;
    }
    candidates.push({ index, label, period: `${year}-${String(month).padStart(2, "0")}` });
  });
  const matches = candidates.filter((item) => item.period === targetPeriod);
  if (matches.length !== 1) issues.push(issue(matches.length ? "ambiguous_target_period" : "target_period_missing", sheetName, 8, "target_period", null,
    "target period must resolve to exactly one monthly column", "supply one valid target-month column"));
  return matches[0] ?? null;
}

function fiscalYear(rows) {
  const text = rows.slice(0, 8).flatMap(({ cells }) => cells).join(" ");
  return Number(text.match(/(20\d{2})年\s*9月/u)?.[1] ?? 0);
}

function selectedMapping(mapping, sheetName, targetPeriod, issues) {
  const matches = mapping.filter((item) => item.yayoi_sheet_name === sheetName && item.import_enabled
    && item.effective_from <= `${targetPeriod}-01`
    && (!item.effective_to || item.effective_to >= `${targetPeriod}-01`));
  if (matches.length !== 1) {
    issues.push(issue(matches.length > 1 ? "multiple_mapping_candidates" : "mapping_missing", sheetName, null, null, null,
      "selected P/L sheet requires exactly one effective fixed mapping", "approve one effective mapping or remove the sheet"));
    return null;
  }
  return matches[0];
}

export function dryRunWorkbook(buffer, { fileName = "fixture.xlsx", targetPeriod, mapping = [] } = {}) {
  const issues = [];
  const hash = crypto.createHash("sha256").update(buffer).digest("hex");
  const entries = readZipEntries(buffer);
  const sheets = parseWorkbook(entries).map((sheet) => ({ ...sheet, rows: parseRows(entries, sheet) }));
  const selected = [];
  const normalized = [];
  const knownSelectedNames = new Set(mapping.filter((item) => item.import_enabled).map((item) => item.yayoi_sheet_name));

  for (const sheet of sheets) {
    const isBs = sheet.name.startsWith("貸･");
    const isPl = sheet.name.startsWith("損･");
    if (isBs || !isPl) continue;
    const map = selectedMapping(mapping, sheet.name, targetPeriod, issues);
    if (!map) {
      if (!knownSelectedNames.has(sheet.name)) issues.push(issue("unknown_sheet", sheet.name, null, null, null,
        "unselected P/L sheet is outside the fixed mapping", "add an approved mapping or remove it from the Workbook"));
      continue;
    }
    const report = String(sheet.rows[0]?.cells[0] ?? "");
    const headerRow = sheet.rows.find(({ cells }) => String(cells[0] ?? "").trim() === "勘定科目");
    const year = fiscalYear(sheet.rows);
    if (!report.includes("残高試算表") || !report.includes("年間推移") || !headerRow || !year) {
      issues.push(issue("invalid_pl_sheet", sheet.name, null, null, null, "P/L anchors are incomplete", "use the approved annual-trial-balance P/L layout"));
      continue;
    }
    const column = monthColumns(headerRow.cells, targetPeriod, year, sheet.name, issues);
    if (!column) continue;
    const seenAccounts = new Set();
    const foundAccounts = new Set();
    for (const row of sheet.rows.filter(({ number }) => number > headerRow.number)) {
      const account = String(row.cells[0] ?? "").trim();
      if (!account || account.startsWith("[")) continue;
      const value = row.cells[column.index];
      if (!Object.hasOwn(REQUIRED_ACCOUNT_MAP, account)) {
        issues.push(issue("unknown_account", sheet.name, row.number, "勘定科目", account,
          "account is not approved for V1", "approve a contextual metric mapping or remove the row from selection"));
        continue;
      }
      if (seenAccounts.has(account)) {
        issues.push(issue("duplicate_row", sheet.name, row.number, "勘定科目", account,
          "approved account occurs more than once", "resolve the account context before import"));
        continue;
      }
      seenAccounts.add(account);
      foundAccounts.add(account);
      if (category(value) !== "number") {
        issues.push(issue(category(value) === "blank" ? "required_value_missing" : "invalid_numeric_value", sheet.name, row.number,
          column.label, value, "selected metric value must be a finite number", "correct the source cell or leave the version unpublished"));
        continue;
      }
      const metric = REQUIRED_ACCOUNT_MAP[account];
      normalized.push({ store_id: map.store_id, corporation_id: map.corporation_id, metric_code: metric,
        target_period: targetPeriod, amount: map.direct_or_fc === "fc" && metric === "monthly_profit" ? null : value,
        value_status: map.direct_or_fc === "fc" && metric === "monthly_profit" ? "unavailable" : "ready" });
    }
    for (const account of Object.keys(REQUIRED_ACCOUNT_MAP)) if (!foundAccounts.has(account)) {
      issues.push(issue("required_account_missing", sheet.name, null, "勘定科目", null,
        `required account ${account} is missing`, "provide the approved P/L account"));
    }
    selected.push({ sheet_name: sheet.name, entity_type: map.entity_type, store_id: map.store_id, direct_or_fc: map.direct_or_fc });
  }

  const storeMappings = selected.filter(({ entity_type }) => entity_type === "store");
  const ids = storeMappings.map(({ store_id }) => store_id);
  const direct = storeMappings.filter(({ direct_or_fc }) => direct_or_fc === "direct").length;
  const fc = storeMappings.filter(({ direct_or_fc }) => direct_or_fc === "fc").length;
  if (storeMappings.length !== 20 || direct !== 13 || fc !== 7 || new Set(ids).size !== ids.length) {
    issues.push(issue("store_composition_invalid", null, null, "store_id", null,
      "selected mappings must be exactly 20 stores: Direct 13 and FC 7 with no duplicate store_id", "correct the fixed mapping"));
  }
  const errors = issues.length;
  return Object.freeze({ mode: PHASE1_MODE, file_name: fileName, workbook_hash: hash, target_period: targetPeriod ?? null,
    total_sheet_count: sheets.length, selected_sheet_count: selected.length, excluded_sheet_count: sheets.length - selected.length,
    mapping: { store_count: storeMappings.length, direct_count: direct, fc_count: fc, mismatch_count: issues.filter(({ issue_type }) => /mapping|composition/.test(issue_type)).length },
    target_account_count: Object.keys(REQUIRED_ACCOUNT_MAP).length, normalized_record_count: errors ? 0 : normalized.length,
    error_count: errors, warning_count: 0, monthly_amount_total: errors ? null : normalized.reduce((sum, row) => sum + (row.amount ?? 0), 0),
    store_record_counts: errors ? {} : Object.fromEntries(ids.map((id) => [id, normalized.filter((row) => row.store_id === id).length])),
    quarantine: issues, normalized_records: errors ? [] : normalized,
    db_connection_count: 0, production_connection_count: 0, file_write_count: 0, status: errors ? "FAIL_CLOSED" : "DRY_RUN_READY" });
}
