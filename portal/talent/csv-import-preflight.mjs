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

export function buildTalent28CsvTemplate() {
  return `${REQUIRED_HEADERS.join(",")}\n`;
}

export function buildTalent28CsvPreparationGuide() {
  return Object.freeze({
    title: "ChatGPT整形後に確認すること",
    steps: Object.freeze([
      Object.freeze({ order: 1, category: "SOURCE_EXACT3", label: "CONTACTS_28・ENTRIES_28・OFFERS_28の3由来を分ける" }),
      Object.freeze({ order: 2, category: "IDENTITY_MINIMUM", label: "氏名・学校・電話/メール/LINEのいずれかを最低条件にする" }),
      Object.freeze({ order: 3, category: "DATE_FORMAT", label: "日付はYYYY-MM-DDへ統一し、不明なものは空欄にする" }),
      Object.freeze({ order: 4, category: "QUARANTINE_REASON", label: "判断できない行はquarantine_flag TRUEと理由で隔離する" })
    ]),
    rawValuesIncluded: false,
    googleSheetsConnectorRead: false,
    productionWriteReachable: false
  });
}

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
    rowColumnMismatchRows: 0,
    invalidSourceRowNoRows: 0,
    duplicateSourceRowNoRows: 0,
    invalidYearRows: 0,
    invalidSourceRows: 0,
    missingSourceLabelRows: 0,
    contactsRows: 0,
    entriesRows: 0,
    offersRows: 0,
    phoneRows: 0,
    emailRows: 0,
    lineRows: 0,
    eventDateRows: 0,
    entryStatusRows: 0,
    selectionStatusRows: 0,
    offerStatusRows: 0,
    nextActionRows: 0,
    followUpNoteRows: 0,
    duplicateStableKeyHintRows: 0,
    duplicateContactHintRows: 0,
    missingIdentityRows: 0,
    invalidDateRows: 0,
    inconsistentQuarantineRows: 0
  };

  const stableKeyHints = new Map();
  const contactHints = new Map();
  const sourceRowNos = new Map();
  for (const row of rows) {
    if (row.length === 1 && row[0].trim() === "") continue;
    counts.totalRows += 1;
    const value = (name) => String(row[index[name]] ?? "").trim();
    const columnOk = row.length === headers.length;
    const sourceRowNo = value("source_row_no");
    const sourceRowNoOk = /^[1-9]\d{0,6}$/.test(sourceRowNo);
    const yearOk = value("graduation_year") === "2028";
    const sourceType = value("source_type");
    const sourceOk = SOURCE_TYPES_28.includes(sourceType);
    const sourceLabelOk = value("source_label") !== "";
    const phone = value("phone");
    const email = value("email");
    const lineName = value("line_name");
    const identityOk = value("student_name") !== "" && value("school_name") !== "" && [phone, email, lineName].some(Boolean);
    const datesOk = [value("event_date"), value("next_action_date")].every((date) => date === "" || /^\d{4}-\d{2}-\d{2}$/.test(date));
    const eventDate = value("event_date");
    const entryStatus = value("entry_status");
    const selectionStatus = value("selection_status");
    const offerStatus = value("offer_status");
    const nextActionDate = value("next_action_date");
    const followUpNote = value("follow_up_note");
    const quarantineFlag = value("quarantine_flag");
    const quarantineReason = value("quarantine_reason");
    const stableKeyHint = normalizeHint(value("stable_key_hint"));
    const contactHint = normalizeHint(value("email")) || normalizeHint(value("phone")) || normalizeHint(value("line_name"));
    if (!columnOk) counts.rowColumnMismatchRows += 1;
    if (!sourceRowNoOk) counts.invalidSourceRowNoRows += 1;
    if (sourceRowNoOk) sourceRowNos.set(sourceRowNo, (sourceRowNos.get(sourceRowNo) || 0) + 1);
    const quarantineOk = ["TRUE", "FALSE"].includes(quarantineFlag) && (quarantineFlag === "FALSE" || quarantineReason !== "");
    if (!yearOk) counts.invalidYearRows += 1;
    if (!sourceOk) counts.invalidSourceRows += 1;
    if (!sourceLabelOk) counts.missingSourceLabelRows += 1;
    if (sourceType === "CONTACTS_28") counts.contactsRows += 1;
    if (sourceType === "ENTRIES_28") counts.entriesRows += 1;
    if (sourceType === "OFFERS_28") counts.offersRows += 1;
    if (phone) counts.phoneRows += 1;
    if (email) counts.emailRows += 1;
    if (lineName) counts.lineRows += 1;
    if (eventDate) counts.eventDateRows += 1;
    if (entryStatus) counts.entryStatusRows += 1;
    if (selectionStatus) counts.selectionStatusRows += 1;
    if (offerStatus) counts.offerStatusRows += 1;
    if (nextActionDate) counts.nextActionRows += 1;
    if (followUpNote) counts.followUpNoteRows += 1;
    if (!identityOk) counts.missingIdentityRows += 1;
    if (!datesOk) counts.invalidDateRows += 1;
    if (!quarantineOk) counts.inconsistentQuarantineRows += 1;
    if (stableKeyHint) stableKeyHints.set(stableKeyHint, (stableKeyHints.get(stableKeyHint) || 0) + 1);
    if (contactHint) contactHints.set(contactHint, (contactHints.get(contactHint) || 0) + 1);
    if (quarantineFlag === "TRUE" || !columnOk || !sourceRowNoOk || !yearOk || !sourceOk || !sourceLabelOk || !identityOk || !datesOk || !quarantineOk) counts.quarantineRows += 1;
    else counts.readyRows += 1;
  }
  counts.duplicateSourceRowNoRows = countDuplicateOccurrences(sourceRowNos);
  if (counts.duplicateSourceRowNoRows > 0) {
    counts.readyRows = Math.max(0, counts.readyRows - counts.duplicateSourceRowNoRows);
    counts.quarantineRows += counts.duplicateSourceRowNoRows;
  }
  counts.duplicateStableKeyHintRows = countDuplicateOccurrences(stableKeyHints);
  counts.duplicateContactHintRows = countDuplicateOccurrences(contactHints);

  const fixedCategory = counts.totalRows === 0
    ? "CSV_NO_DATA_ROWS"
    : counts.rowColumnMismatchRows > 0
      ? "CSV_ROW_COLUMN_COUNT_MISMATCH"
      : counts.invalidSourceRowNoRows > 0
        ? "CSV_SOURCE_ROW_NO_INVALID"
        : counts.duplicateSourceRowNoRows > 0
          ? "CSV_SOURCE_ROW_NO_DUPLICATE"
          : counts.invalidYearRows > 0
          ? "CSV_2028_YEAR_MISMATCH"
          : counts.invalidSourceRows > 0
            ? "CSV_SOURCE_TYPE_MISMATCH"
            : counts.missingSourceLabelRows > 0
              ? "CSV_SOURCE_LABEL_MISSING"
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

export function buildTalent28CsvOperationalPlan(readiness) {
  const category = String(readiness?.category || "NEEDS_FIX");
  const steps = category === "READY_FOR_STAGING_PREFLIGHT" || category === "READY_WITH_QUARANTINE"
    ? [
        ["1", "CSV preflight結果を保存せず件数だけ確認"],
        ["2", "別承認でstaging preflightを実行"],
        ["3", "不一致があればrollback、canonical反映は別承認"]
      ]
    : category === "NO_READY_ROWS"
      ? [
          ["1", "CSV整形元を確認"],
          ["2", "隔離理由が意図どおりか確認"],
          ["3", "投入候補ができるまでstaging承認へ進まない"]
        ]
      : [
          ["1", "CSV列・年度・由来・必須項目を修正"],
          ["2", "個人値をチャットへ貼らず再度CSVを選択"],
          ["3", "PASS後にstaging preflight承認へ進む"]
        ];
  return Object.freeze({
    category,
    steps: Object.freeze(steps.map(([order, label]) => Object.freeze({ order, label }))),
    rawValuesIncluded: false,
    productionWriteReachable: false
  });
}

export function buildTalent28CsvSafeReceipt(result) {
  const counts = result?.counts || {};
  const statusRows = Number(counts.entryStatusRows || 0) + Number(counts.selectionStatusRows || 0) + Number(counts.offerStatusRows || 0);
  const followUpRows = Number(counts.nextActionRows || 0) + Number(counts.followUpNoteRows || 0);
  const issueRows = Number(counts.quarantineRows || 0)
    + Number(counts.duplicateStableKeyHintRows || 0)
    + Number(counts.duplicateContactHintRows || 0)
    + Number(counts.missingIdentityRows || 0)
    + Number(counts.invalidDateRows || 0);
  const category = result?.fixedCategory === "PASS"
    ? "READY_FOR_OWNER_DECISION"
    : result?.fixedCategory === "CSV_DUPLICATE_HINT_REVIEW_REQUIRED"
      ? "READY_WITH_DUPLICATE_REVIEW"
      : "NEEDS_SAFE_FIX";
  return Object.freeze({
    schemaVersion: "talent-28-csv-safe-receipt-v1",
    category,
    readinessCategory: String(result?.readiness?.category || "NEEDS_FIX"),
    sourceCoverageCategory: String(result?.readiness?.sourceCoverageCategory || "NONE"),
    statusCoverageCategory: statusRows > 0 ? "PRESENT" : "ZERO",
    followUpCoverageCategory: followUpRows > 0 ? "PRESENT" : "ZERO",
    issueCategory: issueRows > 0 ? "PRESENT" : "ZERO",
    rawValuesIncluded: false,
    productionWriteReachable: false
  });
}

export function buildTalent28CsvFixGuide(result) {
  const counts = result?.counts || {};
  const checks = [
    ["STRUCTURE", Number(counts.rowColumnMismatchRows || 0) + Number(counts.invalidSourceRowNoRows || 0) + Number(counts.duplicateSourceRowNoRows || 0)],
    ["YEAR", Number(counts.invalidYearRows || 0)],
    ["SOURCE", Number(counts.invalidSourceRows || 0) + Number(counts.missingSourceLabelRows || 0)],
    ["IDENTITY", Number(counts.missingIdentityRows || 0)],
    ["DATE", Number(counts.invalidDateRows || 0)],
    ["QUARANTINE", Number(counts.inconsistentQuarantineRows || 0)],
    ["DUPLICATE_HINT", Number(counts.duplicateStableKeyHintRows || 0) + Number(counts.duplicateContactHintRows || 0)]
  ];
  const categories = checks
    .filter(([, count]) => count > 0)
    .map(([category, count]) => Object.freeze({ category, countCategory: count === 1 ? "ONE" : "MULTIPLE" }));
  const nextCategory = categories.length === 0
    ? result?.readiness?.canRequestStagingPreflight ? "REQUEST_STAGING_PREFLIGHT_APPROVAL" : "NO_SAFE_FIX_REQUIRED"
    : categories[0].category;
  const stepText = {
    STRUCTURE: "列数・行番号・重複行番号をテンプレートに合わせてください",
    YEAR: "graduation_year を 2028 にそろえてください",
    SOURCE: "source_type と source_label を由来ごとに埋めてください",
    IDENTITY: "氏名・学校・連絡手段の最低条件を補ってください",
    DATE: "日付は YYYY-MM-DD 形式にしてください",
    QUARANTINE: "隔離フラグ TRUE には理由を入れてください",
    DUPLICATE_HINT: "重複候補を確認し、必要なら隔離理由へ回してください",
    REQUEST_STAGING_PREFLIGHT_APPROVAL: "件数カテゴリを確認し、staging preflight 承認へ進んでください",
    NO_SAFE_FIX_REQUIRED: "CSVを選択すると修正対象を表示します"
  };
  return Object.freeze({
    nextCategory,
    steps: Object.freeze((categories.length > 0 ? categories : [{ category: nextCategory, countCategory: "ZERO" }])
      .map((item, index) => Object.freeze({
        order: index + 1,
        category: item.category,
        countCategory: item.countCategory,
        label: stepText[item.category]
      }))),
    rawValuesIncluded: false,
    productionWriteReachable: false
  });
}

export function buildTalent28CsvCorrectionRoute(fixGuide) {
  const category = String(fixGuide?.nextCategory || "NO_SAFE_FIX_REQUIRED");
  const routes = Object.freeze({
    STRUCTURE: Object.freeze({ target: "CSV_TEMPLATE", title: "雛形へ戻す", copy: "列順・列数・source_row_noをテンプレートに合わせます。" }),
    YEAR: Object.freeze({ target: "GRADUATION_YEAR", title: "年度を確認", copy: "28卒だけを残し、別年度は別ファイルへ分けます。" }),
    SOURCE: Object.freeze({ target: "SOURCE_FIELDS", title: "由来を補う", copy: "source_typeとsource_labelを由来別に埋めます。" }),
    IDENTITY: Object.freeze({ target: "IDENTITY_FIELDS", title: "本人識別を補う", copy: "氏名・学校・連絡手段の最低条件を整えます。" }),
    DATE: Object.freeze({ target: "DATE_FIELDS", title: "日付を直す", copy: "日付はYYYY-MM-DD、不明な日付は空欄にします。" }),
    QUARANTINE: Object.freeze({ target: "QUARANTINE_FIELDS", title: "隔離理由を補う", copy: "TRUEの隔離行には理由を入れて投入候補と分けます。" }),
    DUPLICATE_HINT: Object.freeze({ target: "DUPLICATE_REVIEW", title: "重複候補を確認", copy: "同一候補の可能性を確認し、迷う行は隔離へ回します。" }),
    REQUEST_STAGING_PREFLIGHT_APPROVAL: Object.freeze({ target: "OWNER_APPROVAL", title: "投入前承認へ", copy: "件数カテゴリだけ確認し、staging preflight承認へ進みます。" }),
    NO_SAFE_FIX_REQUIRED: Object.freeze({ target: "CSV_SELECT", title: "CSVを選択", copy: "CSVを選ぶと修正カテゴリを表示します。" })
  });
  const selected = routes[category] || routes.NO_SAFE_FIX_REQUIRED;
  return Object.freeze({
    category,
    ...selected,
    rawValuesIncluded: false,
    productionWriteReachable: false,
    googleSheetsConnectorRead: false
  });
}

export function buildTalent28CsvCorrectionWorkbench(result) {
  const fixGuide = buildTalent28CsvFixGuide(result);
  const route = buildTalent28CsvCorrectionRoute(fixGuide);
  const category = route.category;
  const fieldGroups = Object.freeze({
    STRUCTURE: Object.freeze(["source_row_no", "列順", "列数"]),
    YEAR: Object.freeze(["graduation_year"]),
    SOURCE: Object.freeze(["source_type", "source_label"]),
    IDENTITY: Object.freeze(["student_name", "school_name", "phone/email/line_name"]),
    DATE: Object.freeze(["event_date", "next_action_date"]),
    QUARANTINE: Object.freeze(["quarantine_flag", "quarantine_reason"]),
    DUPLICATE_HINT: Object.freeze(["stable_key_hint", "mapping_hint", "連絡先hint"]),
    REQUEST_STAGING_PREFLIGHT_APPROVAL: Object.freeze(["件数カテゴリ", "隔離カテゴリ", "重複カテゴリ"]),
    NO_SAFE_FIX_REQUIRED: Object.freeze(["CSV選択", "形式検証"])
  }[category] || ["CSV選択", "形式検証"]);
  const ownerAction = {
    STRUCTURE: "雛形へ戻してCSVを作り直す",
    YEAR: "28卒以外を別ファイルへ分ける",
    SOURCE: "由来列を3種類の契約へそろえる",
    IDENTITY: "本人識別の最低項目を補う",
    DATE: "日付をYYYY-MM-DDか空欄へそろえる",
    QUARANTINE: "隔離TRUEには理由を入れる",
    DUPLICATE_HINT: "重複候補を確認して隔離またはhintを修正する",
    REQUEST_STAGING_PREFLIGHT_APPROVAL: "件数カテゴリを確認して投入前承認へ進む",
    NO_SAFE_FIX_REQUIRED: "CSVを選択して検証する"
  }[category] || "CSVを選択して検証する";
  return Object.freeze({
    category,
    title: route.title,
    ownerAction,
    fieldGroups,
    canRequestStagingPreflight: category === "REQUEST_STAGING_PREFLIGHT_APPROVAL",
    rawValuesIncluded: false,
    googleSheetsConnectorRead: false,
    productionDbOperation: false,
    stagingOrCanonicalWriteReachable: false
  });
}

export function buildTalent28CsvStagingApprovalGuide(result) {
  const workbench = buildTalent28CsvCorrectionWorkbench(result);
  const category = workbench.canRequestStagingPreflight ? "READY_TO_REQUEST_STAGING_PREFLIGHT" : "SAFE_FIX_REQUIRED_BEFORE_APPROVAL";
  const title = {
    READY_TO_REQUEST_STAGING_PREFLIGHT: "投入前承認へ進めます",
    SAFE_FIX_REQUIRED_BEFORE_APPROVAL: "CSV修正後に再確認します"
  }[category];
  const copy = {
    READY_TO_REQUEST_STAGING_PREFLIGHT: "件数カテゴリだけを確認し、別承認でstaging preflightへ進みます。canonical/LINE履歴への昇格はまだ行いません。",
    SAFE_FIX_REQUIRED_BEFORE_APPROVAL: "修正対象を直してからCSVを再選択します。個人値はチャットへ貼らず、画面内のカテゴリだけで確認します。"
  }[category];
  return Object.freeze({
    category,
    title,
    copy,
    approvalReachable: category === "READY_TO_REQUEST_STAGING_PREFLIGHT",
    rawValuesIncluded: false,
    googleSheetsConnectorRead: false,
    productionDbOperation: false,
    stagingWriteRequiresSeparateApproval: true,
    canonicalWriteReachable: false,
    lineHistoryWriteReachable: false
  });
}

function renderTalent28CsvReceiptText(receipt) {
  const categoryText = {
    READY_FOR_OWNER_DECISION: "投入前確認へ進めます",
    READY_WITH_DUPLICATE_REVIEW: "重複候補の確認が必要です",
    NEEDS_SAFE_FIX: "CSVの安全修正が必要です"
  }[receipt.category] || "CSVの状態を確認してください";
  return `${categoryText} / source=${receipt.sourceCoverageCategory} / status=${receipt.statusCoverageCategory} / followUp=${receipt.followUpCoverageCategory} / issue=${receipt.issueCategory}`;
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
      rowColumnMismatchRows: 0,
      invalidSourceRowNoRows: 0,
      duplicateSourceRowNoRows: 0,
      invalidYearRows: 0,
      invalidSourceRows: 0,
      missingSourceLabelRows: 0,
      contactsRows: 0,
      entriesRows: 0,
      offersRows: 0,
      phoneRows: 0,
      emailRows: 0,
      lineRows: 0,
      eventDateRows: 0,
      entryStatusRows: 0,
      selectionStatusRows: 0,
      offerStatusRows: 0,
      nextActionRows: 0,
      followUpNoteRows: 0,
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
  const templateButton = documentObject?.getElementById?.("talent-28-csv-template");
  const prepList = documentObject?.getElementById?.("talent-28-csv-preparation-guide");
  const status = documentObject?.getElementById?.("talent-28-csv-status");
  const summary = documentObject?.getElementById?.("talent-28-csv-summary");
  const planList = documentObject?.getElementById?.("talent-28-csv-plan");
  const receiptStatus = documentObject?.getElementById?.("talent-28-csv-receipt");
  const fixGuideList = documentObject?.getElementById?.("talent-28-csv-fix-guide");
  const correctionRoute = documentObject?.getElementById?.("talent-28-csv-correction-route");
  const correctionWorkbench = documentObject?.getElementById?.("talent-28-csv-correction-workbench");
  const stagingApprovalGuide = documentObject?.getElementById?.("talent-28-csv-staging-approval-guide");
  if (!input || !templateButton || !prepList || !status || !summary || !planList || !receiptStatus || !fixGuideList || !correctionRoute || !correctionWorkbench || !stagingApprovalGuide) return Object.freeze({ initialized: false });
  if (input.dataset.bound === "true") return Object.freeze({ initialized: true, duplicateBindingPrevented: true });
  input.dataset.bound = "true";
  const preparation = buildTalent28CsvPreparationGuide();
  prepList.replaceChildren(...preparation.steps.map((step) => {
    const item = documentObject.createElement("li");
    item.dataset.category = step.category;
    item.textContent = `${step.order}. ${step.label}`;
    return item;
  }));
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
      ["連絡あり", result.counts.phoneRows + result.counts.emailRows + result.counts.lineRows],
      ["状態あり", result.counts.entryStatusRows + result.counts.selectionStatusRows + result.counts.offerStatusRows],
      ["次回対応", result.counts.nextActionRows],
      ["重複候補", result.counts.duplicateStableKeyHintRows + result.counts.duplicateContactHintRows],
      ["要確認", result.counts.rowColumnMismatchRows + result.counts.invalidSourceRowNoRows + result.counts.duplicateSourceRowNoRows + result.counts.invalidYearRows + result.counts.invalidSourceRows + result.counts.missingSourceLabelRows + result.counts.missingIdentityRows + result.counts.invalidDateRows + result.counts.inconsistentQuarantineRows]
    ].map(([label, value]) => {
      const item = documentObject.createElement("div");
      const term = documentObject.createElement("dt");
      const description = documentObject.createElement("dd");
      term.textContent = label;
      description.textContent = String(value);
      item.append(term, description);
      return item;
    }));
    const plan = buildTalent28CsvOperationalPlan(readiness);
    planList.dataset.category = plan.category;
    planList.replaceChildren(...plan.steps.map((step) => {
      const item = documentObject.createElement("li");
      item.textContent = `${step.order}. ${step.label}`;
      return item;
    }));
    const receipt = buildTalent28CsvSafeReceipt(result);
    receiptStatus.dataset.category = receipt.category;
    receiptStatus.textContent = renderTalent28CsvReceiptText(receipt);
    const fixGuide = buildTalent28CsvFixGuide(result);
    const route = buildTalent28CsvCorrectionRoute(fixGuide);
    correctionRoute.dataset.category = route.category;
    correctionRoute.textContent = `${route.title}: ${route.copy}`;
    const workbench = buildTalent28CsvCorrectionWorkbench(result);
    correctionWorkbench.dataset.category = workbench.category;
    correctionWorkbench.replaceChildren(...[
      ["修正対象", workbench.fieldGroups.join(" / ")],
      ["スタッフ作業", workbench.ownerAction],
      ["投入前承認", workbench.canRequestStagingPreflight ? "可能" : "未到達"],
      ["安全境界", "DB・staging・canonical書込みなし"]
    ].map(([label, value]) => {
      const item = documentObject.createElement("div");
      const term = documentObject.createElement("dt");
      const description = documentObject.createElement("dd");
      term.textContent = label;
      description.textContent = value;
      item.append(term, description);
      return item;
    }));
    const approvalGuide = buildTalent28CsvStagingApprovalGuide(result);
    stagingApprovalGuide.dataset.category = approvalGuide.category;
    stagingApprovalGuide.textContent = `${approvalGuide.title}: ${approvalGuide.copy}`;
    fixGuideList.dataset.category = fixGuide.nextCategory;
    fixGuideList.replaceChildren(...fixGuide.steps.map((step) => {
      const item = documentObject.createElement("li");
      item.dataset.category = step.category;
      item.textContent = `${step.order}. ${step.label} / ${step.countCategory}`;
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
  templateButton.addEventListener("click", () => {
    const blob = new Blob([buildTalent28CsvTemplate()], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = documentObject.createElement("a");
    link.href = url;
    link.download = "nov-talent-2028-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  });
  render(safeSummary("CSV_NOT_SELECTED", "NOT_EVALUATED"));
  return Object.freeze({ initialized: true });
}
