const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 10000;
const HEADERS = Object.freeze(["店舗", "年月", "来店件数", "総合計売上", "技術売上", "店販売上", "平均客単価"]);
const MONTH_RE = /^20\d{2}年(?:0?[1-9]|1[0-2])月$/u;
const SAFE_STORE_RE = /^[^\u0000-\u001f\u007f]{1,100}$/u;

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

function nonNegativeInteger(value) {
  const text = String(value ?? "").trim();
  if (!/^(?:0|[1-9]\d{0,14})$/u.test(text)) return null;
  const parsed = Number(text);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function normalizePeriod(value) {
  const match = String(value ?? "").trim().match(/^([0-9]{4})年(0?[1-9]|1[0-2])月$/u);
  return match ? `${match[1]}-${match[2].padStart(2, "0")}` : null;
}

function receipt(category, rows = [], fileMeta = {}) {
  const safeRows = rows.slice(0, MAX_ROWS).map((row) => Object.freeze({ ...row }));
  return Object.freeze({
    schemaVersion: "management-store-customer-summary-local-v1",
    category,
    valid: category === "STORE_CUSTOMER_LOCAL_READY",
    rowCount: safeRows.length,
    rows: Object.freeze(safeRows),
    fileName: String(fileMeta.fileName || "").slice(0, 160),
    fileBytes: Number.isSafeInteger(fileMeta.fileBytes) ? fileMeta.fileBytes : 0,
    mutationCount: 0,
    uploadCount: 0,
    productionImportEnabled: false,
  });
}

export function parseStoreCustomerSummaryCsvText(text, fileMeta = {}) {
  const rows = parseCsv(text);
  if (!rows) return receipt("STORE_CUSTOMER_CSV_MALFORMED", [], fileMeta);
  if (!rows.length || rows[0].length !== HEADERS.length || rows[0].some((value, index) => value !== HEADERS[index])) return receipt("STORE_CUSTOMER_HEADER_MISMATCH", [], fileMeta);
  const dataRows = rows.slice(1);
  if (!dataRows.length) return receipt("STORE_CUSTOMER_NO_DATA", [], fileMeta);
  if (dataRows.length > MAX_ROWS) return receipt("STORE_CUSTOMER_ROW_LIMIT", [], fileMeta);
  const keys = new Set();
  const normalized = [];
  for (const row of dataRows) {
    if (row.length !== HEADERS.length) return receipt("STORE_CUSTOMER_ROW_SHAPE_INVALID", [], fileMeta);
    const storeName = String(row[0] || "").trim();
    const period = normalizePeriod(row[1]);
    const values = row.slice(2).map(nonNegativeInteger);
    if (!SAFE_STORE_RE.test(storeName) || storeName !== storeName.normalize("NFC") || !MONTH_RE.test(String(row[1] || "").trim()) || !period || values.some((value) => value == null)) return receipt("STORE_CUSTOMER_VALUE_INVALID", [], fileMeta);
    const key = `${storeName.normalize("NFKC").replace(/\s+/gu, "").toLowerCase()}\u001f${period}`;
    if (keys.has(key)) return receipt("STORE_CUSTOMER_DUPLICATE", [], fileMeta);
    keys.add(key);
    normalized.push({ storeName, period, visitCount: values[0] });
  }
  return receipt("STORE_CUSTOMER_LOCAL_READY", normalized, fileMeta);
}

async function decodeCsvFile(file) {
  const buffer = await file.arrayBuffer();
  for (const encoding of ["utf-8", "shift_jis"]) {
    try { return new TextDecoder(encoding, { fatal: true }).decode(buffer); } catch { /* Try the next reviewed encoding. */ }
  }
  throw new Error("CSV_DECODE_FAILED");
}

export async function validateStoreCustomerSummaryCsvFile(file) {
  if (!file || typeof file.name !== "string" || !Number.isSafeInteger(file.size)) return receipt("STORE_CUSTOMER_FILE_INVALID");
  if (!file.name.toLowerCase().endsWith(".csv") || file.size <= 0 || file.size > MAX_FILE_BYTES || typeof file.arrayBuffer !== "function") return receipt("STORE_CUSTOMER_FILE_INVALID", [], { fileName: file.name, fileBytes: file.size });
  try { return parseStoreCustomerSummaryCsvText(await decodeCsvFile(file), { fileName: file.name, fileBytes: file.size }); }
  catch { return receipt("STORE_CUSTOMER_FILE_READ_FAILED", [], { fileName: file.name, fileBytes: file.size }); }
}

const LABELS = Object.freeze({
  STORE_CUSTOMER_LOCAL_READY: "来店件数をローカル検証しました。経理P/Lの売上は変更しません。",
  STORE_CUSTOMER_FILE_INVALID: "CSVファイルを選択してください（5MB以下）。",
  STORE_CUSTOMER_FILE_READ_FAILED: "CSVを読み取れませんでした。UTF-8 または Shift_JIS を確認してください。",
  STORE_CUSTOMER_CSV_MALFORMED: "CSVの形式を確認してください。",
  STORE_CUSTOMER_HEADER_MISMATCH: "店舗、年月、来店件数、総合計売上、技術売上、店販売上、平均客単価の順で列が必要です。",
  STORE_CUSTOMER_NO_DATA: "データ行がありません。",
  STORE_CUSTOMER_ROW_LIMIT: "データ行数が上限を超えています。",
  STORE_CUSTOMER_ROW_SHAPE_INVALID: "列数が一致しない行があります。",
  STORE_CUSTOMER_VALUE_INVALID: "店舗名、年月、来店件数または数値に不正な値があります。",
  STORE_CUSTOMER_DUPLICATE: "同じ店舗・年月が重複しています。",
});

export function renderStoreCustomerSummaryIntake(container, options = {}) {
  const doc = options.document || container?.ownerDocument || globalThis.document;
  if (!container || !doc?.createElement || container.dataset.storeCustomerSummaryMounted === "true") return false;
  container.dataset.storeCustomerSummaryMounted = "true";
  const section = doc.createElement("section");
  section.className = "store-customer-summary-intake";
  const heading = doc.createElement("div");
  const copy = doc.createElement("div");
  const kicker = doc.createElement("p");
  kicker.className = "financial-intake-kicker";
  kicker.textContent = "STORE CUSTOMER LOCAL VALIDATION";
  const title = doc.createElement("h4");
  title.textContent = "店舗別・月別来店件数CSV";
  const description = doc.createElement("p");
  description.textContent = "来店件数だけをローカルで確認します。経理P/Lの売上・利益を上書きせず、個人データも保持しません。";
  copy.append(kicker, title, description);
  const label = doc.createElement("label");
  label.className = "financial-mapping-download";
  label.textContent = "CSVを選択";
  const input = doc.createElement("input");
  input.type = "file";
  input.accept = ".csv,text/csv";
  input.hidden = true;
  label.append(input);
  heading.append(copy, label);
  const status = doc.createElement("p");
  status.className = "store-customer-summary-status";
  status.dataset.storeCustomerSummaryStatus = "NOT_READY";
  status.textContent = "未読込";
  section.append(heading, status);
  container.replaceChildren(section);
  input.addEventListener("change", async () => {
    input.disabled = true;
    status.textContent = "読込中";
    const result = await validateStoreCustomerSummaryCsvFile(input.files?.[0]);
    input.value = "";
    input.disabled = false;
    status.dataset.storeCustomerSummaryStatus = result.category;
    status.textContent = `${LABELS[result.category] || "読込できませんでした。"}${result.valid ? ` ${result.rowCount} 店舗月` : ""}`;
    if (result.valid) container.dispatchEvent(new CustomEvent("management-store-customer-local-preview", { bubbles: true, detail: result }));
  });
  return true;
}
