const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 10000;
const HEADERS = Object.freeze([
  "store_name", "year_month", "technical_customer_count", "total_visit_count",
  "new_visit_count", "second_visit_count", "third_visit_count", "fixed_visit_count",
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
  if (!/^(?:0|[1-9]\d{0,8})$/u.test(text)) return null;
  const number = Number(text);
  return Number.isSafeInteger(number) ? number : null;
}

function receipt(category, rows = [], fileMeta = {}) {
  const safeRows = rows.slice(0, MAX_ROWS).map((row) => Object.freeze({ ...row }));
  return Object.freeze({
    schemaVersion: "management-store-visit-cohort-summary-local-v1",
    category,
    valid: category === "STORE_VISIT_COHORT_LOCAL_READY",
    rowCount: safeRows.length,
    rows: Object.freeze(safeRows),
    fileName: String(fileMeta.fileName || "").slice(0, 160),
    fileBytes: Number.isSafeInteger(fileMeta.fileBytes) ? fileMeta.fileBytes : 0,
    mutationCount: 0,
    uploadCount: 0,
    productionImportEnabled: false,
  });
}

export function parseStoreVisitCohortSummaryCsvText(text, fileMeta = {}) {
  const rows = parseCsv(text);
  if (!rows) return receipt("STORE_VISIT_COHORT_CSV_MALFORMED", [], fileMeta);
  if (!rows.length || rows[0].length !== HEADERS.length || rows[0].some((value, index) => value !== HEADERS[index])) return receipt("STORE_VISIT_COHORT_HEADER_MISMATCH", [], fileMeta);
  const dataRows = rows.slice(1);
  if (!dataRows.length) return receipt("STORE_VISIT_COHORT_NO_DATA", [], fileMeta);
  if (dataRows.length > MAX_ROWS) return receipt("STORE_VISIT_COHORT_ROW_LIMIT", [], fileMeta);
  const keys = new Set();
  const normalized = [];
  for (const row of dataRows) {
    if (row.length !== HEADERS.length) return receipt("STORE_VISIT_COHORT_ROW_SHAPE_INVALID", [], fileMeta);
    const storeName = String(row[0] || "").trim();
    const period = String(row[1] || "").trim();
    const [technicalCustomerCount, totalVisitCount, newVisitCount, secondVisitCount, thirdVisitCount, fixedVisitCount] = row.slice(2).map(count);
    if (!SAFE_STORE_RE.test(storeName) || storeName !== storeName.normalize("NFC") || !MONTH_RE.test(period) || [technicalCustomerCount, totalVisitCount, newVisitCount, secondVisitCount, thirdVisitCount, fixedVisitCount].some((value) => value == null)) return receipt("STORE_VISIT_COHORT_VALUE_INVALID", [], fileMeta);
    if (technicalCustomerCount > totalVisitCount || totalVisitCount !== newVisitCount + secondVisitCount + thirdVisitCount + fixedVisitCount) return receipt("STORE_VISIT_COHORT_TOTAL_MISMATCH", [], fileMeta);
    const key = `${storeName.normalize("NFKC").replace(/\s+/gu, "").toLowerCase()}\u001f${period}`;
    if (keys.has(key)) return receipt("STORE_VISIT_COHORT_DUPLICATE", [], fileMeta);
    keys.add(key);
    normalized.push({ storeName, period, technicalCustomerCount, totalVisitCount, newVisitCount, secondVisitCount, thirdVisitCount, fixedVisitCount });
  }
  return receipt("STORE_VISIT_COHORT_LOCAL_READY", normalized, fileMeta);
}

async function decodeCsvFile(file) {
  const buffer = await file.arrayBuffer();
  for (const encoding of ["utf-8", "shift_jis"]) {
    try { return new TextDecoder(encoding, { fatal: true }).decode(buffer); } catch { /* Try the next reviewed encoding. */ }
  }
  throw new Error("CSV_DECODE_FAILED");
}

export async function validateStoreVisitCohortSummaryCsvFile(file) {
  if (!file || typeof file.name !== "string" || !Number.isSafeInteger(file.size)) return receipt("STORE_VISIT_COHORT_FILE_INVALID");
  if (!file.name.toLowerCase().endsWith(".csv") || file.size <= 0 || file.size > MAX_FILE_BYTES || typeof file.arrayBuffer !== "function") return receipt("STORE_VISIT_COHORT_FILE_INVALID", [], { fileName: file.name, fileBytes: file.size });
  try { return parseStoreVisitCohortSummaryCsvText(await decodeCsvFile(file), { fileName: file.name, fileBytes: file.size }); }
  catch { return receipt("STORE_VISIT_COHORT_FILE_READ_FAILED", [], { fileName: file.name, fileBytes: file.size }); }
}

const LABELS = Object.freeze({
  STORE_VISIT_COHORT_LOCAL_READY: "来店区分集計をローカル検証しました。個人データ・本番投入はありません。",
  STORE_VISIT_COHORT_FILE_INVALID: "CSVファイルを選択してください（5MB以下）。",
  STORE_VISIT_COHORT_FILE_READ_FAILED: "CSVを読み取れませんでした。UTF-8 または Shift_JIS を確認してください。",
  STORE_VISIT_COHORT_CSV_MALFORMED: "CSVの形式を確認してください。",
  STORE_VISIT_COHORT_HEADER_MISMATCH: "指定の列順・列名と完全一致する集計CSVが必要です。",
  STORE_VISIT_COHORT_NO_DATA: "データ行がありません。",
  STORE_VISIT_COHORT_ROW_LIMIT: "データ行数が上限を超えています。",
  STORE_VISIT_COHORT_ROW_SHAPE_INVALID: "列数が一致しない行があります。",
  STORE_VISIT_COHORT_VALUE_INVALID: "店舗名、年月または件数に不正な値があります。",
  STORE_VISIT_COHORT_TOTAL_MISMATCH: "総来店件数は新規・2回目・3回目・固定の合計と一致させてください。",
  STORE_VISIT_COHORT_DUPLICATE: "同じ店舗・年月が重複しています。",
});

function templateHref() {
  const csv = `\uFEFF${HEADERS.join(",")}\r\n店舗名例,2026-06,0,0,0,0,0,0\r\n`;
  return `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
}

export function renderStoreVisitCohortSummaryIntake(container, options = {}) {
  const doc = options.document || container?.ownerDocument || globalThis.document;
  if (!container || !doc?.createElement || container.dataset.storeVisitCohortSummaryMounted === "true") return false;
  container.dataset.storeVisitCohortSummaryMounted = "true";
  const section = doc.createElement("section");
  section.className = "store-visit-cohort-summary-intake";
  const heading = doc.createElement("div");
  const copy = doc.createElement("div");
  const kicker = doc.createElement("p");
  kicker.className = "financial-intake-kicker";
  kicker.textContent = "STORE VISIT COHORT LOCAL VALIDATION";
  const title = doc.createElement("h4");
  title.textContent = "技術客数・来店区分集計CSV";
  const description = doc.createElement("p");
  description.textContent = "店舗・月単位の集計だけを確認します。新規、2回目、3回目、固定は重複なく総来店件数と一致させます。";
  copy.append(kicker, title, description);
  const actions = doc.createElement("div");
  const template = doc.createElement("a");
  template.className = "financial-mapping-download";
  template.href = templateHref();
  template.download = "store-visit-cohort-summary-template.csv";
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
  status.className = "store-visit-cohort-summary-status";
  status.dataset.storeVisitCohortSummaryStatus = "NOT_READY";
  status.textContent = "未読込";
  section.append(heading, status);
  container.replaceChildren(section);
  input.addEventListener("change", async () => {
    input.disabled = true;
    status.textContent = "読込中";
    const result = await validateStoreVisitCohortSummaryCsvFile(input.files?.[0]);
    input.value = "";
    input.disabled = false;
    status.dataset.storeVisitCohortSummaryStatus = result.category;
    status.textContent = `${LABELS[result.category] || "読込できませんでした。"}${result.valid ? ` ${result.rowCount} 店舗月` : ""}`;
    if (result.valid) container.dispatchEvent(new CustomEvent("management-store-visit-cohort-local-preview", { bubbles: true, detail: result }));
  });
  return true;
}
