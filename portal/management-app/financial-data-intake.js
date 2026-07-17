const MONTH_LABEL_RE = /^(?:[1-9]|1[0-2])月度$/u;
const MAX_FINANCIAL_FILE_BYTES = 25 * 1024 * 1024;
const YAYOI_PL_REQUIRED_ACCOUNTS = Object.freeze([
  "売上高合計",
  "売上原価",
  "売上総損益金額",
  "給与手当",
  "法定福利費",
  "福利厚生費",
  "地代家賃",
  "水道光熱費",
  "広告宣伝費",
  "販売管理費合計",
  "営業損益金額",
  "経常損益金額",
]);
const BS_REQUIRED_ACCOUNTS = Object.freeze(["資産合計", "負債合計", "純資産合計"]);
const PL_MAPPING_CANDIDATES = Object.freeze({
  "地代家賃": Object.freeze(["賃借料"]),
  "販売管理費合計": Object.freeze(["販売管理費計"]),
});
const FINANCIAL_COMPLETION_REQUIREMENTS = Object.freeze([
  Object.freeze({ key: "PL_ANNUAL_REPORT", label: "部門別年間P/L", detail: "弥生会計の部門別年間推移" }),
  Object.freeze({ key: "PL_ACCOUNT_MAPPING", label: "P/L勘定科目対応表", detail: "地代家賃・販売管理費合計を含む正規科目への対応" }),
  Object.freeze({ key: "SALES_SUBLEDGER", label: "売上高の補助残高一覧表", detail: "店舗別売上の照合元" }),
  Object.freeze({ key: "UTILITY_SUBLEDGER", label: "水道光熱費の補助残高一覧表", detail: "店舗別水道光熱費の照合元" }),
  Object.freeze({ key: "COUPON_USAGE", label: "クーポン利用額", detail: "経理手順で別入力される月次値" }),
  Object.freeze({ key: "BALANCE_SHEET", label: "B/S年間データ", detail: "資産・負債・純資産の貸借一致確認" }),
  Object.freeze({ key: "BUDGET_PLAN", label: "予算・計画データ", detail: "予実比較に使用する月次計画" }),
  Object.freeze({ key: "FC_RULE", label: "FC店舗の変換ルール", detail: "FC合計・共通・個店の二重計上防止" }),
]);
const AGGREGATE_SHEET_RE = /(?:全体|合計|共通|FC\(合計\))/u;
const XML_ESCAPE_RE = /&(lt|gt|amp|quot|apos);/g;
const XML_ESCAPE_MAP = Object.freeze({ lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" });
const XLSX_TEXT_ENTRY_RE = /^(?:xl\/(?:workbook\.xml|sharedStrings\.xml|_rels\/workbook\.xml\.rels|worksheets\/sheet\d+\.xml)|\[Content_Types\]\.xml|_rels\/\.rels)$/u;

function xmlText(value) {
  return String(value ?? "").replace(XML_ESCAPE_RE, (_, key) => XML_ESCAPE_MAP[key]);
}

function stripTags(value) {
  return xmlText(String(value ?? "").replace(/<[^>]+>/g, ""));
}

function attr(tag, name) {
  const match = String(tag).match(new RegExp(`${name}="([^"]*)"`));
  return match ? xmlText(match[1]) : null;
}

function columnIndex(ref) {
  const letters = String(ref || "").match(/^[A-Z]+/i)?.[0]?.toUpperCase();
  if (!letters) return -1;
  let value = 0;
  for (const ch of letters) value = value * 26 + ch.charCodeAt(0) - 64;
  return value - 1;
}

function findEndOfCentralDirectory(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let offset = bytes.byteLength - 22; offset >= Math.max(0, bytes.byteLength - 66000); offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) return offset;
  }
  throw new Error("ZIP_EOCD_NOT_FOUND");
}

async function inflateRaw(bytes, options) {
  if (options?.inflateRaw) return options.inflateRaw(bytes);
  if (typeof DecompressionStream !== "function") throw new Error("ZIP_DEFLATE_UNSUPPORTED");
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function readXlsxEntries(arrayBuffer, options = {}) {
  const bytes = new Uint8Array(arrayBuffer);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findEndOfCentralDirectory(bytes);
  const entryCount = view.getUint16(eocd + 10, true);
  let pointer = view.getUint32(eocd + 16, true);
  const entries = new Map();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  for (let index = 0; index < entryCount; index += 1) {
    if (view.getUint32(pointer, true) !== 0x02014b50) throw new Error("ZIP_CENTRAL_DIRECTORY_INVALID");
    const method = view.getUint16(pointer + 10, true);
    const compressedSize = view.getUint32(pointer + 20, true);
    const fileNameLength = view.getUint16(pointer + 28, true);
    const extraLength = view.getUint16(pointer + 30, true);
    const commentLength = view.getUint16(pointer + 32, true);
    const localOffset = view.getUint32(pointer + 42, true);
    const name = decoder.decode(bytes.subarray(pointer + 46, pointer + 46 + fileNameLength)).replace(/\\/g, "/");
    if (view.getUint32(localOffset, true) !== 0x04034b50) throw new Error("ZIP_LOCAL_HEADER_INVALID");
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.subarray(dataStart, dataStart + compressedSize);
    let data;
    if (method === 0) data = compressed;
    else if (method === 8) data = await inflateRaw(compressed, options);
    else throw new Error("ZIP_COMPRESSION_UNSUPPORTED");
    if (XLSX_TEXT_ENTRY_RE.test(name)) entries.set(name, decoder.decode(data));
    pointer += 46 + fileNameLength + extraLength + commentLength;
  }
  return entries;
}

function parseSharedStrings(entries) {
  const xml = entries.get("xl/sharedStrings.xml");
  if (!xml) return [];
  return [...xml.matchAll(/<si\b[\s\S]*?<\/si>/g)].map(([item]) => {
    const parts = [...item.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(([, value]) => xmlText(value));
    return parts.length ? parts.join("") : stripTags(item);
  });
}

function parseWorkbook(entries) {
  const workbook = entries.get("xl/workbook.xml");
  const rels = entries.get("xl/_rels/workbook.xml.rels");
  if (!workbook || !rels) throw new Error("XLSX_WORKBOOK_MISSING");
  const relTargetById = new Map([...rels.matchAll(/<Relationship\b[^>]*>/g)].map(([tag]) => {
    const target = attr(tag, "Target");
    return [attr(tag, "Id"), target?.startsWith("/") ? target.slice(1) : `xl/${target}`];
  }));
  return [...workbook.matchAll(/<sheet\b[^>]*>/g)].map(([tag]) => ({
    name: attr(tag, "name"),
    path: relTargetById.get(attr(tag, "r:id")),
  })).filter((sheet) => sheet.name && sheet.path);
}

function parseRows(entries, sheet, sharedStrings) {
  const xml = entries.get(sheet.path);
  if (!xml) throw new Error("XLSX_SHEET_MISSING");
  return [...xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)].map(([, rowXml]) => {
    const cells = [];
    for (const [, cellTag, cellBody] of rowXml.matchAll(/(<c\b[^>]*>)([\s\S]*?)<\/c>/g)) {
      const col = columnIndex(attr(cellTag, "r"));
      const type = attr(cellTag, "t");
      const raw = cellBody.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";
      const inline = cellBody.match(/<is>([\s\S]*?)<\/is>/)?.[1];
      let value = "";
      if (type === "s") value = sharedStrings[Number(raw)] ?? "";
      else if (type === "inlineStr") value = inline ? stripTags(inline) : "";
      else if (raw !== "") value = Number.isFinite(Number(raw)) ? Number(raw) : xmlText(raw);
      cells[col] = value;
    }
    return cells;
  });
}

const labelOf = (value) => String(value ?? "").trim();

function metadata(rows) {
  const flat = rows.slice(0, 8).flat().map(labelOf).filter(Boolean);
  const periodRow = rows.slice(0, 8)
    .map((row) => row.map(labelOf).filter(Boolean))
    .find((row) => row.some((value) => value.includes("決算仕訳")) || row.filter((value) => /令和\d{2}年\d{2}月\d{2}日/u.test(value)).length >= 2);
  return {
    reportNamePresent: flat.some((value) => value.includes("残高試算表") && value.includes("年間推移")),
    periodText: periodRow ? periodRow.join(",") : "",
    taxMode: flat.find((value) => value.includes("税抜") || value.includes("税込")) ?? "",
  };
}

function parseSheet(sheet, rows, requiredAccounts) {
  const headerIndex = rows.findIndex((row) => labelOf(row[0]) === "勘定科目");
  if (headerIndex < 0) return { sheet: sheet.name, category: "SHEET_HEADER_NOT_FOUND", records: [], monthColumns: [], missingAccounts: requiredAccounts };
  const monthColumns = rows[headerIndex]
    .map((value, index) => ({ label: labelOf(value), index }))
    .filter(({ label }) => MONTH_LABEL_RE.test(label));
  const accounts = new Map();
  const records = [];
  for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const account = labelOf(rows[rowIndex][0]);
    if (!account || account.startsWith("[") || account === "【単位：円】") continue;
    accounts.set(account, rowIndex + 1);
    for (const month of monthColumns) {
      const amount = rows[rowIndex][month.index];
      if (typeof amount === "number" && Number.isFinite(amount)) records.push({ sheet: sheet.name, account, month: month.label, amount });
    }
  }
  const missingAccounts = requiredAccounts.filter((account) => !accounts.has(account));
  const mappingCandidates = Object.fromEntries(missingAccounts.flatMap((canonicalAccount) => {
    const sourceAccount = (PL_MAPPING_CANDIDATES[canonicalAccount] || []).find((candidate) => accounts.has(candidate));
    return sourceAccount ? [[canonicalAccount, sourceAccount]] : [];
  }));
  return {
    sheet: sheet.name,
    category: missingAccounts.length ? "SHEET_MAPPING_REQUIRED" : "SHEET_READY",
    isAggregateSheet: AGGREGATE_SHEET_RE.test(sheet.name),
    monthColumns,
    accountCount: accounts.size,
    missingAccounts,
    mappingCandidates,
    records,
  };
}

function sumAccount(records, account) {
  return records
    .filter((record) => record.account === account)
    .reduce((sum, record) => sum + Number(record.amount || 0), 0);
}

const STORE_SHEET_RE = /(?:BASSA.+店|KYARA\s*HALF)/iu;
const NON_STORE_SHEET_RE = /(?:本部|総務|経理|営業|教育|アカデミー|EC事業|FC|共通|全体|合計)/u;

function classifyPlEntity(sheetName, isAggregateSheet) {
  const value = String(sheetName || "");
  if (isAggregateSheet) return { category: "AGGREGATE_EXCLUDED_FROM_ENTITY_TOTALS", label: "集計除外" };
  if (STORE_SHEET_RE.test(value) && !NON_STORE_SHEET_RE.test(value)) return { category: "STORE_CANDIDATE", label: "店舗候補" };
  if (/FC/u.test(value)) return { category: "FC_REVIEW_REQUIRED", label: "FC確認" };
  if (NON_STORE_SHEET_RE.test(value)) return { category: "NON_STORE_REVIEW_REQUIRED", label: "店舗外確認" };
  return { category: "ENTITY_REVIEW_REQUIRED", label: "mapping確認" };
}

function entityPreview(sheet, statement) {
  const salesYen = statement === "PL" ? sumAccount(sheet.records, "売上高合計") : null;
  const ordinaryProfitYen = statement === "PL" ? sumAccount(sheet.records, "経常損益金額") : null;
  const entity = statement === "PL"
    ? classifyPlEntity(sheet.sheet, sheet.isAggregateSheet)
    : { category: sheet.isAggregateSheet ? "AGGREGATE_EXCLUDED_FROM_ENTITY_TOTALS" : "ENTITY_CANDIDATE", label: sheet.isAggregateSheet ? "集計除外" : "候補" };
  return {
    entityName: sheet.sheet,
    entityCategory: entity.category,
    entityCategoryLabel: entity.label,
    mappingStatus: sheet.missingAccounts.length ? "MAPPING_REQUIRED" : "READY",
    recordCount: sheet.records.length,
    salesManYen: salesYen == null ? null : Math.round(salesYen / 10000),
    ordinaryProfitManYen: ordinaryProfitYen == null ? null : Math.round(ordinaryProfitYen / 10000),
  };
}

function summarizeStatement(statement, sheets, meta) {
  const parsed = sheets.parsed;
  const missingByAccount = Object.fromEntries(sheets.required.map((account) => [
    account,
    parsed.filter((sheet) => sheet.missingAccounts.includes(account)).length,
  ]).filter(([, count]) => count > 0));
  const mappingCandidatesByAccount = {};
  for (const sheet of parsed) {
    for (const [canonicalAccount, sourceAccount] of Object.entries(sheet.mappingCandidates || {})) {
      const current = mappingCandidatesByAccount[canonicalAccount] || { sourceAccount, sheetCount: 0 };
      if (current.sourceAccount === sourceAccount) current.sheetCount += 1;
      mappingCandidatesByAccount[canonicalAccount] = current;
    }
  }
  const sheetCount = parsed.length;
  const sheetsWithTwelveMonths = parsed.filter((sheet) => sheet.monthColumns.length === 12).length;
  const aggregateSheetCount = parsed.filter((sheet) => sheet.isAggregateSheet).length;
  const entityCandidateCount = parsed.filter((sheet) => !sheet.isAggregateSheet).length;
  const normalizedRecordCount = parsed.reduce((sum, sheet) => sum + sheet.records.length, 0);
  let status = !meta.reportNamePresent ? `${statement}_FORMAT_INVALID`
    : sheetsWithTwelveMonths !== sheetCount ? `${statement}_MONTH_COLUMNS_INVALID`
      : Object.keys(missingByAccount).length ? `${statement}_LOCAL_VALIDATED_PENDING_MAPPING`
        : `${statement}_LOCAL_READY`;
  let balanceCheck = "NOT_APPLICABLE";
  if (statement === "BS" && !Object.keys(missingByAccount).length) {
    const imbalanced = parsed.some((sheet) => {
      const byMonth = new Map();
      for (const record of sheet.records) {
        if (!BS_REQUIRED_ACCOUNTS.includes(record.account)) continue;
        const bucket = byMonth.get(record.month) ?? {};
        bucket[record.account] = record.amount;
        byMonth.set(record.month, bucket);
      }
      return [...byMonth.values()].some((row) => row["資産合計"] !== row["負債合計"] + row["純資産合計"]);
    });
    balanceCheck = imbalanced ? "IMBALANCED" : "BALANCED";
    if (imbalanced) status = "BS_BALANCE_CHECK_FAILED";
  }
  return {
    status,
    statement,
    metadata: meta,
    sheetCount,
    sheetsWithTwelveMonths,
    aggregateSheetCount,
    entityCandidateCount,
    normalizedRecordCount,
    missingByAccount,
    mappingCandidatesByAccount,
    balanceCheck,
    entityPreviewRows: parsed.map((sheet) => entityPreview(sheet, statement)),
    previewRows: parsed.slice(0, 4).map((sheet) => ({
      entityCategory: statement === "PL" ? classifyPlEntity(sheet.sheet, sheet.isAggregateSheet).category : sheet.isAggregateSheet ? "AGGREGATE_EXCLUDED_FROM_ENTITY_TOTALS" : "ENTITY_CANDIDATE",
      monthCount: sheet.monthColumns.length,
      accountCount: sheet.accountCount,
      recordCount: sheet.records.length,
      mappingStatus: sheet.missingAccounts.length ? "MAPPING_REQUIRED" : "READY",
    })),
  };
}

function combineStatuses(statement, results) {
  if (results.some((result) => !String(result.status || "").startsWith(statement))) return `${statement}_FILE_PARSE_FAILED`;
  if (results.some((result) => result.status === `${statement}_BALANCE_CHECK_FAILED`)) return `${statement}_BALANCE_CHECK_FAILED`;
  if (results.some((result) => result.status === `${statement}_LOCAL_VALIDATED_PENDING_MAPPING`)) return `${statement}_LOCAL_VALIDATED_PENDING_MAPPING`;
  return results.every((result) => result.status === `${statement}_LOCAL_READY`) ? `${statement}_LOCAL_READY` : `${statement}_LOCAL_VALIDATED_PENDING_MAPPING`;
}

export function combineFinancialWorkbookResults(results, statement = "PL") {
  const accepted = Array.isArray(results) ? results.filter((result) => result && typeof result === "object") : [];
  if (!accepted.length) return { status: "FILE_READ_OR_PARSE_FAILED", statement, previewRows: [], entityPreviewRows: [] };
  const missingByAccount = {};
  const mappingCandidatesByAccount = {};
  for (const result of accepted) {
    for (const [account, count] of Object.entries(result.missingByAccount || {})) {
      missingByAccount[account] = (missingByAccount[account] || 0) + Number(count || 0);
    }
    for (const [canonicalAccount, candidate] of Object.entries(result.mappingCandidatesByAccount || {})) {
      const current = mappingCandidatesByAccount[canonicalAccount] || { sourceAccount: candidate.sourceAccount, sheetCount: 0 };
      if (current.sourceAccount === candidate.sourceAccount) current.sheetCount += Number(candidate.sheetCount || 0);
      mappingCandidatesByAccount[canonicalAccount] = current;
    }
  }
  const sheetCount = accepted.reduce((sum, result) => sum + Number(result.sheetCount || 0), 0);
  const sheetsWithTwelveMonths = accepted.reduce((sum, result) => sum + Number(result.sheetsWithTwelveMonths || 0), 0);
  const aggregateSheetCount = accepted.reduce((sum, result) => sum + Number(result.aggregateSheetCount || 0), 0);
  const entityCandidateCount = accepted.reduce((sum, result) => sum + Number(result.entityCandidateCount || 0), 0);
  const normalizedRecordCount = accepted.reduce((sum, result) => sum + Number(result.normalizedRecordCount || 0), 0);
  const entityPreviewRows = accepted.flatMap((result) => result.entityPreviewRows || []);
  return {
    status: combineStatuses(statement, accepted),
    statement,
    fileName: accepted.length === 1 ? accepted[0].fileName : `${accepted.length} files`,
    fileBytes: accepted.reduce((sum, result) => sum + Number(result.fileBytes || 0), 0),
    metadata: { periodText: accepted.map((result) => result.metadata?.periodText).filter(Boolean).join(" / ") },
    sheetCount,
    sheetsWithTwelveMonths,
    aggregateSheetCount,
    entityCandidateCount,
    normalizedRecordCount,
    missingByAccount,
    mappingCandidatesByAccount,
    balanceCheck: statement === "BS" && accepted.every((result) => result.balanceCheck === "BALANCED") ? "BALANCED" : statement === "BS" ? "IMBALANCED" : "NOT_APPLICABLE",
    previewRows: accepted.flatMap((result) => result.previewRows || []).slice(0, 8),
    entityPreviewRows,
  };
}

export async function parseFinancialWorkbookBuffer(buffer, statement = "PL", options = {}) {
  const entries = await readXlsxEntries(buffer, options);
  const sharedStrings = parseSharedStrings(entries);
  const workbookSheets = parseWorkbook(entries);
  const rowsBySheet = workbookSheets.map((sheet) => ({ sheet, rows: parseRows(entries, sheet, sharedStrings) }));
  const firstRows = rowsBySheet[0]?.rows ?? [];
  const required = statement === "BS" ? BS_REQUIRED_ACCOUNTS : YAYOI_PL_REQUIRED_ACCOUNTS;
  const parsed = rowsBySheet.map(({ sheet, rows }) => parseSheet(sheet, rows, required));
  return summarizeStatement(statement, { parsed, required }, metadata(firstRows));
}

export async function validateFinancialWorkbookFile(file, statement = "PL", options = {}) {
  if (!file || typeof file.name !== "string" || !file.name.toLowerCase().endsWith(".xlsx")) return { status: "FILE_TYPE_INVALID" };
  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > MAX_FINANCIAL_FILE_BYTES) return { status: "FILE_SIZE_INVALID" };
  try {
    const result = await parseFinancialWorkbookBuffer(await file.arrayBuffer(), statement, options);
    return { ...result, fileName: file.name, fileBytes: file.size };
  } catch {
    return { status: "FILE_READ_OR_PARSE_FAILED" };
  }
}

export async function validateFinancialWorkbookFiles(files, statement = "PL", options = {}) {
  const list = Array.from(files || []);
  if (!list.length) return { status: "FILE_READ_OR_PARSE_FAILED", statement, previewRows: [], entityPreviewRows: [] };
  const results = [];
  for (const file of list) results.push(await validateFinancialWorkbookFile(file, statement, options));
  return combineFinancialWorkbookResults(results, statement);
}

export function buildFinancialIntakeReceipt(result) {
  if (!result || typeof result !== "object") return null;
  return {
    schemaVersion: "management-financial-data-intake-local-v1",
    status: result.status,
    statement: result.statement,
    fileNamePresent: typeof result.fileName === "string" && result.fileName.length > 0,
    periodDetected: typeof result.metadata?.periodText === "string" && result.metadata.periodText.length > 0,
    sheetCount: result.sheetCount || 0,
    entityCandidateCount: result.entityCandidateCount || 0,
    aggregateExcludedSheetCount: result.aggregateSheetCount || 0,
    normalizedRecordCount: result.normalizedRecordCount || 0,
    allSheetsHaveTwelveMonths: result.sheetCount > 0 && result.sheetsWithTwelveMonths === result.sheetCount,
    mappingRequiredAccountCount: Object.keys(result.missingByAccount ?? {}).length,
    mappingCandidateAccountCount: Object.keys(result.mappingCandidatesByAccount ?? {}).length,
    aggregateSheetHandlingRequired: Number(result.aggregateSheetCount || 0) > 0,
    balanceCheck: result.balanceCheck || "NOT_APPLICABLE",
    productionImportEnabled: false,
  };
}

export function buildFinancialCompletionItems(result) {
  const receipt = buildFinancialIntakeReceipt(result);
  const statement = receipt?.statement || "";
  const parsedLocally = Number(receipt?.sheetCount || 0) > 0
    && !String(receipt?.status || "").includes("FAILED")
    && !String(receipt?.status || "").includes("INVALID");
  const missingAccounts = Object.keys(result?.missingByAccount || {});
  const mappingCandidates = result?.mappingCandidatesByAccount || {};
  const bsReady = statement === "BS" && parsedLocally && receipt?.balanceCheck === "BALANCED" && receipt?.mappingRequiredAccountCount === 0;
  return FINANCIAL_COMPLETION_REQUIREMENTS.map((requirement) => {
    let status = "SOURCE_REQUIRED";
    let detail = requirement.detail;
    if (requirement.key === "PL_ANNUAL_REPORT" && statement === "PL" && parsedLocally) status = "LOCAL_VALIDATED";
    if (requirement.key === "PL_ACCOUNT_MAPPING" && statement === "PL" && parsedLocally) {
      const candidatePairs = missingAccounts.flatMap((canonicalAccount) => {
        const sourceAccount = mappingCandidates[canonicalAccount]?.sourceAccount;
        return sourceAccount ? [`${sourceAccount} → ${canonicalAccount}`] : [];
      });
      status = receipt.mappingRequiredAccountCount === 0
        ? "LOCAL_VALIDATED"
        : candidatePairs.length === missingAccounts.length ? "MAPPING_REVIEW_REQUIRED" : "MAPPING_REQUIRED";
      if (candidatePairs.length === missingAccounts.length && candidatePairs.length) detail = `候補: ${candidatePairs.join("、")}（経理確認待ち）`;
      else if (missingAccounts.length) detail = `未対応: ${missingAccounts.join("、")}`;
    }
    if (requirement.key === "BALANCE_SHEET") {
      status = bsReady ? "LOCAL_VALIDATED" : statement === "BS" && parsedLocally ? "CHECK_REQUIRED" : "SOURCE_REQUIRED";
    }
    if (requirement.key === "FC_RULE") status = "RULE_REQUIRED";
    return { ...requirement, status, detail };
  });
}

export function buildFinancialLocalPreview(result) {
  const receipt = buildFinancialIntakeReceipt(result);
  if (!receipt || receipt.statement !== "PL") return null;
  const allRows = result.entityPreviewRows || [];
  const rows = allRows.filter((row) => row.entityCategory === "STORE_CANDIDATE");
  const reviewRows = allRows.filter((row) => row.entityCategory !== "STORE_CANDIDATE");
  const completionItems = buildFinancialCompletionItems(result);
  return {
    schemaVersion: "management-financial-local-preview-v1",
    statement: "PL",
    status: receipt.status,
    fileNamePresent: receipt.fileNamePresent,
    periodDetected: receipt.periodDetected,
    entityCandidateCount: rows.length,
    reviewCandidateCount: reviewRows.length,
    aggregateExcludedSheetCount: receipt.aggregateExcludedSheetCount,
    normalizedRecordCount: receipt.normalizedRecordCount,
    mappingRequiredAccountCount: receipt.mappingRequiredAccountCount,
    mappingCandidateAccountCount: receipt.mappingCandidateAccountCount,
    completionPendingCount: completionItems.filter((item) => item.status !== "LOCAL_VALIDATED").length,
    salesManYen: rows.reduce((sum, row) => sum + Number(row.salesManYen || 0), 0),
    ordinaryProfitManYen: rows.reduce((sum, row) => sum + Number(row.ordinaryProfitManYen || 0), 0),
    importActionEnabled: false,
    rows: rows.slice(0, 80).map((row) => ({
      entityName: row.entityName,
      salesManYen: row.salesManYen,
      ordinaryProfitManYen: row.ordinaryProfitManYen,
      mappingStatus: row.mappingStatus,
      recordCount: row.recordCount,
      entityCategory: row.entityCategory,
      entityCategoryLabel: row.entityCategoryLabel,
    })),
    reviewRows: reviewRows.slice(0, 20).map((row) => ({
      entityName: row.entityName,
      entityCategory: row.entityCategory,
      entityCategoryLabel: row.entityCategoryLabel,
      mappingStatus: row.mappingStatus,
      recordCount: row.recordCount,
    })),
  };
}

function el(doc, tag, className, text) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

const INTAKE_STATUS_LABELS = Object.freeze({
  PL_LOCAL_READY: "P/L確認済み",
  PL_LOCAL_VALIDATED_PENDING_MAPPING: "P/L確認済み・科目対応待ち",
  PL_FILE_PARSE_FAILED: "P/Lファイル解析エラー",
  PL_FORMAT_INVALID: "P/L形式を確認してください",
  PL_MONTH_COLUMNS_INVALID: "P/L月次列を確認してください",
  BS_LOCAL_READY: "B/S確認済み",
  BS_LOCAL_VALIDATED_PENDING_MAPPING: "B/S確認済み・科目対応待ち",
  BS_BALANCE_CHECK_FAILED: "B/S貸借不一致",
  BS_FILE_PARSE_FAILED: "B/Sファイル解析エラー",
  FILE_READ_OR_PARSE_FAILED: "ファイルを確認してください",
});

const PREVIEW_CATEGORY_LABELS = Object.freeze({
  STORE_CANDIDATE: "店舗候補",
  ENTITY_CANDIDATE: "候補",
  ENTITY_REVIEW_REQUIRED: "mapping確認",
  NON_STORE_REVIEW_REQUIRED: "店舗外確認",
  FC_REVIEW_REQUIRED: "FC確認",
  AGGREGATE_EXCLUDED_FROM_ENTITY_TOTALS: "集計除外",
});

function setResult(container, result) {
  const doc = container.ownerDocument;
  const receipt = buildFinancialIntakeReceipt(result);
  const panel = container.querySelector("[data-financial-intake-result]");
  if (!panel || !receipt) return;
  panel.dataset.financialIntakeResult = receipt.status;
  panel.replaceChildren(
    el(doc, "strong", "", INTAKE_STATUS_LABELS[receipt.status] || "ローカル検証結果を確認してください"),
    el(doc, "p", "", `ファイル ${receipt.fileNamePresent ? "選択済み" : "未選択"} / 対象期間 ${receipt.periodDetected ? "検出済み" : "確認待ち"}`),
    el(doc, "p", "", `シート ${receipt.sheetCount}件 / 対象候補 ${receipt.entityCandidateCount}件 / 集計除外 ${receipt.aggregateExcludedSheetCount}件`),
    el(doc, "p", "", `正規化 ${receipt.normalizedRecordCount}件 / 科目対応待ち ${receipt.mappingRequiredAccountCount}件 / 候補検出 ${receipt.mappingCandidateAccountCount}件`),
    el(doc, "p", "", receipt.balanceCheck === "NOT_APPLICABLE" ? "貸借チェック: 対象外" : `貸借チェック: ${receipt.balanceCheck}`),
    el(doc, "p", "", receipt.productionImportEnabled ? "本番投入可能" : "本番投入は無効です")
  );
  const preview = container.querySelector("[data-financial-intake-preview]");
  if (preview) {
    preview.replaceChildren(...(result.previewRows || []).map((row) => {
      const category = PREVIEW_CATEGORY_LABELS[row.entityCategory] || "確認待ち";
      const mapping = row.mappingStatus === "READY" ? "科目確認済み" : "科目対応待ち";
      const item = el(doc, "li", "", `${category} / ${mapping} / ${row.recordCount}件`);
      item.dataset.financialPreviewCategory = row.entityCategory;
      return item;
    }));
  }
  setCompletionChecklist(container, result);
}

const COMPLETION_STATUS_LABELS = Object.freeze({
  LOCAL_VALIDATED: "ローカル確認済み",
  MAPPING_REQUIRED: "対応表待ち",
  MAPPING_REVIEW_REQUIRED: "候補確認待ち",
  SOURCE_REQUIRED: "資料待ち",
  RULE_REQUIRED: "運用ルール待ち",
  CHECK_REQUIRED: "再確認",
});

function setCompletionChecklist(container, result) {
  const doc = container.ownerDocument;
  const checklist = container.querySelector("[data-financial-completion-list]");
  const summary = container.querySelector("[data-financial-completion-summary]");
  if (!checklist || !summary) return;
  const items = buildFinancialCompletionItems(result);
  const readyCount = items.filter((item) => item.status === "LOCAL_VALIDATED").length;
  summary.textContent = `${readyCount}/${items.length}項目をローカル確認済み。本番投入は全項目と本番取込契約が揃うまで無効です。`;
  checklist.replaceChildren(...items.map((item) => {
    const classSuffix = item.status.toLowerCase().replaceAll("_", "-");
    const article = el(doc, "article", `financial-completion-item is-${classSuffix}`);
    article.dataset.financialCompletionCategory = item.key;
    article.dataset.financialCompletionStatus = item.status;
    article.append(
      el(doc, "span", "financial-completion-status", COMPLETION_STATUS_LABELS[item.status] || "確認待ち"),
      el(doc, "strong", "", item.label),
      el(doc, "p", "", item.detail)
    );
    return article;
  }));
}

function publishPreview(container, result) {
  const preview = buildFinancialLocalPreview(result);
  if (!preview) return;
  container.dispatchEvent(new CustomEvent("management-financial-local-preview", {
    bubbles: true,
    detail: preview,
  }));
}

export function renderFinancialDataIntake(container, hooks = {}) {
  if (!container || container.dataset.financialIntakeMounted === "true") return false;
  const doc = hooks.document || container.ownerDocument || document;
  container.dataset.financialIntakeMounted = "true";
  const section = el(doc, "section", "financial-intake-panel");
  const heading = el(doc, "div", "financial-intake-heading");
  const titleWrap = el(doc, "div");
  titleWrap.append(el(doc, "p", "financial-intake-kicker", "LOCAL VALIDATION"), el(doc, "h3", "", "財務データ取込"));
  const disabled = el(doc, "button", "", "本番投入 disabled");
  disabled.type = "button";
  disabled.disabled = true;
  heading.append(titleWrap, disabled);

  const controls = el(doc, "div", "financial-intake-controls");
  const statement = el(doc, "select");
  statement.setAttribute("aria-label", "取込種別");
  [["PL", "P/L"], ["BS", "B/S"]].forEach(([value, label]) => {
    const option = el(doc, "option", "", label);
    option.value = value;
    statement.append(option);
  });
  const fiscal = el(doc, "input");
  fiscal.type = "text";
  fiscal.placeholder = "対象期";
  fiscal.setAttribute("aria-label", "対象期");
  const scope = el(doc, "select");
  scope.setAttribute("aria-label", "scope");
  ["法人/店舗/部門", "法人", "店舗", "部門"].forEach((label) => scope.append(el(doc, "option", "", label)));
  const source = el(doc, "select");
  source.setAttribute("aria-label", "source system");
  ["弥生会計", "その他"].forEach((label) => source.append(el(doc, "option", "", label)));
  const mode = el(doc, "select");
  mode.setAttribute("aria-label", "import mode");
  ["検証のみ", "mapping review"].forEach((label) => mode.append(el(doc, "option", "", label)));
  controls.append(statement, fiscal, scope, source, mode);

  const drop = el(doc, "label", "financial-intake-drop");
  const input = el(doc, "input");
  input.type = "file";
  input.accept = ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  input.multiple = true;
  const dropText = el(doc, "span", "", "Excelファイルを選択してローカル検証");
  drop.append(input, dropText);

  const result = el(doc, "div", "financial-intake-result");
  result.dataset.financialIntakeResult = "NOT_READY";
  result.append(el(doc, "strong", "", "未検証"), el(doc, "p", "", "ファイル内容は送信されません。"));
  const preview = el(doc, "ul", "financial-intake-preview");
  preview.dataset.financialIntakePreview = "EMPTY";
  const completion = el(doc, "section", "financial-completion");
  completion.append(el(doc, "h4", "", "不足データと次の準備"));
  const completionSummary = el(doc, "p", "financial-completion-summary");
  completionSummary.dataset.financialCompletionSummary = "true";
  const completionList = el(doc, "div", "financial-completion-list");
  completionList.dataset.financialCompletionList = "true";
  completion.append(completionSummary, completionList);
  section.append(heading, el(doc, "p", "financial-intake-summary", "P/LとB/Sを本番投入前にローカルで検証します。個人情報と原文は保持しません。"), controls, drop, result, completion, preview);
  container.replaceChildren(section);
  setCompletionChecklist(container, null);
  if (hooks.initialResult) setResult(container, hooks.initialResult);

  input.addEventListener("change", async () => {
    const files = Array.from(input.files || []);
    dropText.textContent = files.length === 1 ? files[0].name : files.length ? `${files.length}ファイルを選択中` : "Excelファイルを選択してローカル検証";
    result.dataset.financialIntakeResult = "CHECKING";
    result.replaceChildren(el(doc, "strong", "", "検証中"), el(doc, "p", "", "ローカルでExcel構造を確認しています。"));
    const parsed = await validateFinancialWorkbookFiles(files, statement.value, hooks);
    setResult(container, parsed);
    publishPreview(container, parsed);
    input.value = "";
  });
  return true;
}
