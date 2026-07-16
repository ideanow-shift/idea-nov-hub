const REQUIREMENT_KEYS = Object.freeze(["name", "fields", "purpose"]);
const MAX_CSV_FILE_BYTES = 5 * 1024 * 1024;
const MAX_CSV_DATA_ROWS = 100000;
const MONTH_PATTERN = /^20\d{2}-(0[1-9]|1[0-2])$/;
const DATE_PATTERN = /^(20\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const DECIMAL_PATTERN = /^(0|[1-9]\d{0,11})(\.\d{1,2})?$/;
const INTEGER_PATTERN = /^(0|[1-9]\d{0,8})$/;

const CSV_TEMPLATES = Object.freeze([
  Object.freeze({ filename: "store-monthly-sales-template.csv", headers: Object.freeze(["対象月", "店舗", "売上"]) }),
  Object.freeze({ filename: "store-daily-sales-template.csv", headers: Object.freeze(["営業日", "店舗", "売上", "客数", "客単価"]) }),
  Object.freeze({ filename: "store-reservations-template.csv", headers: Object.freeze(["営業日", "店舗", "予約枠", "予約数"]) }),
]);

export const SANITIZED_CSV_REQUIREMENTS = Object.freeze([
  Object.freeze({ name: "店舗別月次売上", fields: "対象月・店舗・売上", purpose: "店舗KPI" }),
  Object.freeze({ name: "日次売上", fields: "営業日・店舗・売上・客数・客単価", purpose: "日次進捗" }),
  Object.freeze({ name: "予約状況", fields: "営業日・店舗・予約枠・予約数", purpose: "予約充足率" }),
]);

function exactKeys(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length === REQUIREMENT_KEYS.length && keys.every((key) => REQUIREMENT_KEYS.includes(key));
}

export function validateCsvRequirements(items) {
  return Array.isArray(items)
    && items.length === SANITIZED_CSV_REQUIREMENTS.length
    && items.every((item, index) => exactKeys(item)
      && REQUIREMENT_KEYS.every((key) => item[key] === SANITIZED_CSV_REQUIREMENTS[index][key]));
}

function createTemplate(requirement, template) {
  const csv = `\uFEFF${template.headers.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")}\r\n`;
  return Object.freeze({
    name: requirement.name,
    fields: requirement.fields,
    purpose: requirement.purpose,
    filename: template.filename,
    csv,
    href: `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`,
  });
}

function sanitizedValidation(category, valid = false, rowCount = 0) {
  return Object.freeze({ category, valid, rowCount });
}

function parseCsvRecords(text) {
  const source = text.replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  let closedQuote = false;
  let cellStarted = false;

  const finishCell = () => {
    row.push(cell);
    cell = "";
    closedQuote = false;
    cellStarted = false;
  };
  const finishRow = () => {
    finishCell();
    rows.push(row);
    row = [];
  };

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
        closedQuote = true;
      } else {
        cell += char;
      }
      continue;
    }
    if (closedQuote) {
      if (char === ",") {
        finishCell();
      } else if (char === "\n") {
        finishRow();
      } else if (char === "\r" && next === "\n") {
        finishRow();
        index += 1;
      } else {
        return null;
      }
      continue;
    }
    if (char === '"') {
      if (cellStarted) return null;
      quoted = true;
      cellStarted = true;
    } else if (char === ",") {
      finishCell();
    } else if (char === "\n") {
      finishRow();
    } else if (char === "\r" && next === "\n") {
      finishRow();
      index += 1;
    } else if (char === "\r") {
      return null;
    } else {
      cell += char;
      cellStarted = true;
    }
    if (rows.length > MAX_CSV_DATA_ROWS + 1) return null;
  }

  if (quoted) return null;
  if (closedQuote || cellStarted || cell.length || row.length) finishRow();
  return rows.filter((record) => record.some((value) => value.trim() !== ""));
}

function isCanonicalDate(value) {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isCanonicalStore(value) {
  return value.length >= 1
    && value.length <= 100
    && value === value.trim()
    && value === value.normalize("NFC")
    && !/[\u0000-\u001F\u007F]/.test(value);
}

function validateSemanticRows(templateIndex, rows) {
  const keys = new Set();
  for (const row of rows) {
    const period = row[0];
    const store = row[1];
    if ((templateIndex === 0 && !MONTH_PATTERN.test(period)) || (templateIndex !== 0 && !isCanonicalDate(period))) {
      return "PERIOD_VALUE_INVALID";
    }
    if (!isCanonicalStore(store)) return "STORE_VALUE_INVALID";
    if (templateIndex === 0 && !DECIMAL_PATTERN.test(row[2])) return "NUMBER_VALUE_INVALID";
    if (templateIndex === 1 && (!DECIMAL_PATTERN.test(row[2]) || !INTEGER_PATTERN.test(row[3]) || !DECIMAL_PATTERN.test(row[4]))) {
      return "NUMBER_VALUE_INVALID";
    }
    if (templateIndex === 2) {
      if (!INTEGER_PATTERN.test(row[2]) || !INTEGER_PATTERN.test(row[3])) return "NUMBER_VALUE_INVALID";
      if (Number(row[3]) > Number(row[2])) return "RESERVATION_VALUE_INVALID";
    }
    const key = `${period}\u0000${store}`;
    if (keys.has(key)) return "DUPLICATE_KEY";
    keys.add(key);
  }
  return "VALID";
}

export function validateLocalCsvText(templateIndex, text) {
  if (!Number.isInteger(templateIndex) || templateIndex < 0 || templateIndex >= CSV_TEMPLATES.length || typeof text !== "string") {
    return sanitizedValidation("REQUEST_INVALID");
  }
  if (text.includes("\u0000") || text.includes("\uFFFD")) return sanitizedValidation("CSV_MALFORMED");
  const rows = parseCsvRecords(text);
  if (!rows) return sanitizedValidation("CSV_MALFORMED");
  const expected = CSV_TEMPLATES[templateIndex].headers;
  const header = rows[0] || [];
  if (header.length !== expected.length || header.some((value, index) => value !== expected[index])) {
    return sanitizedValidation("HEADER_MISMATCH");
  }
  const dataRows = rows.slice(1);
  if (dataRows.length > MAX_CSV_DATA_ROWS) return sanitizedValidation("ROW_LIMIT_EXCEEDED");
  if (dataRows.some((record) => record.length !== expected.length)) return sanitizedValidation("ROW_SHAPE_INVALID");
  if (!dataRows.length) return sanitizedValidation("NO_DATA_ROWS");
  const semanticCategory = validateSemanticRows(templateIndex, dataRows);
  if (semanticCategory !== "VALID") return sanitizedValidation(semanticCategory);
  return sanitizedValidation("VALID", true, dataRows.length);
}

export async function validateLocalCsvFile(templateIndex, file) {
  if (!file || typeof file !== "object" || typeof file.name !== "string" || !Number.isSafeInteger(file.size) || file.size < 0) {
    return sanitizedValidation("REQUEST_INVALID");
  }
  if (!file.name.toLowerCase().endsWith(".csv")) return sanitizedValidation("FILE_TYPE_INVALID");
  if (file.size > MAX_CSV_FILE_BYTES) return sanitizedValidation("FILE_TOO_LARGE");
  if (typeof file.text !== "function") return sanitizedValidation("READ_FAILED");
  try {
    return validateLocalCsvText(templateIndex, await file.text());
  } catch {
    return sanitizedValidation("READ_FAILED");
  }
}

function validationMessage(result) {
  return ({
    VALID: `ローカル確認OK: ${result.rowCount}件`,
    NO_DATA_ROWS: "データ行がありません",
    HEADER_MISMATCH: "必要項目と列順が一致しません",
    ROW_SHAPE_INVALID: "データ行の列数が一致しません",
    ROW_LIMIT_EXCEEDED: "確認できる行数上限を超えています",
    PERIOD_VALUE_INVALID: "対象月または営業日を確認してください",
    STORE_VALUE_INVALID: "店舗名を確認してください",
    NUMBER_VALUE_INVALID: "金額または件数を確認してください",
    RESERVATION_VALUE_INVALID: "予約数が予約枠を超えています",
    DUPLICATE_KEY: "同じ対象期間と店舗の行が重複しています",
    CSV_MALFORMED: "CSV形式または文字コードを確認してください",
    FILE_TYPE_INVALID: "CSVファイルを選択してください",
    FILE_TOO_LARGE: "ファイルサイズ上限は5MBです",
    READ_FAILED: "ファイルを確認できません",
  })[result.category] || "ファイルを確認できません";
}

export function buildCsvRequirementsView(items) {
  if (!validateCsvRequirements(items)) {
    return Object.freeze({
      status: "INVALID",
      summary: "CSV要件を安全に確認できません。取込は実行しません。",
      labels: Object.freeze([]),
      templates: Object.freeze([]),
    });
  }
  return Object.freeze({
    status: "READY_FOR_FILE_PREPARATION",
    summary: "ひな形の保存と作成済みCSVのローカル確認ができます。ファイル内容は送信せず、データ取込もまだ実行しません。",
    labels: Object.freeze(items.map((item) => `${item.name}｜必要項目: ${item.fields}｜用途: ${item.purpose}`)),
    templates: Object.freeze(items.map((item, index) => createTemplate(item, CSV_TEMPLATES[index]))),
  });
}

export function renderCsvRequirements(container, items, documentRef = globalThis.document) {
  if (!container || !documentRef?.createElement) return false;
  const view = buildCsvRequirementsView(items);
  const heading = documentRef.createElement("h3");
  heading.textContent = "Data Operations Hubへ渡すデータ";
  const summary = documentRef.createElement("p");
  summary.textContent = view.summary;
  const readiness = documentRef.createElement("div");
  readiness.className = "csv-validation-summary";
  readiness.setAttribute("aria-live", "polite");
  const validationResults = Array(view.templates.length).fill(null);
  const updateReadiness = () => {
    const validCount = validationResults.filter((result) => result?.valid).length;
    const allReady = view.templates.length > 0 && validCount === view.templates.length;
    readiness.dataset.csvReady = allReady ? "LOCAL_FILES_READY" : "NOT_READY";
    readiness.dataset.csvReadyCount = String(validCount);
    readiness.textContent = view.templates.length
      ? allReady
        ? `ローカル確認 ${validCount}/${view.templates.length}完了。取込はまだ実行できません。`
        : `ローカル確認 ${validCount}/${view.templates.length}`
      : "ローカル確認は利用できません";
  };
  updateReadiness();
  const list = documentRef.createElement("div");
  list.className = "csv-template-list";
  if (!view.templates.length) {
    const fallback = documentRef.createElement("p");
    fallback.textContent = "CSV要件の確認待ち";
    list.append(fallback);
  }
  view.templates.forEach((template, index) => {
    const item = documentRef.createElement("div");
    item.className = "csv-template-item";
    const copy = documentRef.createElement("div");
    const name = documentRef.createElement("strong");
    name.textContent = template.name;
    const detail = documentRef.createElement("span");
    detail.textContent = `必要項目: ${template.fields}｜用途: ${template.purpose}`;
    copy.append(name, detail);
    const download = documentRef.createElement("a");
    download.className = "csv-template-download";
    download.href = template.href;
    download.download = template.filename;
    download.textContent = "CSVひな形を保存";
    download.setAttribute("aria-label", `${template.name}のCSVひな形を保存`);
    const actions = documentRef.createElement("div");
    actions.className = "csv-template-actions";
    const validate = documentRef.createElement("label");
    validate.className = "csv-template-validate";
    validate.textContent = "作成ファイルを確認";
    const input = documentRef.createElement("input");
    input.className = "csv-file-input";
    input.type = "file";
    input.setAttribute("accept", ".csv,text/csv");
    input.hidden = true;
    const status = documentRef.createElement("span");
    status.className = "csv-validation-status";
    status.textContent = "未確認";
    status.dataset.csvValidation = "NOT_CHECKED";
    status.setAttribute("aria-live", "polite");
    input.addEventListener("change", async (event) => {
      status.textContent = "確認中";
      status.dataset.csvValidation = "CHECKING";
      const result = await validateLocalCsvFile(index, event.currentTarget?.files?.[0]);
      validationResults[index] = result;
      status.textContent = validationMessage(result);
      status.dataset.csvValidation = result.category;
      updateReadiness();
      event.currentTarget.value = "";
    });
    validate.append(input);
    actions.append(download, validate);
    item.append(copy, actions, status);
    list.append(item);
  });
  container.dataset.csvRequirementStatus = view.status;
  container.dataset.csvLocalValidation = view.templates.length ? "ENABLED" : "DISABLED";
  container.replaceChildren(heading, summary, readiness, list);
  return true;
}
