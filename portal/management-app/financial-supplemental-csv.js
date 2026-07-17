const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 100000;
const SAFE_TEXT_RE = /^[^\u0000-\u001f\u007f]{1,100}$/u;
const MONTH_RE = /^(\d{4})-(\d{2})$/u;
const TERM_RE = /^第[1-9]\d{0,2}期$/u;
const DECIMAL_RE = /^-?(?:0|[1-9]\d{0,14})(?:\.\d{1,2})?$/u;
const NONNEGATIVE_DECIMAL_RE = /^(?:0|[1-9]\d{0,14})(?:\.\d{1,2})?$/u;

export const FINANCIAL_SUPPLEMENTAL_DEFINITIONS = Object.freeze([
  Object.freeze({
    key: "UTILITY_SUBLEDGER",
    label: "水道光熱費の補助残高",
    fileName: "management-utility-subledger-template.csv",
    headers: Object.freeze(["対象月", "法人", "店舗・部門", "勘定科目", "計上値"]),
    sample: Object.freeze(["2026-06", "法人候補", "店舗・部門候補", "水道光熱費", "0"]),
    duplicateColumns: Object.freeze([0, 1, 2, 3]),
  }),
  Object.freeze({
    key: "COUPON_USAGE",
    label: "クーポン利用額",
    fileName: "management-coupon-usage-template.csv",
    headers: Object.freeze(["対象月", "店舗", "クーポン区分", "利用計上値"]),
    sample: Object.freeze(["2026-06", "店舗候補", "クーポン区分候補", "0"]),
    duplicateColumns: Object.freeze([0, 1, 2]),
  }),
  Object.freeze({
    key: "BUDGET_PLAN",
    label: "予算・計画データ",
    fileName: "management-budget-plan-template.csv",
    headers: Object.freeze(["対象月", "scope種別", "scope候補", "計画科目", "予算計上値"]),
    sample: Object.freeze(["2026-06", "店舗", "scope候補", "売上高", "0"]),
    duplicateColumns: Object.freeze([0, 1, 2, 3]),
  }),
  Object.freeze({
    key: "FC_RULE",
    label: "FC店舗の集計ルール",
    fileName: "management-fc-rule-template.csv",
    headers: Object.freeze(["適用期", "候補名", "区分", "集計方針"]),
    sample: Object.freeze(["第13期", "店舗・シート候補", "FC個店", "集計対象"]),
    duplicateColumns: Object.freeze([0, 1]),
  }),
]);

const definitionByKey = new Map(FINANCIAL_SUPPLEMENTAL_DEFINITIONS.map((item) => [item.key, item]));

function csvCell(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function templateText(definition) {
  return `\uFEFF${definition.headers.map(csvCell).join(",")}\r\n${definition.sample.map(csvCell).join(",")}\r\n`;
}

export function buildFinancialSupplementalTemplates() {
  return Object.freeze(FINANCIAL_SUPPLEMENTAL_DEFINITIONS.map((definition) => Object.freeze({
    key: definition.key,
    label: definition.label,
    fileName: definition.fileName,
    headers: Object.freeze([...definition.headers]),
    href: `data:text/csv;charset=utf-8,${encodeURIComponent(templateText(definition))}`,
  })));
}

function parseCsv(text) {
  if (typeof text !== "string" || text.includes("\u0000") || text.includes("\uFFFD")) return null;
  const source = text.replace(/^\uFEFF/u, "");
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"' && cell === "") quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell.replace(/\r$/u, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (quoted) return null;
  if (cell !== "" || row.length) {
    row.push(cell.replace(/\r$/u, ""));
    rows.push(row);
  }
  while (rows.length && rows.at(-1).every((value) => value === "")) rows.pop();
  return rows;
}

function validText(value) {
  return typeof value === "string" && value === value.normalize("NFC") && SAFE_TEXT_RE.test(value) && value.trim() === value;
}

function validMonth(value) {
  const match = String(value).match(MONTH_RE);
  if (!match) return false;
  const month = Number(match[2]);
  return Number(match[1]) >= 2000 && Number(match[1]) <= 2100 && month >= 1 && month <= 12;
}

function validateRow(definition, row) {
  if (!row.every(validText)) return "TEXT_VALUE_INVALID";
  if (definition.key === "FC_RULE") {
    if (!TERM_RE.test(row[0])) return "PERIOD_VALUE_INVALID";
    if (!new Set(["FC個店", "FC合計", "共通", "対象外"]).has(row[2])) return "ENUM_VALUE_INVALID";
    if (!new Set(["集計対象", "除外"]).has(row[3])) return "ENUM_VALUE_INVALID";
    return null;
  }
  if (!validMonth(row[0])) return "PERIOD_VALUE_INVALID";
  if (definition.key === "BUDGET_PLAN" && !new Set(["法人", "店舗", "部門"]).has(row[1])) return "ENUM_VALUE_INVALID";
  const amount = row.at(-1);
  const amountPattern = definition.key === "UTILITY_SUBLEDGER" ? DECIMAL_RE : NONNEGATIVE_DECIMAL_RE;
  if (!amountPattern.test(amount) || !Number.isFinite(Number(amount))) return "NUMBER_VALUE_INVALID";
  return null;
}

function result(category, key, rowCount = 0) {
  return Object.freeze({
    category,
    key: definitionByKey.has(key) ? key : "UNKNOWN",
    valid: category === "VALID",
    rowCount: Number.isSafeInteger(rowCount) && rowCount >= 0 ? rowCount : 0,
    mutationCount: 0,
    uploadCount: 0,
  });
}

export function validateFinancialSupplementalCsvText(key, text) {
  const definition = definitionByKey.get(key);
  if (!definition || typeof text !== "string") return result("REQUEST_INVALID", key);
  const rows = parseCsv(text);
  if (!rows) return result("CSV_MALFORMED", key);
  if (!rows.length || rows[0].length !== definition.headers.length || rows[0].some((value, index) => value !== definition.headers[index])) {
    return result("HEADER_MISMATCH", key);
  }
  const dataRows = rows.slice(1);
  if (!dataRows.length) return result("NO_DATA_ROWS", key);
  if (dataRows.length > MAX_ROWS) return result("ROW_LIMIT_EXCEEDED", key);
  const keys = new Set();
  for (const row of dataRows) {
    if (row.length !== definition.headers.length) return result("ROW_SHAPE_INVALID", key);
    const rowError = validateRow(definition, row);
    if (rowError) return result(rowError, key);
    const duplicateKey = definition.duplicateColumns.map((index) => row[index].toLocaleLowerCase("ja-JP")).join("\u001f");
    if (keys.has(duplicateKey)) return result("DUPLICATE_KEY", key);
    keys.add(duplicateKey);
  }
  return result("VALID", key, dataRows.length);
}

export async function validateFinancialSupplementalCsvFile(key, file) {
  if (!definitionByKey.has(key) || !file || typeof file.name !== "string" || !Number.isSafeInteger(file.size) || file.size < 0) {
    return result("REQUEST_INVALID", key);
  }
  if (!file.name.toLowerCase().endsWith(".csv")) return result("FILE_TYPE_INVALID", key);
  if (file.size > MAX_FILE_BYTES) return result("FILE_TOO_LARGE", key);
  if (typeof file.text !== "function") return result("READ_FAILED", key);
  try {
    return validateFinancialSupplementalCsvText(key, await file.text());
  } catch {
    return result("READ_FAILED", key);
  }
}

export function buildFinancialSupplementalReceipt(results) {
  if (!Array.isArray(results) || results.length !== FINANCIAL_SUPPLEMENTAL_DEFINITIONS.length) return null;
  const byKey = new Map(results.map((item) => [item?.key, item]));
  if (byKey.size !== FINANCIAL_SUPPLEMENTAL_DEFINITIONS.length) return null;
  if (FINANCIAL_SUPPLEMENTAL_DEFINITIONS.some((definition) => !byKey.get(definition.key)?.valid)) return null;
  return Object.freeze({
    schemaVersion: "management-financial-supplemental-local-v1",
    category: "LOCAL_SUPPLEMENTAL_FILES_READY",
    validatedKinds: Object.freeze(FINANCIAL_SUPPLEMENTAL_DEFINITIONS.map((definition) => definition.key)),
    validatedFileCount: FINANCIAL_SUPPLEMENTAL_DEFINITIONS.length,
    validatedRowCount: [...byKey.values()].reduce((sum, item) => sum + item.rowCount, 0),
    productionImportReady: false,
    mutationCount: 0,
    uploadCount: 0,
  });
}

const LABELS = Object.freeze({
  VALID: "ローカル検証済み",
  REQUEST_INVALID: "検証条件を確認してください",
  FILE_TYPE_INVALID: "UTF-8 CSVを選択してください",
  FILE_TOO_LARGE: "ファイル上限は5MBです",
  READ_FAILED: "ファイルを読み取れません",
  CSV_MALFORMED: "CSV形式または文字コードを確認してください",
  HEADER_MISMATCH: "固定ヘッダーと列順が一致しません",
  NO_DATA_ROWS: "データ行がありません",
  ROW_LIMIT_EXCEEDED: "確認可能な行数を超えています",
  ROW_SHAPE_INVALID: "データ行の列数が一致しません",
  PERIOD_VALUE_INVALID: "対象月または適用期を確認してください",
  TEXT_VALUE_INVALID: "文字項目を確認してください",
  NUMBER_VALUE_INVALID: "計上値を確認してください",
  ENUM_VALUE_INVALID: "区分または集計方針を確認してください",
  DUPLICATE_KEY: "同一キーの行が重複しています",
});

function createElement(documentRef, tag, className = "", text = "") {
  const node = documentRef.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

export function renderFinancialSupplementalCsv(container, options = {}) {
  const documentRef = options.document || container?.ownerDocument || globalThis.document;
  if (!container || !documentRef?.createElement || container.dataset.financialSupplementalMounted === "true") return false;
  container.dataset.financialSupplementalMounted = "true";
  container.dataset.productionImport = "DISABLED";
  const section = createElement(documentRef, "section", "financial-supplemental");
  const heading = createElement(documentRef, "div", "financial-supplemental-heading");
  const headingCopy = createElement(documentRef, "div");
  headingCopy.append(
    createElement(documentRef, "p", "financial-intake-kicker", "SUPPLEMENTAL LOCAL VALIDATION"),
    createElement(documentRef, "h4", "", "財務補助資料CSV")
  );
  const disabled = createElement(documentRef, "button", "", "本番取込 disabled");
  disabled.type = "button";
  disabled.disabled = true;
  heading.append(headingCopy, disabled);
  const summary = createElement(documentRef, "p", "financial-supplemental-summary", "店舗売上は店舗営業管理の既存CSVで検証します。ここでは残る補助資料だけを端末内で確認します。");
  const readiness = createElement(documentRef, "p", "financial-supplemental-readiness", "ローカル検証 0/4");
  readiness.dataset.financialSupplementalReady = "NOT_READY";
  readiness.setAttribute("aria-live", "polite");
  const list = createElement(documentRef, "div", "financial-supplemental-list");
  const validationResults = Array(FINANCIAL_SUPPLEMENTAL_DEFINITIONS.length).fill(null);
  const templates = buildFinancialSupplementalTemplates();
  const updateReadiness = () => {
    const validCount = validationResults.filter((item) => item?.valid).length;
    const receipt = buildFinancialSupplementalReceipt(validationResults);
    readiness.textContent = receipt
      ? "ローカル検証 4/4 完了。本番取込は未承認です。"
      : `ローカル検証 ${validCount}/4`;
    readiness.dataset.financialSupplementalReady = receipt ? receipt.category : "NOT_READY";
    if (typeof options.onReceipt === "function") options.onReceipt(receipt);
  };
  templates.forEach((template, index) => {
    const row = createElement(documentRef, "div", "financial-supplemental-row");
    row.dataset.financialSupplementalKey = template.key;
    const copy = createElement(documentRef, "div", "financial-supplemental-copy");
    copy.append(
      createElement(documentRef, "strong", "", template.label),
      createElement(documentRef, "span", "", template.headers.join(" / "))
    );
    const actions = createElement(documentRef, "div", "financial-supplemental-actions");
    const download = createElement(documentRef, "a", "financial-mapping-download", "ひな形CSV");
    download.href = template.href;
    download.download = template.fileName;
    const validate = createElement(documentRef, "label", "financial-mapping-download", "CSVを検証");
    const input = createElement(documentRef, "input");
    input.type = "file";
    input.accept = ".csv,text/csv";
    input.hidden = true;
    validate.append(input);
    actions.append(download, validate);
    const status = createElement(documentRef, "span", "financial-supplemental-status", "未確認");
    status.dataset.financialSupplementalStatus = "NOT_CHECKED";
    status.setAttribute("aria-live", "polite");
    input.addEventListener("change", async () => {
      status.textContent = "検証中";
      const validation = await validateFinancialSupplementalCsvFile(template.key, input.files?.[0]);
      validationResults[index] = validation;
      status.textContent = LABELS[validation.category] || "検証できませんでした";
      status.dataset.financialSupplementalStatus = validation.category;
      input.value = "";
      updateReadiness();
    });
    row.append(copy, actions, status);
    list.append(row);
  });
  section.append(heading, summary, readiness, list);
  container.replaceChildren(section);
  return true;
}
