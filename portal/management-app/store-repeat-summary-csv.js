const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 10000;
const HEADERS = Object.freeze([
  "store_name",
  "year_month",
  "再来_売上金額",
  "固定_売上金額",
  "新規_売上金額",
  "準固定_売上金額",
  "再来_来店客数",
  "固定_来店客数",
  "新規_来店客数",
  "準固定_来店客数",
]);
const MONTH_RE = /^20\d{2}-(?:0[1-9]|1[0-2])$/u;
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
  if (cell !== "" || row.length) rows.push([...row, cell.replace(/\r$/u, "")]);
  while (rows.length && rows.at(-1).every((value) => value === "")) rows.pop();
  return rows;
}

function decimal(value) {
  const text = String(value ?? "").trim();
  if (!/^(?:0|[1-9]\d{0,14})(?:\.\d+)?$/u.test(text)) return null;
  const number = Number(text);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function receipt(category, rows = [], fileMeta = {}) {
  const safeRows = rows.slice(0, MAX_ROWS).map((row) => Object.freeze({ ...row }));
  return Object.freeze({
    schemaVersion: "management-store-repeat-summary-local-v1",
    category,
    valid: category === "STORE_REPEAT_LOCAL_READY",
    rowCount: safeRows.length,
    rows: Object.freeze(safeRows),
    fileName: String(fileMeta.fileName || "").slice(0, 160),
    fileBytes: Number.isSafeInteger(fileMeta.fileBytes) ? fileMeta.fileBytes : 0,
    mutationCount: 0,
    uploadCount: 0,
    productionImportEnabled: false,
  });
}

export function parseStoreRepeatSummaryCsvText(text, fileMeta = {}) {
  const rows = parseCsv(text);
  if (!rows) return receipt("STORE_REPEAT_CSV_MALFORMED", [], fileMeta);
  if (!rows.length || rows[0].length !== HEADERS.length || rows[0].some((value, index) => value !== HEADERS[index])) {
    return receipt("STORE_REPEAT_HEADER_MISMATCH", [], fileMeta);
  }
  const dataRows = rows.slice(1);
  if (!dataRows.length) return receipt("STORE_REPEAT_NO_DATA", [], fileMeta);
  if (dataRows.length > MAX_ROWS) return receipt("STORE_REPEAT_ROW_LIMIT", [], fileMeta);
  const keys = new Set();
  const normalized = [];
  for (const row of dataRows) {
    if (row.length !== HEADERS.length) return receipt("STORE_REPEAT_ROW_SHAPE_INVALID", [], fileMeta);
    const storeName = String(row[0] || "").trim();
    const period = String(row[1] || "").trim();
    if (!SAFE_STORE_RE.test(storeName) || storeName !== storeName.normalize("NFC") || !MONTH_RE.test(period)) {
      return receipt("STORE_REPEAT_VALUE_INVALID", [], fileMeta);
    }
    const values = row.slice(2).map(decimal);
    if (values.some((value) => value == null)) return receipt("STORE_REPEAT_VALUE_INVALID", [], fileMeta);
    const key = `${storeName.normalize("NFKC").replace(/\s+/gu, "").toLowerCase()}\u001f${period}`;
    if (keys.has(key)) return receipt("STORE_REPEAT_DUPLICATE", [], fileMeta);
    keys.add(key);
    const [returningSales, fixedSales, newSales, semiFixedSales, returningCustomers, fixedCustomers, newCustomers, semiFixedCustomers] = values;
    const totalCustomers = returningCustomers + fixedCustomers + newCustomers + semiFixedCustomers;
    const repeatCustomers = returningCustomers + fixedCustomers + semiFixedCustomers;
    normalized.push({
      storeName,
      period,
      returningSales,
      fixedSales,
      newSales,
      semiFixedSales,
      returningCustomers,
      fixedCustomers,
      newCustomers,
      semiFixedCustomers,
      totalCustomers,
      repeatCustomers,
      repeatRatePercent: totalCustomers ? (repeatCustomers / totalCustomers) * 100 : null,
    });
  }
  return receipt("STORE_REPEAT_LOCAL_READY", normalized, fileMeta);
}

async function decodeCsvFile(file) {
  const buffer = await file.arrayBuffer();
  for (const encoding of ["utf-8", "shift_jis"]) {
    try {
      const text = new TextDecoder(encoding, { fatal: true }).decode(buffer);
      if (!text.includes("\uFFFD")) return text;
    } catch {
      // Try the next reviewed encoding.
    }
  }
  throw new Error("CSV_DECODE_FAILED");
}

export async function validateStoreRepeatSummaryCsvFile(file) {
  if (!file || typeof file.name !== "string" || !Number.isSafeInteger(file.size)) return receipt("STORE_REPEAT_FILE_INVALID");
  if (!file.name.toLowerCase().endsWith(".csv")) return receipt("STORE_REPEAT_FILE_INVALID", [], { fileName: file.name, fileBytes: file.size });
  if (file.size <= 0 || file.size > MAX_FILE_BYTES || typeof file.arrayBuffer !== "function") {
    return receipt("STORE_REPEAT_FILE_INVALID", [], { fileName: file.name, fileBytes: file.size });
  }
  try {
    return parseStoreRepeatSummaryCsvText(await decodeCsvFile(file), { fileName: file.name, fileBytes: file.size });
  } catch {
    return receipt("STORE_REPEAT_FILE_READ_FAILED", [], { fileName: file.name, fileBytes: file.size });
  }
}

const LABELS = Object.freeze({
  STORE_REPEAT_LOCAL_READY: "ローカル集計を確認しました。本番投入は無効です。",
  STORE_REPEAT_FILE_INVALID: "CSVファイル（5MB以下）を選択してください。",
  STORE_REPEAT_FILE_READ_FAILED: "CSVを読み取れませんでした。UTF-8 または Shift_JIS を確認してください。",
  STORE_REPEAT_CSV_MALFORMED: "CSVの引用符または文字コードを確認してください。",
  STORE_REPEAT_HEADER_MISMATCH: "店舗リピート率・来店区分サマリの列構成と一致しません。",
  STORE_REPEAT_NO_DATA: "集計行がありません。",
  STORE_REPEAT_ROW_LIMIT: "集計行数が上限を超えています。",
  STORE_REPEAT_ROW_SHAPE_INVALID: "列数が揃っていない行があります。",
  STORE_REPEAT_VALUE_INVALID: "店舗名・年月・集計値に不正な値があります。",
  STORE_REPEAT_DUPLICATE: "同一の店舗・年月が重複しています。",
});

export function renderStoreRepeatSummaryIntake(container, options = {}) {
  const doc = options.document || container?.ownerDocument || globalThis.document;
  if (!container || !doc?.createElement || container.dataset.storeRepeatSummaryMounted === "true") return false;
  container.dataset.storeRepeatSummaryMounted = "true";
  const section = doc.createElement("section");
  section.className = "store-repeat-summary-intake";
  const heading = doc.createElement("div");
  const copy = doc.createElement("div");
  const kicker = doc.createElement("p");
  kicker.className = "financial-intake-kicker";
  kicker.textContent = "STORE KPI LOCAL VALIDATION";
  const title = doc.createElement("h4");
  title.textContent = "来店区分・リピート率CSV";
  const description = doc.createElement("p");
  description.textContent = "店舗・月次の集計CSVだけをローカルで検証します。個人名・顧客番号・明細は保持しません。";
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
  status.className = "store-repeat-summary-status";
  status.dataset.storeRepeatSummaryStatus = "NOT_READY";
  status.textContent = "未検証";
  section.append(heading, status);
  container.replaceChildren(section);
  input.addEventListener("change", async () => {
    input.disabled = true;
    status.textContent = "検証中";
    const result = await validateStoreRepeatSummaryCsvFile(input.files?.[0]);
    input.value = "";
    input.disabled = false;
    status.dataset.storeRepeatSummaryStatus = result.category;
    status.textContent = `${LABELS[result.category] || "検証できませんでした。"} ${result.valid ? `${result.rowCount} 店舗月` : ""}`.trim();
    if (result.valid) container.dispatchEvent(new CustomEvent("management-store-repeat-local-preview", { bubbles: true, detail: result }));
  });
  return true;
}
