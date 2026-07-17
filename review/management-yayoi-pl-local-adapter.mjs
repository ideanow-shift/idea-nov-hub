import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const MONTH_LABEL_RE = /^(?:[1-9]|1[0-2])月度$/u;
const DEFAULT_REQUIRED_ACCOUNTS = Object.freeze([
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
const PL_MAPPING_CANDIDATES = Object.freeze({
  "地代家賃": Object.freeze(["賃借料"]),
  "販売管理費合計": Object.freeze(["販売管理費計"]),
});

const AGGREGATE_SHEET_RE = /(?:全体|合計|共通|FC\(合計\))/u;

const xmlText = (text) => text
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&amp;/g, "&")
  .replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'");

const stripTags = (text) => xmlText(text.replace(/<[^>]+>/g, ""));

const attr = (tag, name) => {
  const match = tag.match(new RegExp(`${name}="([^"]*)"`));
  return match ? xmlText(match[1]) : null;
};

const columnIndex = (ref) => {
  const letters = String(ref || "").match(/^[A-Z]+/i)?.[0]?.toUpperCase();
  if (!letters) return -1;
  let value = 0;
  for (const ch of letters) value = value * 26 + ch.charCodeAt(0) - 64;
  return value - 1;
};

function findEndOfCentralDirectory(buffer) {
  for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 66000); offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  throw new Error("ZIP_EOCD_NOT_FOUND");
}

export function readZipEntries(buffer) {
  const eocd = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(eocd + 10);
  const centralOffset = buffer.readUInt32LE(eocd + 16);
  const entries = new Map();
  let pointer = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(pointer) !== 0x02014b50) throw new Error("ZIP_CENTRAL_DIRECTORY_INVALID");
    const method = buffer.readUInt16LE(pointer + 10);
    const compressedSize = buffer.readUInt32LE(pointer + 20);
    const fileNameLength = buffer.readUInt16LE(pointer + 28);
    const extraLength = buffer.readUInt16LE(pointer + 30);
    const commentLength = buffer.readUInt16LE(pointer + 32);
    const localOffset = buffer.readUInt32LE(pointer + 42);
    const name = buffer.subarray(pointer + 46, pointer + 46 + fileNameLength).toString("utf8");
    if (buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new Error("ZIP_LOCAL_HEADER_INVALID");
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
    let data;
    if (method === 0) data = compressed;
    else if (method === 8) data = zlib.inflateRawSync(compressed);
    else throw new Error("ZIP_COMPRESSION_UNSUPPORTED");
    entries.set(name.replace(/\\/g, "/"), data.toString("utf8"));
    pointer += 46 + fileNameLength + extraLength + commentLength;
  }
  return entries;
}

function parseSharedStrings(entries) {
  const xml = entries.get("xl/sharedStrings.xml");
  if (!xml) return [];
  return [...xml.matchAll(/<si\b[\s\S]*?<\/si>/g)].map(([item]) => {
    const textParts = [...item.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(([, value]) => xmlText(value));
    return textParts.length ? textParts.join("") : stripTags(item);
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

function parseSheetRows(entries, sheet, sharedStrings) {
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

const normalizeLabel = (value) => String(value ?? "").trim();

function readMetadata(rows) {
  const flat = rows.slice(0, 8).flat().map(normalizeLabel).filter(Boolean);
  const periodRow = rows.slice(0, 8)
    .map((row) => row.map(normalizeLabel).filter(Boolean))
    .find((row) => row.some((value) => value.includes("決算仕訳")) || row.filter((value) => /令和\d{2}年\d{2}月\d{2}日/u.test(value)).length >= 2);
  return {
    reportNamePresent: flat.some((value) => value.includes("残高試算表") && value.includes("年間推移")),
    periodText: periodRow ? periodRow.join(",") : flat.find((value) => /令和\d{2}年\d{2}月\d{2}日/u.test(value)) ?? null,
    taxMode: flat.find((value) => value.includes("税抜") || value.includes("税込")) ?? null,
  };
}

function parseSheet(sheet, rows, requiredAccounts) {
  const headerIndex = rows.findIndex((row) => normalizeLabel(row[0]) === "勘定科目");
  if (headerIndex < 0) {
    return { sheet: sheet.name, category: "SHEET_HEADER_NOT_FOUND", monthColumns: [], accountRows: new Map(), records: [] };
  }
  const header = rows[headerIndex];
  const monthColumns = header
    .map((value, index) => ({ label: normalizeLabel(value), index }))
    .filter(({ label }) => MONTH_LABEL_RE.test(label));
  const accountRows = new Map();
  const records = [];
  for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const account = normalizeLabel(rows[rowIndex][0]);
    if (!account || account.startsWith("[") || account === "【単位：円】") continue;
    accountRows.set(account, rowIndex + 1);
    for (const month of monthColumns) {
      const value = rows[rowIndex][month.index];
      if (typeof value === "number" && Number.isFinite(value)) {
        records.push({ sheet: sheet.name, account, month: month.label, amount: value });
      }
    }
  }
  const missingAccounts = requiredAccounts.filter((account) => !accountRows.has(account));
  const mappingCandidates = Object.fromEntries(missingAccounts.flatMap((canonicalAccount) => {
    const sourceAccount = (PL_MAPPING_CANDIDATES[canonicalAccount] || []).find((candidate) => accountRows.has(candidate));
    return sourceAccount ? [[canonicalAccount, sourceAccount]] : [];
  }));
  return {
    sheet: sheet.name,
    category: missingAccounts.length ? "SHEET_ACCOUNT_MAPPING_REQUIRED" : "SHEET_READY",
    isAggregateSheet: AGGREGATE_SHEET_RE.test(sheet.name),
    monthColumns: monthColumns.map(({ label }) => label),
    accountCount: accountRows.size,
    missingAccounts,
    mappingCandidates,
    records,
  };
}

export function parseYayoiPlWorkbook(buffer, options = {}) {
  const requiredAccounts = options.requiredAccounts ?? DEFAULT_REQUIRED_ACCOUNTS;
  const entries = readZipEntries(buffer);
  const sharedStrings = parseSharedStrings(entries);
  const sheets = parseWorkbook(entries);
  const parsedSheets = sheets.map((sheet) => parseSheet(sheet, parseSheetRows(entries, sheet, sharedStrings), requiredAccounts));
  const metadataRows = sheets.length ? parseSheetRows(entries, sheets[0], sharedStrings) : [];
  const metadata = readMetadata(metadataRows);
  const sheetsWithTwelveMonths = parsedSheets.filter((sheet) => sheet.monthColumns.length === 12).length;
  const missingByAccount = Object.fromEntries(requiredAccounts.map((account) => [
    account,
    parsedSheets.filter((sheet) => sheet.missingAccounts?.includes(account)).length,
  ]).filter(([, count]) => count > 0));
  const mappingCandidatesByAccount = {};
  for (const sheet of parsedSheets) {
    for (const [canonicalAccount, sourceAccount] of Object.entries(sheet.mappingCandidates || {})) {
      const current = mappingCandidatesByAccount[canonicalAccount] || { sourceAccount, sheetCount: 0 };
      if (current.sourceAccount === sourceAccount) current.sheetCount += 1;
      mappingCandidatesByAccount[canonicalAccount] = current;
    }
  }
  const normalizedRecordCount = parsedSheets.reduce((sum, sheet) => sum + sheet.records.length, 0);
  const aggregateSheetCount = parsedSheets.filter((sheet) => sheet.isAggregateSheet).length;
  const status = !metadata.reportNamePresent
    ? "YAYOI_PL_FORMAT_INVALID"
    : sheetsWithTwelveMonths !== parsedSheets.length
      ? "YAYOI_PL_MONTH_COLUMNS_INVALID"
      : Object.keys(missingByAccount).length
        ? "YAYOI_PL_LOCAL_VALIDATED_PENDING_MAPPING"
        : "YAYOI_PL_READY_FOR_NORMALIZATION";
  return {
    status,
    metadata,
    sheetCount: sheets.length,
    sheetsWithTwelveMonths,
    aggregateSheetCount,
    normalizedRecordCount,
    requiredAccounts,
    missingByAccount,
    mappingCandidatesByAccount,
    sheetSummaries: parsedSheets.map(({ sheet, category, isAggregateSheet, accountCount, monthColumns, missingAccounts, records }) => ({
      sheet,
      category,
      isAggregateSheet: Boolean(isAggregateSheet),
      accountCount,
      monthCount: monthColumns.length,
      missingAccounts,
      recordCount: records.length,
    })),
    records: options.includeRecords ? parsedSheets.flatMap((sheet) => sheet.records) : undefined,
  };
}

export function buildSanitizedYayoiPlReceipt(fileResults) {
  if (!Array.isArray(fileResults) || fileResults.length === 0) return null;
  const allowedStatus = new Set([
    "YAYOI_PL_READY_FOR_NORMALIZATION",
    "YAYOI_PL_LOCAL_VALIDATED_PENDING_MAPPING",
    "YAYOI_PL_MONTH_COLUMNS_INVALID",
    "YAYOI_PL_FORMAT_INVALID",
    "YAYOI_PL_READ_FAILED",
  ]);
  if (fileResults.some((item) => !item || !allowedStatus.has(item.status))) return null;
  const totalSheets = fileResults.reduce((sum, item) => sum + item.sheetCount, 0);
  const totalRecords = fileResults.reduce((sum, item) => sum + item.normalizedRecordCount, 0);
  const missingAccountNames = [...new Set(fileResults.flatMap((item) => Object.keys(item.missingByAccount ?? {})))];
  const mappingCandidateNames = [...new Set(fileResults.flatMap((item) => Object.keys(item.mappingCandidatesByAccount ?? {})))];
  return {
    schemaVersion: "management-yayoi-pl-local-adapter-v1",
    status: missingAccountNames.length ? "LOCAL_VALIDATED_PENDING_ACCOUNT_MAPPING" : "LOCAL_READY_FOR_IMPORT_CANDIDATE",
    workbookCount: fileResults.length,
    sheetCount: totalSheets,
    normalizedRecordCount: totalRecords,
    allSheetsHaveTwelveMonths: fileResults.every((item) => item.sheetsWithTwelveMonths === item.sheetCount),
    mappingRequiredAccountCount: missingAccountNames.length,
    mappingCandidateAccountCount: mappingCandidateNames.length,
    aggregateSheetHandlingRequired: fileResults.some((item) => item.aggregateSheetCount > 0),
    dbMutationReady: false,
    importActionEnabled: false,
  };
}

export function inspectYayoiPlFiles(paths) {
  return paths.map((filePath) => {
    try {
      const result = parseYayoiPlWorkbook(fs.readFileSync(filePath));
      return {
        fileName: path.basename(filePath),
        bytes: fs.statSync(filePath).size,
        ...result,
        records: undefined,
      };
    } catch {
      return {
        fileName: path.basename(filePath),
        bytes: fs.existsSync(filePath) ? fs.statSync(filePath).size : 0,
        status: "YAYOI_PL_READ_FAILED",
        metadata: {},
        sheetCount: 0,
        sheetsWithTwelveMonths: 0,
        aggregateSheetCount: 0,
        normalizedRecordCount: 0,
        missingByAccount: {},
        sheetSummaries: [],
      };
    }
  });
}

if (process.argv[1] && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])) {
  const files = process.argv.slice(2);
  const results = inspectYayoiPlFiles(files);
  const receipt = buildSanitizedYayoiPlReceipt(results);
  console.log(JSON.stringify({ receipt, files: results.map((item) => ({
    fileName: item.fileName,
    status: item.status,
    sheetCount: item.sheetCount,
    sheetsWithTwelveMonths: item.sheetsWithTwelveMonths,
    aggregateSheetCount: item.aggregateSheetCount,
    normalizedRecordCount: item.normalizedRecordCount,
    missingByAccount: item.missingByAccount,
    periodText: item.metadata.periodText,
    taxMode: item.metadata.taxMode,
  })) }, null, 2));
}
