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
    missingIdentityRows: 0,
    invalidDateRows: 0,
    inconsistentQuarantineRows: 0
  };

  for (const row of rows) {
    if (row.length === 1 && row[0].trim() === "") continue;
    counts.totalRows += 1;
    const value = (name) => String(row[index[name]] ?? "").trim();
    const yearOk = value("graduation_year") === "2028";
    const sourceOk = SOURCE_TYPES_28.includes(value("source_type"));
    const identityOk = value("student_name") !== "" && value("school_name") !== "" && [value("phone"), value("email"), value("line_name")].some(Boolean);
    const datesOk = [value("event_date"), value("next_action_date")].every((date) => date === "" || /^\d{4}-\d{2}-\d{2}$/.test(date));
    const quarantineFlag = value("quarantine_flag");
    const quarantineReason = value("quarantine_reason");
    const quarantineOk = ["TRUE", "FALSE"].includes(quarantineFlag) && (quarantineFlag === "FALSE" || quarantineReason !== "");
    if (!yearOk) counts.invalidYearRows += 1;
    if (!sourceOk) counts.invalidSourceRows += 1;
    if (!identityOk) counts.missingIdentityRows += 1;
    if (!datesOk) counts.invalidDateRows += 1;
    if (!quarantineOk) counts.inconsistentQuarantineRows += 1;
    if (quarantineFlag === "TRUE" || !yearOk || !sourceOk || !identityOk || !datesOk || !quarantineOk) counts.quarantineRows += 1;
    else counts.readyRows += 1;
  }

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
              : "PASS";
  return Object.freeze({
    ok: fixedCategory === "PASS",
    fixedCategory,
    headerCategory,
    counts: freezeCounts(counts),
    rawValuesIncluded: false,
    networkOperationCount: 0,
    productionDbOperationCount: 0,
    stagingOrCanonicalWriteCount: 0,
    retryCount: 0
  });
}

function safeSummary(fixedCategory, headerCategory, partialCounts = {}) {
  return Object.freeze({
    ok: false,
    fixedCategory,
    headerCategory,
    counts: freezeCounts({
      totalRows: 0,
      readyRows: 0,
      quarantineRows: 0,
      invalidYearRows: 0,
      invalidSourceRows: 0,
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
    status.dataset.category = result.fixedCategory;
    status.textContent = result.ok
      ? "28卒CSVの形式検証はPASSです。DB投入は別承認で実行します。"
      : `28卒CSVの形式検証で停止しました: ${result.fixedCategory}`;
    summary.replaceChildren(...[
      ["行数", result.counts.totalRows],
      ["投入候補", result.counts.readyRows],
      ["隔離候補", result.counts.quarantineRows],
      ["年度不一致", result.counts.invalidYearRows],
      ["連絡先/氏名/学校不足", result.counts.missingIdentityRows]
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
