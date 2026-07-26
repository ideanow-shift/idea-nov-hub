const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 10000;
const HEADERS = Object.freeze(["store_name", "year_month", "resident_headcount", "working_headcount"]);
const MONTH_RE = /^20\d{2}-(?:0[1-9]|1[0-2])$/u;
const SAFE_STORE_RE = /^[^\u0000-\u001f\u007f]{1,100}$/u;

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

function count(value) {
  const text = String(value ?? "").trim();
  if (!/^(?:0|[1-9]\d{0,5})$/u.test(text)) return null;
  const parsed = Number(text);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function receipt(category, rows = [], fileMeta = {}) {
  const safeRows = rows.slice(0, MAX_ROWS).map((row) => Object.freeze({ ...row }));
  return Object.freeze({
    schemaVersion: "management-store-workforce-monthly-local-v1",
    category,
    valid: category === "STORE_WORKFORCE_MONTHLY_LOCAL_READY",
    rowCount: safeRows.length,
    rows: Object.freeze(safeRows),
    fileName: String(fileMeta.fileName || "").slice(0, 160),
    fileBytes: Number.isSafeInteger(fileMeta.fileBytes) ? fileMeta.fileBytes : 0,
    mutationCount: 0,
    uploadCount: 0,
    productionImportEnabled: false,
  });
}

export function parseStoreWorkforceMonthlySummaryCsvText(text, fileMeta = {}) {
  const rows = parseCsv(text);
  if (!rows) return receipt("STORE_WORKFORCE_MONTHLY_CSV_MALFORMED", [], fileMeta);
  if (!rows.length || rows[0].length !== HEADERS.length || rows[0].some((value, index) => value !== HEADERS[index])) return receipt("STORE_WORKFORCE_MONTHLY_HEADER_MISMATCH", [], fileMeta);
  const dataRows = rows.slice(1);
  if (!dataRows.length) return receipt("STORE_WORKFORCE_MONTHLY_NO_DATA", [], fileMeta);
  if (dataRows.length > MAX_ROWS) return receipt("STORE_WORKFORCE_MONTHLY_ROW_LIMIT", [], fileMeta);
  const keys = new Set(); const normalized = [];
  for (const row of dataRows) {
    if (row.length !== HEADERS.length) return receipt("STORE_WORKFORCE_MONTHLY_ROW_SHAPE_INVALID", [], fileMeta);
    const storeName = String(row[0] || "").trim();
    const period = String(row[1] || "").trim();
    const [residentHeadcount, workingHeadcount] = row.slice(2).map(count);
    if (!SAFE_STORE_RE.test(storeName) || storeName !== storeName.normalize("NFC") || !MONTH_RE.test(period) || residentHeadcount == null || workingHeadcount == null) return receipt("STORE_WORKFORCE_MONTHLY_VALUE_INVALID", [], fileMeta);
    if (workingHeadcount > residentHeadcount) return receipt("STORE_WORKFORCE_MONTHLY_COUNT_MISMATCH", [], fileMeta);
    const key = `${storeName.normalize("NFKC").replace(/\s+/gu, "").toLowerCase()}\u001f${period}`;
    if (keys.has(key)) return receipt("STORE_WORKFORCE_MONTHLY_DUPLICATE", [], fileMeta);
    keys.add(key);
    normalized.push({ storeName, period, residentHeadcount, workingHeadcount });
  }
  return receipt("STORE_WORKFORCE_MONTHLY_LOCAL_READY", normalized, fileMeta);
}

async function decodeCsvFile(file) {
  const buffer = await file.arrayBuffer();
  for (const encoding of ["utf-8", "shift_jis"]) {
    try { return new TextDecoder(encoding, { fatal: true }).decode(buffer); } catch { /* Try next reviewed encoding. */ }
  }
  throw new Error("CSV_DECODE_FAILED");
}

export async function validateStoreWorkforceMonthlySummaryCsvFile(file) {
  if (!file || typeof file.name !== "string" || !Number.isSafeInteger(file.size)) return receipt("STORE_WORKFORCE_MONTHLY_FILE_INVALID");
  if (!file.name.toLowerCase().endsWith(".csv") || file.size <= 0 || file.size > MAX_FILE_BYTES || typeof file.arrayBuffer !== "function") return receipt("STORE_WORKFORCE_MONTHLY_FILE_INVALID", [], { fileName: file.name, fileBytes: file.size });
  try { return parseStoreWorkforceMonthlySummaryCsvText(await decodeCsvFile(file), { fileName: file.name, fileBytes: file.size }); }
  catch { return receipt("STORE_WORKFORCE_MONTHLY_FILE_READ_FAILED", [], { fileName: file.name, fileBytes: file.size }); }
}

const LABELS = Object.freeze({
  STORE_WORKFORCE_MONTHLY_LOCAL_READY: "\u6708\u6b21\u5e97\u8217\u5225\u4eba\u6570CSV\u3092\u30ed\u30fc\u30ab\u30eb\u3067\u691c\u8a3c\u3057\u307e\u3057\u305f\u3002\u672c\u756a\u4fdd\u5b58\u30fb\u6295\u5165\u306f\u7121\u52b9\u3067\u3059\u3002",
  STORE_WORKFORCE_MONTHLY_FILE_INVALID: "CSV\u30d5\u30a1\u30a4\u30eb\u3092\u9078\u629e\u3057\u3066\u304f\u3060\u3055\u3044\u3002",
  STORE_WORKFORCE_MONTHLY_FILE_READ_FAILED: "CSV\u3092\u8aad\u307f\u8fbc\u3081\u307e\u305b\u3093\u3067\u3057\u305f\u3002UTF-8\u307e\u305f\u306fShift_JIS\u3092\u78ba\u8a8d\u3057\u3066\u304f\u3060\u3055\u3044\u3002",
  STORE_WORKFORCE_MONTHLY_CSV_MALFORMED: "CSV\u5f62\u5f0f\u3092\u78ba\u8a8d\u3067\u304d\u307e\u305b\u3093\u3002",
  STORE_WORKFORCE_MONTHLY_HEADER_MISMATCH: "\u30d8\u30c3\u30c0\u30fc\u304c\u30c6\u30f3\u30d7\u30ec\u30fc\u30c8\u3068\u4e00\u81f4\u3057\u307e\u305b\u3093\u3002",
  STORE_WORKFORCE_MONTHLY_NO_DATA: "\u30c7\u30fc\u30bf\u884c\u304c\u3042\u308a\u307e\u305b\u3093\u3002",
  STORE_WORKFORCE_MONTHLY_ROW_LIMIT: "\u30c7\u30fc\u30bf\u884c\u6570\u304c\u4e0a\u9650\u3092\u8d85\u3048\u3066\u3044\u307e\u3059\u3002",
  STORE_WORKFORCE_MONTHLY_ROW_SHAPE_INVALID: "\u30c7\u30fc\u30bf\u5217\u6570\u304c\u4e00\u81f4\u3057\u307e\u305b\u3093\u3002",
  STORE_WORKFORCE_MONTHLY_VALUE_INVALID: "\u5e97\u8217\u540d\u30fb\u5bfe\u8c61\u6708\u30fb\u4eba\u6570\u306e\u5024\u3092\u78ba\u8a8d\u3057\u3066\u304f\u3060\u3055\u3044\u3002",
  STORE_WORKFORCE_MONTHLY_COUNT_MISMATCH: "\u7a3c\u50cd\u4eba\u6570\u304c\u5728\u7c4d\u4eba\u6570\u3092\u8d85\u3048\u3066\u3044\u307e\u3059\u3002",
  STORE_WORKFORCE_MONTHLY_DUPLICATE: "\u540c\u3058\u5e97\u8217\u30fb\u5bfe\u8c61\u6708\u304c\u91cd\u8907\u3057\u3066\u3044\u307e\u3059\u3002",
});

function templateHref() {
  const csv = buildStoreWorkforceMonthlySummaryCsvTemplate();
  return `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/u.test(text) ? `"${text.replace(/"/gu, '""')}"` : text;
}

export function buildStoreWorkforceMonthlySummaryCsvTemplate(candidates = []) {
  const seen = new Set();
  const normalized = (Array.isArray(candidates) ? candidates : []).map((candidate) => {
    const storeName = String(candidate?.storeName || "").trim();
    const period = String(candidate?.period || "").trim();
    const key = `${storeName.normalize("NFKC").replace(/\s+/gu, "").toLowerCase()}\u001f${period}`;
    if (!SAFE_STORE_RE.test(storeName) || !MONTH_RE.test(period) || seen.has(key)) return null;
    seen.add(key);
    return { storeName, period };
  }).filter(Boolean).sort((left, right) => left.period.localeCompare(right.period) || left.storeName.localeCompare(right.storeName, "ja"));
  const dataRows = normalized.length ? normalized : [{ storeName: "store-example", period: "2026-06" }];
  return `\uFEFF${HEADERS.join(",")}\r\n${dataRows.map((row) => [row.storeName, row.period, "", ""].map(csvCell).join(",")).join("\r\n")}\r\n`;
}

export function renderStoreWorkforceMonthlySummaryIntake(container, options = {}) {
  const doc = options.document || container?.ownerDocument || globalThis.document;
  if (!container || !doc?.createElement || container.dataset.storeWorkforceMonthlySummaryMounted === "true") return false;
  container.dataset.storeWorkforceMonthlySummaryMounted = "true";
  const section = doc.createElement("section"); section.className = "store-workforce-monthly-summary-intake";
  const heading = doc.createElement("div"); const copy = doc.createElement("div");
  const kicker = doc.createElement("p"); kicker.className = "financial-intake-kicker"; kicker.textContent = "STORE WORKFORCE LOCAL VALIDATION";
  const title = doc.createElement("h4"); title.textContent = "\u6708\u6b21\u5e97\u8217\u5225\u4eba\u6570CSV";
  const description = doc.createElement("p"); description.textContent = "\u5e97\u8217\u30fb\u5bfe\u8c61\u6708\u3054\u3068\u306e\u5728\u7c4d\u4eba\u6570\u3068\u7a3c\u50cd\u4eba\u6570\u3060\u3051\u3092\u691c\u8a3c\u3057\u307e\u3059\u3002\u500b\u4eba\u60c5\u5831\u306f\u542b\u3081\u307e\u305b\u3093\u3002";
  copy.append(kicker, title, description);
  const actions = doc.createElement("div");
  const template = doc.createElement("a"); template.className = "financial-mapping-download"; template.href = templateHref(); template.download = "store-workforce-monthly-summary-template.csv"; template.textContent = "\u3072\u306a\u5f62CSV";
  const label = doc.createElement("label"); label.className = "financial-mapping-download"; label.textContent = "CSV\u3092\u9078\u629e";
  const input = doc.createElement("input"); input.type = "file"; input.accept = ".csv,text/csv"; input.hidden = true; label.append(input); actions.append(template, label); heading.append(copy, actions);
  const status = doc.createElement("p"); status.className = "store-workforce-monthly-summary-status"; status.dataset.storeWorkforceMonthlySummaryStatus = "NOT_READY"; status.textContent = "\u672a\u78ba\u8a8d";
  section.append(heading, status); container.replaceChildren(section);
  input.addEventListener("change", async () => {
    input.disabled = true; status.textContent = "\u691c\u8a3c\u4e2d";
    const result = await validateStoreWorkforceMonthlySummaryCsvFile(input.files?.[0]);
    input.value = ""; input.disabled = false; status.dataset.storeWorkforceMonthlySummaryStatus = result.category;
    status.textContent = `${LABELS[result.category] || "\u691c\u8a3c\u3067\u304d\u307e\u305b\u3093\u3067\u3057\u305f\u3002"}${result.valid ? ` ${result.rowCount}\u4ef6` : ""}`;
    if (result.valid) container.dispatchEvent(new CustomEvent("management-store-workforce-monthly-local-preview", { bubbles: true, detail: result }));
  });
  return true;
}
