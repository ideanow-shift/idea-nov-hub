const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 10000;
const HEADERS = Object.freeze(["period", "corporation", "store", "total_sales_plan", "profit_plan"]);
const MONTH_RE = /^20\d{2}-(?:0[1-9]|1[0-2])$/u;
const SAFE_TEXT_RE = /^[^\u0000-\u001f\u007f]{1,100}$/u;

function parseCsv(text) {
  if (typeof text !== "string" || text.includes("\u0000") || text.includes("\uFFFD")) return null;
  const source = text.replace(/^\uFEFF/u, "");
  const rows = [];
  let row = []; let cell = ""; let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') { cell += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"' && cell === "") quoted = true;
    else if (char === ",") { row.push(cell); cell = ""; }
    else if (char === "\n") { row.push(cell.replace(/\r$/u, "")); rows.push(row); row = []; cell = ""; }
    else cell += char;
  }
  if (quoted) return null;
  if (cell !== "" || row.length) rows.push([...row, cell.replace(/\r$/u, "")]);
  while (rows.length && rows.at(-1).every((value) => value === "")) rows.pop();
  return rows;
}

function integerYen(value, optional = false) {
  const text = String(value ?? "").trim();
  if (optional && text === "NOT_IN_SOURCE") return null;
  if (!/^(?:0|[1-9]\d{0,14})$/u.test(text)) return undefined;
  const number = Number(text);
  return Number.isSafeInteger(number) ? number : undefined;
}

function receipt(category, rows = [], fileMeta = {}) {
  const safeRows = rows.slice(0, MAX_ROWS).map((row) => Object.freeze({ ...row }));
  return Object.freeze({
    schemaVersion: "management-store-monthly-budget-local-v1",
    category,
    valid: category === "STORE_MONTHLY_BUDGET_LOCAL_READY",
    rowCount: safeRows.length,
    rows: Object.freeze(safeRows),
    fileName: String(fileMeta.fileName || "").slice(0, 160),
    fileBytes: Number.isSafeInteger(fileMeta.fileBytes) ? fileMeta.fileBytes : 0,
    mutationCount: 0,
    uploadCount: 0,
    productionImportEnabled: false,
  });
}

export function parseStoreMonthlyBudgetCsvText(text, fileMeta = {}) {
  const rows = parseCsv(text);
  if (!rows) return receipt("STORE_MONTHLY_BUDGET_CSV_MALFORMED", [], fileMeta);
  if (!rows.length || rows[0].length !== HEADERS.length || rows[0].some((value, index) => value !== HEADERS[index])) return receipt("STORE_MONTHLY_BUDGET_HEADER_MISMATCH", [], fileMeta);
  const dataRows = rows.slice(1);
  if (!dataRows.length) return receipt("STORE_MONTHLY_BUDGET_NO_DATA", [], fileMeta);
  if (dataRows.length > MAX_ROWS) return receipt("STORE_MONTHLY_BUDGET_ROW_LIMIT", [], fileMeta);
  const keys = new Set(); const normalized = [];
  for (const row of dataRows) {
    if (row.length !== HEADERS.length) return receipt("STORE_MONTHLY_BUDGET_ROW_SHAPE_INVALID", [], fileMeta);
    const [period, corporationName, storeName] = row.slice(0, 3).map((value) => String(value || "").trim());
    const salesPlanYen = integerYen(row[3]);
    const profitPlanYen = integerYen(row[4], true);
    if (!MONTH_RE.test(period) || ![corporationName, storeName].every((value) => SAFE_TEXT_RE.test(value) && value === value.normalize("NFC")) || salesPlanYen === undefined || profitPlanYen === undefined) return receipt("STORE_MONTHLY_BUDGET_VALUE_INVALID", [], fileMeta);
    if (salesPlanYen <= 0) return receipt("STORE_MONTHLY_BUDGET_VALUE_INVALID", [], fileMeta);
    const key = [period, corporationName, storeName].map((value) => value.normalize("NFKC").replace(/\s+/gu, " ").toLowerCase()).join("\u001f");
    if (keys.has(key)) return receipt("STORE_MONTHLY_BUDGET_DUPLICATE", [], fileMeta);
    keys.add(key);
    normalized.push({ period, corporationName, storeName, salesPlanYen, profitPlanYen });
  }
  return receipt("STORE_MONTHLY_BUDGET_LOCAL_READY", normalized, fileMeta);
}

async function decodeCsvFile(file) {
  const buffer = await file.arrayBuffer();
  for (const encoding of ["utf-8", "shift_jis"]) {
    try { return new TextDecoder(encoding, { fatal: true }).decode(buffer); } catch { /* Try next approved encoding. */ }
  }
  throw new Error("CSV_DECODE_FAILED");
}

export async function validateStoreMonthlyBudgetCsvFile(file) {
  if (!file || typeof file.name !== "string" || !Number.isSafeInteger(file.size)) return receipt("STORE_MONTHLY_BUDGET_FILE_INVALID");
  if (!file.name.toLowerCase().endsWith(".csv") || file.size <= 0 || file.size > MAX_FILE_BYTES || typeof file.arrayBuffer !== "function") return receipt("STORE_MONTHLY_BUDGET_FILE_INVALID", [], { fileName: file.name, fileBytes: file.size });
  try { return parseStoreMonthlyBudgetCsvText(await decodeCsvFile(file), { fileName: file.name, fileBytes: file.size }); }
  catch { return receipt("STORE_MONTHLY_BUDGET_FILE_READ_FAILED", [], { fileName: file.name, fileBytes: file.size }); }
}

const LABELS = Object.freeze({
  STORE_MONTHLY_BUDGET_LOCAL_READY: "店舗月次目標CSVをローカル検証しました。経理P/Lの実績は変更しません。",
  STORE_MONTHLY_BUDGET_FILE_INVALID: "CSVファイルを選択してください。5MB以下のCSVのみ受け付けます。",
  STORE_MONTHLY_BUDGET_FILE_READ_FAILED: "CSVを読み取れません。UTF-8 または Shift_JIS を確認してください。",
  STORE_MONTHLY_BUDGET_CSV_MALFORMED: "CSVの形式を確認してください。",
  STORE_MONTHLY_BUDGET_HEADER_MISMATCH: "period、corporation、store、total_sales_plan、profit_plan の順で列が必要です。",
  STORE_MONTHLY_BUDGET_NO_DATA: "データ行がありません。",
  STORE_MONTHLY_BUDGET_ROW_LIMIT: "データ行数が上限を超えています。",
  STORE_MONTHLY_BUDGET_ROW_SHAPE_INVALID: "列数が一致しない行があります。",
  STORE_MONTHLY_BUDGET_VALUE_INVALID: "対象月・法人・店舗・目標金額を確認してください。目標売上は0より大きい円の整数です。",
  STORE_MONTHLY_BUDGET_DUPLICATE: "同じ対象月・法人・店舗が重複しています。",
});

function templateHref() {
  const csv = `\uFEFF${HEADERS.join(",")}\r\n2026-06,法人名,店舗名,0,NOT_IN_SOURCE\r\n`;
  return `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
}

export function renderStoreMonthlyBudgetIntake(container, options = {}) {
  const doc = options.document || container?.ownerDocument || globalThis.document;
  if (!container || !doc?.createElement || container.dataset.storeMonthlyBudgetMounted === "true") return false;
  container.dataset.storeMonthlyBudgetMounted = "true";
  const section = doc.createElement("section");
  section.className = "store-monthly-budget-intake";
  const heading = doc.createElement("div");
  const copy = doc.createElement("div");
  const kicker = doc.createElement("p");
  kicker.className = "financial-intake-kicker";
  kicker.textContent = "STORE MONTHLY BUDGET LOCAL VALIDATION";
  const title = doc.createElement("h4");
  title.textContent = "店舗別・月別目標CSV";
  const description = doc.createElement("p");
  description.textContent = "目標売上・目標損益を店舗月単位でローカル照合します。経理P/Lの実績は上書きせず、個人データも保持しません。";
  copy.append(kicker, title, description);
  const actions = doc.createElement("div");
  actions.className = "financial-intake-heading-actions";
  const template = doc.createElement("a");
  template.className = "financial-mapping-download";
  template.href = templateHref();
  template.download = "store-monthly-budget-template.csv";
  template.textContent = "ひな形CSV";
  const label = doc.createElement("label");
  label.className = "financial-mapping-download";
  label.textContent = "CSVを選択";
  const input = doc.createElement("input");
  input.type = "file";
  input.accept = ".csv,text/csv";
  input.hidden = true;
  label.append(input);
  actions.append(template, label);
  heading.append(copy, actions);
  const status = doc.createElement("p");
  status.className = "store-monthly-budget-status";
  status.dataset.storeMonthlyBudgetStatus = "NOT_READY";
  status.textContent = "未読込";
  section.append(heading, status);
  container.replaceChildren(section);
  input.addEventListener("change", async () => {
    input.disabled = true;
    status.textContent = "読込中";
    const result = await validateStoreMonthlyBudgetCsvFile(input.files?.[0]);
    input.value = "";
    input.disabled = false;
    status.dataset.storeMonthlyBudgetStatus = result.category;
    status.textContent = `${LABELS[result.category] || "読込できませんでした。"}${result.valid ? ` ${result.rowCount} 店舗月` : ""}`;
    if (result.valid) container.dispatchEvent(new CustomEvent("management-store-monthly-budget-local-preview", { bubbles: true, detail: result }));
  });
  return true;
}
