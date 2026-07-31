const REQUIRED_HEADERS = Object.freeze([
  "source_row_no", "graduation_year", "source_type", "source_label", "student_name", "student_name_kana",
  "school_name", "faculty_or_department", "phone", "email", "line_name", "event_name", "event_date",
  "entry_status", "selection_status", "offer_status", "next_action_date", "follow_up_note", "owner_note",
  "stable_key_hint", "mapping_hint", "quarantine_flag", "quarantine_reason"
]);
const CHATGPT_EXPORT_HEADERS = Object.freeze([
  "source_row_no", "graduation_year", "source_type", "source_label", "student_name", "student_name_kana",
  "school_name", "faculty_name", "phone", "email", "line_name", "event_name", "event_date", "event_status",
  "entry_status", "selection_status", "next_action_date", "follow_up_note", "owner_note",
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
      Object.freeze({ order: 2, category: "IDENTITY_MINIMUM", label: "氏名・学校を最低条件にする。電話・メール・LINE表示名は任意の照合ヒントとして扱う" }),
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
  const normalized = normalizeKnownHeaderContract(parsed.rows);
  const [headers, ...rows] = normalized.rows;
  const headerCategory = normalized.headerCategory;
  if (!normalized.ok) return safeSummary("CSV_HEADER_CONTRACT_MISMATCH", headerCategory);
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
    const identityOk = value("student_name") !== "" && value("school_name") !== "";
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
    IDENTITY: "氏名・学校を補ってください。電話・メール・LINE表示名は任意です",
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
    IDENTITY: Object.freeze({ target: "IDENTITY_FIELDS", title: "本人識別を補う", copy: "氏名・学校を整えます。電話・メール・LINE表示名は任意の照合ヒントです。" }),
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
    IDENTITY: Object.freeze(["student_name", "school_name"]),
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
    stagingWriteReachable: false,
    stagingWriteRequiresSeparateApproval: true,
    canonicalWriteReachable: false,
    lineHistoryWriteReachable: false
  });
}

export function buildTalent28CsvOwnerHandoffChecklist(result) {
  const approvalGuide = buildTalent28CsvStagingApprovalGuide(result);
  const category = approvalGuide.approvalReachable ? "READY_HANDOFF" : "FIX_BEFORE_HANDOFF";
  const steps = category === "READY_HANDOFF"
    ? [
        ["COUNT_CATEGORY_REVIEW", "件数カテゴリだけ確認して、個人値は貼らない"],
        ["SEPARATE_STAGING_APPROVAL", "production staging は別の明示承認で実行"],
        ["NO_CANONICAL_LINE", "canonical・LINE履歴・promotion はまだ到達しない"]
      ]
    : [
        ["SAFE_FIX_FIRST", "修正対象カテゴリを先に直す"],
        ["LOCAL_RECHECK", "CSVを再選択してローカルpreflightを再確認"],
        ["NO_CHAT_VALUES", "行の中身・ID・連絡先はチャットへ出さない"]
      ];
  return Object.freeze({
    category,
    steps: Object.freeze(steps.map(([stepCategory, label], index) => Object.freeze({
      order: index + 1,
      category: stepCategory,
      label
    }))),
    approvalReachable: approvalGuide.approvalReachable,
    rawValuesIncluded: false,
    googleSheetsConnectorRead: false,
    productionDbOperation: false,
    stagingWriteReachable: false,
    stagingWriteRequiresSeparateApproval: true,
    canonicalWriteReachable: false,
    lineHistoryWriteReachable: false
  });
}

export function buildTalent28CsvApprovalReadback(result) {
  const approvalGuide = buildTalent28CsvStagingApprovalGuide(result);
  const category = approvalGuide.approvalReachable
    ? "READY_TO_READBACK_APPROVAL"
    : "FIX_BEFORE_READBACK";
  const steps = category === "READY_TO_READBACK_APPROVAL"
    ? [
        ["COUNT_ONLY", "件数カテゴリだけを読み合わせる"],
        ["STAGING_ONLY", "承認対象はproduction staging preflightまで"],
        ["NO_PROMOTION", "canonical・LINE履歴・promotionは含めない"]
      ]
    : [
        ["FIX_CATEGORY_FIRST", "修正カテゴリを先に直す"],
        ["RESELECT_CSV", "修正版CSVを再選択してpreflightする"],
        ["NO_OWNER_APPROVAL_YET", "PASS前に投入承認へ進まない"]
      ];
  return Object.freeze({
    category,
    title: category === "READY_TO_READBACK_APPROVAL" ? "承認前の読み合わせ準備OK" : "承認前にCSV修正が必要",
    copy: category === "READY_TO_READBACK_APPROVAL"
      ? "値を出さず、件数カテゴリと境界だけを確認してからstaging preflight承認へ進みます。"
      : "修正カテゴリを解消してから、同じ画面で再preflightしてください。",
    approvalReachable: approvalGuide.approvalReachable,
    steps: Object.freeze(steps.map(([stepCategory, label], index) => Object.freeze({
      order: index + 1,
      category: stepCategory,
      label
    }))),
    rawValuesIncluded: false,
    googleSheetsConnectorRead: false,
    productionDbOperation: false,
    stagingWriteReachable: false,
    stagingWriteRequiresSeparateApproval: true,
    canonicalWriteReachable: false,
    lineHistoryWriteReachable: false
  });
}

export function buildTalent28CsvApprovalBoundary(result) {
  const readback = buildTalent28CsvApprovalReadback(result);
  const category = readback.approvalReachable
    ? "READY_TO_PREPARE_OWNER_TEXT"
    : "BLOCK_OWNER_TEXT";
  const checks = category === "READY_TO_PREPARE_OWNER_TEXT"
    ? [
        ["LOCAL_PREFLIGHT_PASS", "Use only the local CSV preflight result categories."],
        ["STAGING_EXACT1_ONLY", "The next approval can only cover production staging exact1."],
        ["NO_CANONICAL_OR_LINE", "Canonical, promotion, and LINE history remain out of scope."],
        ["NO_RAW_VALUES", "Do not paste row values, IDs, contacts, digest, or raw errors."]
      ]
    : [
        ["FIX_FIRST", "Fix the current CSV category before preparing approval text."],
        ["RERUN_LOCAL_PREFLIGHT", "Select the corrected CSV and rerun local preflight once."],
        ["NO_PREMATURE_APPROVAL", "Do not ask for staging approval while the local result is blocked."]
      ];
  return Object.freeze({
    category,
    title: category === "READY_TO_PREPARE_OWNER_TEXT" ? "投入前承認の準備ができました" : "投入前承認はまだ準備できません",
    copy: category === "READY_TO_PREPARE_OWNER_TEXT"
      ? "個人値を含まない安全カテゴリを確認してから、次の承認へ進みます。"
      : "安全カテゴリが整うまでCSV修正を続けます。",
    checks: Object.freeze(checks.map(([checkCategory, label], index) => Object.freeze({
      order: index + 1,
      category: checkCategory,
      label
    }))),
    approvalReachable: readback.approvalReachable,
    rawValuesIncluded: false,
    googleSheetsConnectorRead: false,
    productionDbOperation: false,
    stagingWriteRequiresSeparateApproval: true,
    canonicalWriteReachable: false,
    lineHistoryWriteReachable: false,
    automaticPromotionReachable: false
  });
}

export function buildTalent28CsvOwnerApprovalDraft(result) {
  const boundary = buildTalent28CsvApprovalBoundary(result);
  const preview = buildTalent28CsvSafePreview(result);
  const category = boundary.approvalReachable
    ? preview.category === "PREVIEW_READY_WITH_QUARANTINE"
      ? "APPROVAL_DRAFT_READY_WITH_QUARANTINE"
      : "APPROVAL_DRAFT_READY"
    : "APPROVAL_DRAFT_BLOCKED";
  const steps = category === "APPROVAL_DRAFT_BLOCKED"
    ? [
        ["LOCAL_PREFLIGHT_REQUIRED", "ローカルpreflight PASSまでは承認文を準備しない"],
        ["FIX_CSV_FIRST", "修正カテゴリを解消してから再確認する"],
        ["NO_VALUES_IN_CHAT", "CSV行・個人値・ID・raw errorは貼らない"]
      ]
    : [
        ["MANIFEST_AND_COUNTS_ONLY", "manifestと件数カテゴリだけを読み合わせる"],
        ["PRODUCTION_STAGING_EXACT1", "承認対象はproduction staging exact1に限定する"],
        ["NO_PROMOTION_BOUNDARY", "canonical/LINE/promotion/2028以外の昇格は別承認まで不可到達"]
      ];
  return Object.freeze({
    category,
    title: category === "APPROVAL_DRAFT_BLOCKED" ? "staging承認文はブロック中" : "staging承認文の読み合わせ準備OK",
    copy: category === "APPROVAL_DRAFT_READY_WITH_QUARANTINE"
      ? "隔離候補を含むため、投入候補と隔離候補を分けて承認前に確認します。"
      : category === "APPROVAL_DRAFT_READY"
        ? "値を出さずに、件数カテゴリと境界だけでstaging承認へ進めます。"
        : "安全カテゴリがPASSになるまで、承認文の準備は止めます。",
    steps: Object.freeze(steps.map(([stepCategory, label], index) => Object.freeze({
      order: index + 1,
      category: stepCategory,
      label
    }))),
    approvalReachable: boundary.approvalReachable,
    ownerApprovalRequired: boundary.approvalReachable,
    rawValuesIncluded: false,
    googleSheetsConnectorRead: false,
    productionDbOperation: false,
    stagingWriteRequiresSeparateApproval: true,
    canonicalWriteReachable: false,
    lineHistoryWriteReachable: false,
    automaticPromotionReachable: false
  });
}

export function buildTalent28CsvSafePreview(result) {
  const counts = result?.counts || {};
  const readiness = result?.readiness || buildTalent28CsvImportReadiness(result);
  const readyRows = Number(counts.readyRows || 0);
  const quarantineRows = Number(counts.quarantineRows || 0);
  const issueRows = Number(counts.rowColumnMismatchRows || 0)
    + Number(counts.invalidSourceRowNoRows || 0)
    + Number(counts.duplicateSourceRowNoRows || 0)
    + Number(counts.invalidYearRows || 0)
    + Number(counts.invalidSourceRows || 0)
    + Number(counts.missingSourceLabelRows || 0)
    + Number(counts.missingIdentityRows || 0)
    + Number(counts.invalidDateRows || 0)
    + Number(counts.inconsistentQuarantineRows || 0)
    + Number(counts.duplicateStableKeyHintRows || 0)
    + Number(counts.duplicateContactHintRows || 0);
  const category = readiness.canRequestStagingPreflight
    ? quarantineRows > 0 ? "PREVIEW_READY_WITH_QUARANTINE" : "PREVIEW_READY"
    : "PREVIEW_BLOCKED";
  const title = {
    PREVIEW_READY: "安全プレビューは承認前確認へ進めます",
    PREVIEW_READY_WITH_QUARANTINE: "安全プレビューは隔離込みで承認前確認へ進めます",
    PREVIEW_BLOCKED: "安全プレビューは修正待ちです"
  }[category];
  const copy = {
    PREVIEW_READY: "件数カテゴリと境界だけを確認し、production staging exact1の承認は別で扱います。",
    PREVIEW_READY_WITH_QUARANTINE: "投入候補と隔離候補を分けたまま、値を表示せず承認前確認へ進みます。",
    PREVIEW_BLOCKED: "修正カテゴリが残っています。staging承認文はまだ準備しません。"
  }[category];
  return Object.freeze({
    category,
    title,
    copy,
    metrics: Object.freeze([
      Object.freeze({ category: "READY_ROWS", label: "投入候補", countCategory: countCategory(readyRows) }),
      Object.freeze({ category: "QUARANTINE_ROWS", label: "隔離候補", countCategory: countCategory(quarantineRows) }),
      Object.freeze({ category: "ISSUE_ROWS", label: "修正確認", countCategory: countCategory(issueRows) }),
      Object.freeze({ category: "SOURCE_COVERAGE", label: "由来3区分", countCategory: readiness.sourceCoverageCategory || "NONE" })
    ]),
    approvalReachable: readiness.canRequestStagingPreflight === true,
    rawValuesIncluded: false,
    googleSheetsConnectorRead: false,
    productionDbOperation: false,
    stagingWriteReachable: false,
    stagingWriteRequiresSeparateApproval: true,
    canonicalWriteReachable: false,
    lineHistoryWriteReachable: false,
    automaticPromotionReachable: false
  });
}

function renderTalent28CsvReceiptText(receipt) {
  const categoryText = {
    READY_FOR_OWNER_DECISION: "投入前確認へ進めます",
    READY_WITH_DUPLICATE_REVIEW: "重複候補の確認が必要です",
    NEEDS_SAFE_FIX: "CSVの安全修正が必要です"
  }[receipt.category] || "CSVの状態を確認してください";
  return `${categoryText} / 由来=${formatSafeCategoryLabel(receipt.sourceCoverageCategory)} / 状態=${formatSafeCategoryLabel(receipt.statusCoverageCategory)} / 次回対応=${formatSafeCategoryLabel(receipt.followUpCoverageCategory)} / 修正確認=${formatSafeCategoryLabel(receipt.issueCategory)}`;
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

function countCategory(value) {
  const count = Number(value || 0);
  return count <= 0 ? "ZERO" : count === 1 ? "ONE" : "MULTIPLE";
}

function formatSafeCategoryLabel(category) {
  return ({
    ZERO: "なし",
    NONE: "なし",
    ONE: "1件",
    MULTIPLE: "複数あり",
    PRESENT: "あり",
    EXACT1: "1件",
    EXACT3: "3区分あり",
    PARTIAL: "一部あり",
    PASS: "確認済み",
    NOT_EVALUATED: "未確認"
  })[String(category || "")] || "確認中";
}

function freezeCounts(counts) {
  return Object.freeze(Object.fromEntries(Object.entries(counts).map(([key, value]) => [key, Number(value) || 0])));
}

function classifyHeaders(headers) {
  if (!Array.isArray(headers) || headers.length !== REQUIRED_HEADERS.length) return "HEADER_COUNT_MISMATCH";
  if (new Set(headers).size !== headers.length) return "HEADER_DUPLICATE";
  return REQUIRED_HEADERS.every((header, index) => headers[index] === header) ? "PASS" : "HEADER_ORDER_OR_NAME_MISMATCH";
}

function normalizeKnownHeaderContract(rows) {
  const [headers, ...dataRows] = rows;
  const exactCategory = classifyHeaders(headers);
  if (exactCategory === "PASS") {
    return Object.freeze({ ok: true, headerCategory: "PASS", rows });
  }
  const isChatGptExport = Array.isArray(headers)
    && headers.length === CHATGPT_EXPORT_HEADERS.length
    && CHATGPT_EXPORT_HEADERS.every((header, index) => headers[index] === header);
  if (!isChatGptExport) {
    return Object.freeze({ ok: false, headerCategory: exactCategory, rows });
  }
  const sourceIndex = Object.fromEntries(headers.map((header, index) => [header, index]));
  const normalizedRows = dataRows
    .filter((row) => !(row.length === 1 && String(row[0] ?? "").trim() === ""))
    .map((row) => REQUIRED_HEADERS.map((header) => {
    if (header === "faculty_or_department") return row[sourceIndex.faculty_name] ?? "";
    if (header === "offer_status") return "";
    return row[sourceIndex[header]] ?? "";
    }));
  return Object.freeze({
    ok: true,
    headerCategory: "PASS_COMPATIBLE_CHATGPT_EXPORT",
    rows: Object.freeze([REQUIRED_HEADERS, ...normalizedRows])
  });
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
  const runButton = documentObject?.getElementById?.("talent-28-csv-run");
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
  const ownerHandoffChecklist = documentObject?.getElementById?.("talent-28-csv-owner-handoff-checklist");
  const approvalReadback = documentObject?.getElementById?.("talent-28-csv-approval-readback");
  const approvalReadbackTitle = documentObject?.getElementById?.("talent-28-csv-approval-readback-title");
  const approvalReadbackCopy = documentObject?.getElementById?.("talent-28-csv-approval-readback-copy");
  const approvalReadbackSteps = documentObject?.getElementById?.("talent-28-csv-approval-readback-steps");
  const approvalBoundary = documentObject?.getElementById?.("talent-28-csv-approval-boundary");
  const approvalBoundaryTitle = documentObject?.getElementById?.("talent-28-csv-approval-boundary-title");
  const approvalBoundaryCopy = documentObject?.getElementById?.("talent-28-csv-approval-boundary-copy");
  const approvalBoundaryChecks = documentObject?.getElementById?.("talent-28-csv-approval-boundary-checks");
  const ownerApprovalDraft = documentObject?.getElementById?.("talent-28-csv-owner-approval-draft");
  const ownerApprovalDraftTitle = documentObject?.getElementById?.("talent-28-csv-owner-approval-draft-title");
  const ownerApprovalDraftCopy = documentObject?.getElementById?.("talent-28-csv-owner-approval-draft-copy");
  const ownerApprovalDraftSteps = documentObject?.getElementById?.("talent-28-csv-owner-approval-draft-steps");
  const safePreview = documentObject?.getElementById?.("talent-28-csv-safe-preview");
  const safePreviewTitle = documentObject?.getElementById?.("talent-28-csv-safe-preview-title");
  const safePreviewCopy = documentObject?.getElementById?.("talent-28-csv-safe-preview-copy");
  const safePreviewMetrics = documentObject?.getElementById?.("talent-28-csv-safe-preview-metrics");
  if (!input || !runButton || !templateButton || !prepList || !status || !summary || !planList || !receiptStatus || !fixGuideList || !correctionRoute || !correctionWorkbench || !stagingApprovalGuide || !ownerHandoffChecklist || !approvalReadback || !approvalReadbackTitle || !approvalReadbackCopy || !approvalReadbackSteps || !approvalBoundary || !approvalBoundaryTitle || !approvalBoundaryCopy || !approvalBoundaryChecks || !ownerApprovalDraft || !ownerApprovalDraftTitle || !ownerApprovalDraftCopy || !ownerApprovalDraftSteps || !safePreview || !safePreviewTitle || !safePreviewCopy || !safePreviewMetrics) return Object.freeze({ initialized: false });
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
    const handoffChecklist = buildTalent28CsvOwnerHandoffChecklist(result);
    ownerHandoffChecklist.dataset.category = handoffChecklist.category;
    ownerHandoffChecklist.replaceChildren(...handoffChecklist.steps.map((step) => {
      const item = documentObject.createElement("li");
      item.dataset.category = step.category;
      item.textContent = `${step.order}. ${step.label}`;
      return item;
    }));
    const readback = buildTalent28CsvApprovalReadback(result);
    approvalReadback.dataset.category = readback.category;
    approvalReadbackTitle.textContent = readback.title;
    approvalReadbackCopy.textContent = readback.copy;
    approvalReadbackSteps.replaceChildren(...readback.steps.map((step) => {
      const item = documentObject.createElement("li");
      item.dataset.category = step.category;
      item.textContent = `${step.order}. ${step.label}`;
      return item;
    }));
    const boundary = buildTalent28CsvApprovalBoundary(result);
    approvalBoundary.dataset.category = boundary.category;
    approvalBoundaryTitle.textContent = boundary.title;
    approvalBoundaryCopy.textContent = boundary.copy;
    approvalBoundaryChecks.replaceChildren(...boundary.checks.map((check) => {
      const item = documentObject.createElement("li");
      item.dataset.category = check.category;
      item.textContent = `${check.order}. ${check.label}`;
      return item;
    }));
    const draft = buildTalent28CsvOwnerApprovalDraft(result);
    ownerApprovalDraft.dataset.category = draft.category;
    ownerApprovalDraft.dataset.ownerApprovalRequired = String(draft.ownerApprovalRequired);
    ownerApprovalDraft.dataset.stagingWriteRequiresSeparateApproval = String(draft.stagingWriteRequiresSeparateApproval);
    ownerApprovalDraftTitle.textContent = draft.title;
    ownerApprovalDraftCopy.textContent = draft.copy;
    ownerApprovalDraftSteps.replaceChildren(...draft.steps.map((step) => {
      const item = documentObject.createElement("li");
      item.dataset.category = step.category;
      item.textContent = `${step.order}. ${step.label}`;
      return item;
    }));
    const preview = buildTalent28CsvSafePreview(result);
    safePreview.dataset.category = preview.category;
    safePreviewTitle.textContent = preview.title;
    safePreviewCopy.textContent = preview.copy;
    safePreviewMetrics.replaceChildren(...preview.metrics.map((metric) => {
      const item = documentObject.createElement("div");
      const term = documentObject.createElement("dt");
      const description = documentObject.createElement("dd");
      term.textContent = metric.label;
      description.textContent = formatSafeCategoryLabel(metric.countCategory);
      item.dataset.category = metric.category;
      item.append(term, description);
      return item;
    }));
    fixGuideList.dataset.category = fixGuide.nextCategory;
    fixGuideList.replaceChildren(...fixGuide.steps.map((step) => {
      const item = documentObject.createElement("li");
      item.dataset.category = step.category;
      item.textContent = `${step.order}. ${step.label} / ${formatSafeCategoryLabel(step.countCategory)}`;
      return item;
    }));
  };
  const runSelectedFilePreflight = async () => {
    const file = input.files?.[0];
    if (!file || !/\.csv$/i.test(file.name) || file.size > 5_000_000) {
      render(safeSummary("CSV_FILE_INVALID", "NOT_EVALUATED"));
      return;
    }
    status.dataset.category = "CHECKING";
    status.textContent = "CSVを検証しています。完了までこの画面でお待ちください。";
    const text = await file.text();
    const result = analyzeTalent28CsvPreflight(text);
    render(result);
    status.dataset.completed = "true";
    status.textContent = `検証完了。${status.textContent}`;
  };
  input.addEventListener("change", runSelectedFilePreflight);
  input.addEventListener("input", runSelectedFilePreflight);
  runButton.addEventListener("click", runSelectedFilePreflight);
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

function initializeTalent28CsvPreflightFromPage() {
  if (!globalThis.document) return;
  initializeTalent28CsvPreflight();
}

if (globalThis.document?.readyState === "loading") {
  globalThis.document.addEventListener("DOMContentLoaded", initializeTalent28CsvPreflightFromPage, { once: true });
} else {
  initializeTalent28CsvPreflightFromPage();
}
