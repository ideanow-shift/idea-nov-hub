const REQUIRED_HEADERS = Object.freeze([
  "source_row_no", "graduation_year", "source_type", "source_label", "student_name", "student_name_kana",
  "school_name", "faculty_or_department", "phone", "email", "line_name", "event_name", "event_date",
  "entry_status", "selection_status", "offer_status", "next_action_date", "follow_up_note", "owner_note",
  "stable_key_hint", "mapping_hint", "quarantine_flag", "quarantine_reason"
]);
const SOURCE_TYPES_28 = Object.freeze(["CONTACTS_28", "ENTRIES_28", "OFFERS_28"]);

export const TALENT_28_CSV_PREFLIGHT_CONTRACT = Object.freeze({
  graduationYear: "2028",
  sourceTypes: SOURCE_TYPES_28,
  networkOperation: false,
  databaseOperation: false,
  rawValueDisplay: false,
  requestMaxPerAction: 0,
  retryCount: 0
});

export function analyzeTalent28CsvPreflight(csvText, { maxRows = 5000, maxBytes = 5_000_000 } = {}) {
  if (typeof csvText !== "string" || csvText.length === 0 || csvText.length > maxBytes) {
    return safeSummary("CSV_FILE_INVALID", "NOT_EVALUATED");
  }
  const parsed = parseCsv(csvText);
  if (!parsed.ok) return safeSummary(parsed.category, "NOT_EVALUATED");
  const [headers, ...rows] = parsed.rows;
  const headerCategory = classifyHeaders(headers);
  if (headerCategory !== "PASS") return safeSummary("CSV_HEADER_CONTRACT_MISMATCH", headerCategory);
  if (rows.length > maxRows) return safeSummary("CSV_ROW_LIMIT_EXCEEDED", "PASS", { totalRows: rows.length });

  const index = Object.fromEntries(headers.map((header, position) => [header, position]));
  const counts = {
    totalRows: 0,
    readyRows: 0,
    quarantineRows: 0,
    invalidYearRows: 0,
    invalidSourceRows: 0,
    contactsRows: 0,
    entriesRows: 0,
    offersRows: 0,
    duplicateStableKeyHintRows: 0,
    duplicateContactHintRows: 0,
    missingIdentityRows: 0,
    invalidDateRows: 0,
    inconsistentQuarantineRows: 0
  };

  const stableKeyHints = new Map();
  const contactHints = new Map();
  for (const row of rows) {
    if (row.length === 1 && row[0].trim() === "") continue;
    counts.totalRows += 1;
    const value = (name) => String(row[index[name]] ?? "").trim();
    const yearOk = value("graduation_year") === "2028";
    const sourceType = value("source_type");
    const sourceOk = SOURCE_TYPES_28.includes(sourceType);
    const identityOk = value("student_name") !== "" && value("school_name") !== "" && [value("phone"), value("email"), value("line_name")].some(Boolean);
    const datesOk = [value("event_date"), value("next_action_date")].every((date) => date === "" || /^\d{4}-\d{2}-\d{2}$/.test(date));
    const quarantineFlag = value("quarantine_flag");
    const quarantineReason = value("quarantine_reason");
    const stableKeyHint = normalizeHint(value("stable_key_hint"));
    const contactHint = normalizeHint(value("email")) || normalizeHint(value("phone")) || normalizeHint(value("line_name"));
    const quarantineOk = ["TRUE", "FALSE"].includes(quarantineFlag) && (quarantineFlag === "FALSE" || quarantineReason !== "");
    if (!yearOk) counts.invalidYearRows += 1;
    if (!sourceOk) counts.invalidSourceRows += 1;
    if (sourceType === "CONTACTS_28") counts.contactsRows += 1;
    if (sourceType === "ENTRIES_28") counts.entriesRows += 1;
    if (sourceType === "OFFERS_28") counts.offersRows += 1;
    if (!identityOk) counts.missingIdentityRows += 1;
    if (!datesOk) counts.invalidDateRows += 1;
    if (!quarantineOk) counts.inconsistentQuarantineRows += 1;
    if (stableKeyHint) stableKeyHints.set(stableKeyHint, (stableKeyHints.get(stableKeyHint) || 0) + 1);
    if (contactHint) contactHints.set(contactHint, (contactHints.get(contactHint) || 0) + 1);
    if (quarantineFlag === "TRUE" || !yearOk || !sourceOk || !identityOk || !datesOk || !quarantineOk) counts.quarantineRows += 1;
    else counts.readyRows += 1;
  }
  counts.duplicateStableKeyHintRows = countDuplicateOccurrences(stableKeyHints);
  counts.duplicateContactHintRows = countDuplicateOccurrences(contactHints);

  const fixedCategory = counts.totalRows === 0
    ? "CSV_NO_DATA_ROWS"
    : counts.invalidYearRows > 0
      ? "CSV_2028_YEAR_MISMATCH"
      : counts.invalidSourceRows > 0
        ? "CSV_SOURCE_TYPE_MISMATCH"
        : counts.missingIdentityRows > 0
          ? "CSV_REQUIRED_IDENTITY_INCOMPLETE"
          : counts.invalidDateRows > 0
            ? "CSV_DATE_FORMAT_MISMATCH"
            : counts.inconsistentQuarantineRows > 0
              ? "CSV_QUARANTINE_CONTRACT_MISMATCH"
              : counts.duplicateStableKeyHintRows > 0 || counts.duplicateContactHintRows > 0
                ? "CSV_DUPLICATE_HINT_REVIEW_REQUIRED"
                : "PASS";
  return Object.freeze({
    ok: fixedCategory === "PASS",
    fixedCategory,
    headerCategory,
    readiness: buildTalent28CsvImportReadiness({ fixedCategory, counts }),
    counts: freezeCounts(counts),
    rawValuesIncluded: false,
    networkOperationCount: 0,
    productionDbOperationCount: 0,
    stagingOrCanonicalWriteCount: 0,
    retryCount: 0
  });
}

export function buildTalent28CsvImportReadiness(result) {
  const fixedCategory = String(result?.fixedCategory || "CSV_NOT_SELECTED");
  const counts = result?.counts || {};
  const totalRows = Number(counts.totalRows || 0);
  const readyRows = Number(counts.readyRows || 0);
  const quarantineRows = Number(counts.quarantineRows || 0);
  const sourceKinds = ["contactsRows", "entriesRows", "offersRows"].filter((key) => Number(counts[key] || 0) > 0).length;
  const sourceCoverageCategory = totalRows === 0 ? "NONE" : sourceKinds === 3 ? "EXACT3" : "PARTIAL";
  const category = fixedCategory !== "PASS"
    ? "NEEDS_FIX"
    : readyRows === 0
      ? "NO_READY_ROWS"
      : quarantineRows > 0
        ? "READY_WITH_QUARANTINE"
        : "READY_FOR_STAGING_PREFLIGHT";
  const title = {
    NEEDS_FIX: "CSVを修正してから再確認",
    NO_READY_ROWS: "投入候補行がありません",
    READY_WITH_QUARANTINE: "隔離候補を含めてpreflight可能",
    READY_FOR_STAGING_PREFLIGHT: "staging preflightへ進めます"
  }[category];
  const copy = {
    NEEDS_FIX: "年度・由来・必須項目・日付・隔離理由のいずれかで停止しています。",
    NO_READY_ROWS: "全行が隔離候補です。投入前にCSVの整形方針を確認してください。",
    READY_WITH_QUARANTINE: "投入候補と隔離候補を分けて扱えます。canonical反映は別承認です。",
    READY_FOR_STAGING_PREFLIGHT: "件数だけを確認済みです。DB投入は別の明示承認で実行します。"
  }[category];
  return Object.freeze({
    category,
    title,
    copy,
    sourceCoverageCategory,
    canRequestStagingPreflight: ["READY_WITH_QUARANTINE", "READY_FOR_STAGING_PREFLIGHT"].includes(category),
    rawValuesIncluded: false
  });
}

function safeSummary(fixedCategory, headerCategory, partialCounts = {}) {
  return Object.freeze({
    ok: false,
    fixedCategory,
    headerCategory,
    readiness: buildTalent28CsvImportReadiness({ fixedCategory, counts: partialCounts }),
    counts: freezeCounts({
      totalRows: 0,
      readyRows: 0,
      quarantineRows: 0,
      invalidYearRows: 0,
      invalidSourceRows: 0,
      contactsRows: 0,
      entriesRows: 0,
      offersRows: 0,
      duplicateStableKeyHintRows: 0,
      duplicateContactHintRows: 0,
      missingIdentityRows: 0,
      invalidDateRows: 0,
      inconsistentQuarantineRows: 0,
      ...partialCounts
    }),
    rawValuesIncluded: false,
    networkOperationCount: 0,
    productionDbOperationCount: 0,
    stagingOrCanonicalWriteCount: 0,
    retryCount: 0
  });
}

function normalizeHint(value) {
  return typeof value === "string" ? value.normalize("NFKC").trim().toLocaleLowerCase("ja-JP") : "";
}

function countDuplicateOccurrences(map) {
  let total = 0;
  for (const count of map.values()) {
    if (count > 1) total += count;
  }
  return total;
}

function freezeCounts(counts) {
  return Object.freeze(Object.fromEntries(Object.entries(counts).map(([key, value]) => [key, Number(value) || 0])));
}

function classifyHeaders(headers) {
  if (!Array.isArray(headers) || headers.length !== REQUIRED_HEADERS.length) return "HEADER_COUNT_MISMATCH";
  if (new Set(headers).size !== headers.length) return "HEADER_DUPLICATE";
  return REQUIRED_HEADERS.every((header, index) => headers[index] === header) ? "PASS" : "HEADER_ORDER_OR_NAME_MISMATCH";
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (char === "\"" && next === "\"") {
        cell += "\"";
        index += 1;
      } else if (char === "\"") {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === "\"") {
      if (cell !== "") return { ok: false, category: "CSV_QUOTE_MISMATCH" };
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  if (quoted) return { ok: false, category: "CSV_QUOTE_MISMATCH" };
  row.push(cell);
  rows.push(row);
  return { ok: true, rows: rows.map((cells, index) => index === 0 ? cells.map((header) => header.trim().replace(/^\uFEFF/, "")) : cells) };
}

export function initializeTalent28CsvPreflight({ documentObject = globalThis.document } = {}) {
  const input = documentObject?.getElementById?.("talent-28-csv-file");
  const status = documentObject?.getElementById?.("talent-28-csv-status");
  const summary = documentObject?.getElementById?.("talent-28-csv-summary");
  if (!input || !status || !summary) return Object.freeze({ initialized: false });
  if (input.dataset.bound === "true") return Object.freeze({ initialized: true, duplicateBindingPrevented: true });
  input.dataset.bound = "true";
  const render = (result) => {
    const readiness = result.readiness || buildTalent28CsvImportReadiness(result);
    status.dataset.category = readiness.category;
    status.textContent = `${readiness.title}。${readiness.copy}`;
    summary.replaceChildren(...[
      ["行数", result.counts.totalRows],
      ["投入候補", result.counts.readyRows],
      ["隔離候補", result.counts.quarantineRows],
      ["接触", result.counts.contactsRows],
      ["エントリー", result.counts.entriesRows],
      ["内定", result.counts.offersRows],
      ["重複候補", result.counts.duplicateStableKeyHintRows + result.counts.duplicateContactHintRows],
      ["要確認", result.counts.invalidYearRows + result.counts.invalidSourceRows + result.counts.missingIdentityRows + result.counts.invalidDateRows + result.counts.inconsistentQuarantineRows]
    ].map(([label, value]) => {
      const item = documentObject.createElement("div");
      const term = documentObject.createElement("dt");
      const description = documentObject.createElement("dd");
      term.textContent = label;
      description.textContent = String(value);
      item.append(term, description);
      return item;
    }));
  };
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file || !/\.csv$/i.test(file.name) || file.size > 5_000_000) {
      render(safeSummary("CSV_FILE_INVALID", "NOT_EVALUATED"));
      return;
    }
    const text = await file.text();
    render(analyzeTalent28CsvPreflight(text));
  });
  render(safeSummary("CSV_NOT_SELECTED", "NOT_EVALUATED"));
  return Object.freeze({ initialized: true });
}
