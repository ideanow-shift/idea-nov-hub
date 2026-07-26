const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 10000;
const HEADERS = Object.freeze(["store_name", "year_month", "menu_category", "menu_name", "service_count", "sales_yen"]);
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

function integer(value) {
  const text = String(value ?? "").trim();
  if (!/^(?:0|[1-9]\d{0,11})$/u.test(text)) return null;
  const number = Number(text);
  return Number.isSafeInteger(number) ? number : null;
}

function receipt(category, rows = [], fileMeta = {}) {
  const safeRows = rows.slice(0, MAX_ROWS).map((row) => Object.freeze({ ...row }));
  return Object.freeze({
    schemaVersion: "management-store-menu-summary-local-v1", category,
    valid: category === "STORE_MENU_LOCAL_READY", rowCount: safeRows.length,
    rows: Object.freeze(safeRows), fileName: String(fileMeta.fileName || "").slice(0, 160),
    fileBytes: Number.isSafeInteger(fileMeta.fileBytes) ? fileMeta.fileBytes : 0,
    mutationCount: 0, uploadCount: 0, productionImportEnabled: false,
  });
}

export function parseStoreMenuSummaryCsvText(text, fileMeta = {}) {
  const rows = parseCsv(text);
  if (!rows) return receipt("STORE_MENU_CSV_MALFORMED", [], fileMeta);
  if (!rows.length || rows[0].length !== HEADERS.length || rows[0].some((value, index) => value !== HEADERS[index])) return receipt("STORE_MENU_HEADER_MISMATCH", [], fileMeta);
  const dataRows = rows.slice(1);
  if (!dataRows.length) return receipt("STORE_MENU_NO_DATA", [], fileMeta);
  if (dataRows.length > MAX_ROWS) return receipt("STORE_MENU_ROW_LIMIT", [], fileMeta);
  const keys = new Set(); const normalized = [];
  for (const row of dataRows) {
    if (row.length !== HEADERS.length) return receipt("STORE_MENU_ROW_SHAPE_INVALID", [], fileMeta);
    const [storeName, period, menuCategory, menuName] = row.slice(0, 4).map((value) => String(value || "").trim());
    const [serviceCount, salesYen] = row.slice(4).map(integer);
    if (![storeName, menuCategory, menuName].every((value) => SAFE_TEXT_RE.test(value) && value === value.normalize("NFC")) || !MONTH_RE.test(period) || serviceCount == null || salesYen == null) return receipt("STORE_MENU_VALUE_INVALID", [], fileMeta);
    const key = [storeName, period, menuCategory, menuName].map((value) => value.normalize("NFKC").replace(/\s+/gu, "").toLowerCase()).join("\u001f");
    if (keys.has(key)) return receipt("STORE_MENU_DUPLICATE", [], fileMeta);
    keys.add(key);
    normalized.push({ storeName, period, menuCategory, menuName, serviceCount, salesYen });
  }
  return receipt("STORE_MENU_LOCAL_READY", normalized, fileMeta);
}

async function decodeCsvFile(file) {
  const buffer = await file.arrayBuffer();
  for (const encoding of ["utf-8", "shift_jis"]) {
    try { return new TextDecoder(encoding, { fatal: true }).decode(buffer); } catch { /* Try next approved encoding. */ }
  }
  throw new Error("CSV_DECODE_FAILED");
}

export async function validateStoreMenuSummaryCsvFile(file) {
  if (!file || typeof file.name !== "string" || !Number.isSafeInteger(file.size)) return receipt("STORE_MENU_FILE_INVALID");
  if (!file.name.toLowerCase().endsWith(".csv") || file.size <= 0 || file.size > MAX_FILE_BYTES || typeof file.arrayBuffer !== "function") return receipt("STORE_MENU_FILE_INVALID", [], { fileName: file.name, fileBytes: file.size });
  try { return parseStoreMenuSummaryCsvText(await decodeCsvFile(file), { fileName: file.name, fileBytes: file.size }); }
  catch { return receipt("STORE_MENU_FILE_READ_FAILED", [], { fileName: file.name, fileBytes: file.size }); }
}

const LABELS = Object.freeze({
  STORE_MENU_LOCAL_READY: "ローカル確認用のメニュー集計CSVを読み込みました。個人の顧客情報は扱いません。",
  STORE_MENU_FILE_INVALID: "CSVファイルを選択してください。5MB以下のCSVのみ受け付けます。",
  STORE_MENU_FILE_READ_FAILED: "CSVを読み取れません。UTF-8 または Shift_JIS を確認してください。",
  STORE_MENU_CSV_MALFORMED: "CSVの形式を確認してください。",
  STORE_MENU_HEADER_MISMATCH: "ヘッダーがテンプレートと一致しません。",
  STORE_MENU_NO_DATA: "データ行がありません。",
  STORE_MENU_ROW_LIMIT: "データ行数が上限を超えています。",
  STORE_MENU_ROW_SHAPE_INVALID: "列数が一致しない行があります。",
  STORE_MENU_VALUE_INVALID: "店舗名・年月・メニュー分類・件数・売上の値を確認してください。",
  STORE_MENU_DUPLICATE: "同じ店舗・年月・分類・メニューが重複しています。集計済みの一行にまとめてください。",
});

function templateHref() {
  const csv = `\uFEFF${HEADERS.join(",")}\r\n店舗名,2026-06,カット,カット,0,0\r\n`;
  return `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
}

export function renderStoreMenuSummaryIntake(container, options = {}) {
  const doc = options.document || container?.ownerDocument || globalThis.document;
  if (!container || !doc?.createElement || container.dataset.storeMenuSummaryMounted === "true") return false;
  container.dataset.storeMenuSummaryMounted = "true";
  const section = doc.createElement("section"); section.className = "store-menu-summary-intake";
  const heading = doc.createElement("div"); const copy = doc.createElement("div");
  const kicker = doc.createElement("p"); kicker.className = "financial-intake-kicker"; kicker.textContent = "STORE MENU LOCAL VALIDATION";
  const title = doc.createElement("h4"); title.textContent = "メニュー別集計CSV";
  const description = doc.createElement("p"); description.textContent = "店舗・年月・メニュー分類ごとの件数と売上だけを確認します。顧客名、会員ID、明細データは含めないでください。";
  copy.append(kicker, title, description);
  const actions = doc.createElement("div");
  const template = doc.createElement("a"); template.className = "financial-mapping-download"; template.href = templateHref(); template.download = "store-menu-summary-template.csv"; template.textContent = "ひな形CSV";
  const label = doc.createElement("label"); label.className = "financial-mapping-download"; label.textContent = "CSVを選択";
  const input = doc.createElement("input"); input.type = "file"; input.accept = ".csv,text/csv"; input.hidden = true; label.append(input); actions.append(template, label); heading.append(copy, actions);
  const status = doc.createElement("p"); status.className = "store-menu-summary-status"; status.dataset.storeMenuSummaryStatus = "NOT_READY"; status.textContent = "未読込";
  section.append(heading, status); container.replaceChildren(section);
  input.addEventListener("change", async () => {
    input.disabled = true; status.textContent = "読込中";
    const result = await validateStoreMenuSummaryCsvFile(input.files?.[0]);
    input.value = ""; input.disabled = false; status.dataset.storeMenuSummaryStatus = result.category;
    status.textContent = `${LABELS[result.category] || "検証できませんでした。"}${result.valid ? ` ${result.rowCount} 行` : ""}`;
    if (result.valid) container.dispatchEvent(new CustomEvent("management-store-menu-local-preview", { bubbles: true, detail: result }));
  });
  return true;
}
