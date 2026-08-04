import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { analyzeTalent28CsvPreflight, buildTalent28CsvApprovalBoundary, buildTalent28CsvApprovalReadback, buildTalent28CsvCorrectionRoute, buildTalent28CsvCorrectionWorkbench, buildTalent28CsvFixGuide, buildTalent28CsvImportReadiness, buildTalent28CsvOperationalPlan, buildTalent28CsvOwnerApprovalDraft, buildTalent28CsvOwnerHandoffChecklist, buildTalent28CsvPreparationGuide, buildTalent28CsvSafePreview, buildTalent28CsvSafeReceipt, buildTalent28CsvStagingApprovalGuide, buildTalent28CsvTemplate, TALENT_28_CSV_PREFLIGHT_CONTRACT } from "../portal/talent/csv-import-preflight.mjs";

const header = [
  "source_row_no", "graduation_year", "source_type", "source_label", "student_name", "student_name_kana",
  "school_name", "faculty_or_department", "phone", "email", "line_name", "event_name", "event_date",
  "entry_status", "selection_status", "offer_status", "next_action_date", "follow_up_note", "owner_note",
  "stable_key_hint", "mapping_hint", "quarantine_flag", "quarantine_reason"
].join(",");

const row = (values) => Array.from({ length: 23 }, (_, index) => values[index] ?? "").join(",");

test("28卒 CSV template emits the exact header contract only", () => {
  const template = buildTalent28CsvTemplate();
  assert.equal(template, `${header}\n`);
  assert.doesNotMatch(template, /学生|学校|電話|メール|example/i);
  assert.equal(analyzeTalent28CsvPreflight(`${template}${row(["1", "2028", "CONTACTS_28", "contacts", "学生 太郎", "", "学校", "", "090", "", "", "", "", "", "", "", "", "", "", "", "", "FALSE", ""])}`).headerCategory, "PASS");
});

test("28卒 CSV staging approval guide stays separate from writes", async () => {
  const html = await readFile(new URL("../portal/talent/index.html", import.meta.url), "utf8");
  const css = await readFile(new URL("../portal/talent/style.css", import.meta.url), "utf8");
  const blocked = buildTalent28CsvStagingApprovalGuide({
    fixedCategory: "CSV_REQUIRED_IDENTITY_INCOMPLETE",
    readiness: { canRequestStagingPreflight: false },
    counts: { missingIdentityRows: 1 }
  });
  const ready = buildTalent28CsvStagingApprovalGuide({
    fixedCategory: "PASS",
    readiness: { canRequestStagingPreflight: true },
    counts: { totalRows: 3, readyRows: 3, quarantineRows: 0 }
  });
  assert.equal(blocked.category, "SAFE_FIX_REQUIRED_BEFORE_APPROVAL");
  assert.equal(blocked.approvalReachable, false);
  assert.equal(ready.category, "READY_TO_REQUEST_STAGING_PREFLIGHT");
  assert.equal(ready.approvalReachable, true);
  assert.equal(ready.stagingWriteRequiresSeparateApproval, true);
  assert.equal(ready.canonicalWriteReachable, false);
  assert.equal(ready.lineHistoryWriteReachable, false);
  assert.equal(ready.rawValuesIncluded, false);
  assert.match(html, /talent-28-csv-staging-approval-guide/);
  assert.match(html, /id="talent-28-csv-run"/);
  assert.match(html, />選択したCSVを検証</);
  assert.doesNotMatch(html, /csv-import-preflight\.mjs\?v=/);
  assert.doesNotMatch(html, /csv-preflight-fallback\.js/);
  assert.match(html, /app\.mjs\?v=20260804-operation-ui-cleanup-1/);
  assert.doesNotMatch(html, /Keep the workflow|approval text is prepared/i);
  assert.match(css, /\.csv-staging-approval-guide/);
});

test("28卒 CSV approval readback prevents premature staging approval", async () => {
  const html = await readFile(new URL("../portal/talent/index.html", import.meta.url), "utf8");
  const css = await readFile(new URL("../portal/talent/style.css", import.meta.url), "utf8");
  const blocked = buildTalent28CsvApprovalReadback({
    fixedCategory: "CSV_REQUIRED_IDENTITY_INCOMPLETE",
    readiness: { canRequestStagingPreflight: false },
    counts: { missingIdentityRows: 1 }
  });
  const ready = buildTalent28CsvApprovalReadback({
    fixedCategory: "PASS",
    readiness: { canRequestStagingPreflight: true },
    counts: { totalRows: 3, readyRows: 3, quarantineRows: 0 }
  });

  assert.equal(blocked.category, "FIX_BEFORE_READBACK");
  assert.equal(blocked.approvalReachable, false);
  assert.deepEqual(blocked.steps.map((step) => step.category), ["FIX_CATEGORY_FIRST", "RESELECT_CSV", "NO_OWNER_APPROVAL_YET"]);
  assert.equal(ready.category, "READY_TO_READBACK_APPROVAL");
  assert.equal(ready.approvalReachable, true);
  assert.deepEqual(ready.steps.map((step) => step.category), ["COUNT_ONLY", "STAGING_ONLY", "NO_PROMOTION"]);
  assert.equal(ready.rawValuesIncluded, false);
  assert.equal(ready.productionDbOperation, false);
  assert.equal(ready.canonicalWriteReachable, false);
  assert.equal(ready.lineHistoryWriteReachable, false);
  const blockedBoundary = buildTalent28CsvApprovalBoundary({
    fixedCategory: "CSV_REQUIRED_IDENTITY_INCOMPLETE",
    readiness: { canRequestStagingPreflight: false },
    counts: { missingIdentityRows: 1 }
  });
  const readyBoundary = buildTalent28CsvApprovalBoundary({
    fixedCategory: "PASS",
    readiness: { canRequestStagingPreflight: true },
    counts: { totalRows: 3, readyRows: 3, quarantineRows: 0 }
  });
  assert.equal(blockedBoundary.category, "BLOCK_OWNER_TEXT");
  assert.equal(blockedBoundary.approvalReachable, false);
  assert.deepEqual(blockedBoundary.checks.map((check) => check.category), ["FIX_FIRST", "RERUN_LOCAL_PREFLIGHT", "NO_PREMATURE_APPROVAL"]);
  assert.equal(readyBoundary.category, "READY_TO_PREPARE_OWNER_TEXT");
  assert.equal(readyBoundary.approvalReachable, true);
  assert.deepEqual(readyBoundary.checks.map((check) => check.category), ["LOCAL_PREFLIGHT_PASS", "STAGING_EXACT1_ONLY", "NO_CANONICAL_OR_LINE", "NO_RAW_VALUES"]);
  assert.equal(readyBoundary.rawValuesIncluded, false);
  assert.equal(readyBoundary.canonicalWriteReachable, false);
  assert.equal(readyBoundary.lineHistoryWriteReachable, false);
  const blockedPreview = buildTalent28CsvSafePreview({
    fixedCategory: "CSV_REQUIRED_IDENTITY_INCOMPLETE",
    readiness: { canRequestStagingPreflight: false, sourceCoverageCategory: "MULTIPLE" },
    counts: { readyRows: 0, quarantineRows: 0, missingIdentityRows: 1 }
  });
  const readyPreview = buildTalent28CsvSafePreview({
    fixedCategory: "PASS",
    readiness: { canRequestStagingPreflight: true, sourceCoverageCategory: "MULTIPLE" },
    counts: { readyRows: 3, quarantineRows: 0 }
  });
  const quarantinePreview = buildTalent28CsvSafePreview({
    fixedCategory: "PASS",
    readiness: { canRequestStagingPreflight: true, sourceCoverageCategory: "MULTIPLE" },
    counts: { readyRows: 2, quarantineRows: 1 }
  });
  assert.equal(blockedPreview.category, "PREVIEW_BLOCKED");
  assert.equal(readyPreview.category, "PREVIEW_READY");
  assert.equal(quarantinePreview.category, "PREVIEW_READY_WITH_QUARANTINE");
  assert.deepEqual(readyPreview.metrics.map((metric) => metric.category), ["READY_ROWS", "QUARANTINE_ROWS", "ISSUE_ROWS", "SOURCE_COVERAGE"]);
  assert.equal(readyPreview.productionDbOperation, false);
  assert.equal(readyPreview.stagingWriteReachable, false);
  assert.equal(readyPreview.rawValuesIncluded, false);
  const blockedDraft = buildTalent28CsvOwnerApprovalDraft({
    fixedCategory: "CSV_REQUIRED_IDENTITY_INCOMPLETE",
    readiness: { canRequestStagingPreflight: false },
    counts: { missingIdentityRows: 1 }
  });
  const readyDraft = buildTalent28CsvOwnerApprovalDraft({
    fixedCategory: "PASS",
    readiness: { canRequestStagingPreflight: true },
    counts: { readyRows: 3, quarantineRows: 0 }
  });
  const quarantineDraft = buildTalent28CsvOwnerApprovalDraft({
    fixedCategory: "PASS",
    readiness: { canRequestStagingPreflight: true },
    counts: { readyRows: 2, quarantineRows: 1 }
  });
  assert.equal(blockedDraft.category, "APPROVAL_DRAFT_BLOCKED");
  assert.equal(readyDraft.category, "APPROVAL_DRAFT_READY");
  assert.equal(quarantineDraft.category, "APPROVAL_DRAFT_READY_WITH_QUARANTINE");
  assert.deepEqual(readyDraft.steps.map((step) => step.category), ["MANIFEST_AND_COUNTS_ONLY", "PRODUCTION_STAGING_EXACT1", "NO_PROMOTION_BOUNDARY"]);
  assert.equal(readyDraft.ownerApprovalRequired, true);
  assert.equal(readyDraft.stagingWriteRequiresSeparateApproval, true);
  assert.equal(readyDraft.productionDbOperation, false);
  assert.equal(readyDraft.rawValuesIncluded, false);
  assert.equal(readyDraft.canonicalWriteReachable, false);
  assert.equal(readyDraft.lineHistoryWriteReachable, false);
  assert.match(html, /talent-28-csv-approval-readback/);
  assert.match(html, /talent-28-csv-approval-boundary/);
  assert.match(html, /talent-28-csv-owner-approval-draft/);
  assert.match(html, /talent-28-csv-owner-approval-draft-steps/);
  assert.match(html, /talent-28-csv-safe-preview/);
  const source = await readFile(new URL("../portal/talent/csv-import-preflight.mjs", import.meta.url), "utf8");
  assert.match(source, /buildTalent28CsvOwnerApprovalDraft/);
  assert.match(source, /dataset\.ownerApprovalRequired/);
  assert.match(source, /formatSafeCategoryLabel/);
  assert.doesNotMatch(source, /source=\$\{receipt\.sourceCoverageCategory\}/);
  assert.match(css, /\.csv-approval-readback/);
  assert.match(css, /\.csv-approval-boundary/);
  assert.match(css, /\.csv-safe-preview/);
});

test("28卒 CSV correction workbench shows safe field groups before staging approval", async () => {
  const source = await readFile(new URL("../portal/talent/csv-import-preflight.mjs", import.meta.url), "utf8");
  const html = await readFile(new URL("../portal/talent/index.html", import.meta.url), "utf8");
  const css = await readFile(new URL("../portal/talent/style.css", import.meta.url), "utf8");
  const identity = buildTalent28CsvCorrectionWorkbench({
    fixedCategory: "CSV_REQUIRED_IDENTITY_INCOMPLETE",
    readiness: { canRequestStagingPreflight: false },
    counts: { missingIdentityRows: 2 }
  });
  const ready = buildTalent28CsvCorrectionWorkbench({
    fixedCategory: "PASS",
    readiness: { canRequestStagingPreflight: true },
    counts: { totalRows: 3, readyRows: 3, quarantineRows: 0 }
  });
  assert.equal(identity.category, "IDENTITY");
  assert.deepEqual(identity.fieldGroups, Object.freeze(["student_name", "school_name"]));
  assert.equal(identity.canRequestStagingPreflight, false);
  assert.equal(identity.productionDbOperation, false);
  assert.equal(identity.stagingOrCanonicalWriteReachable, false);
  assert.equal(identity.rawValuesIncluded, false);
  assert.equal(ready.category, "REQUEST_STAGING_PREFLIGHT_APPROVAL");
  assert.equal(ready.canRequestStagingPreflight, true);
  assert.match(source, /talent-28-csv-correction-workbench/);
  assert.match(html, /talent-28-csv-correction-workbench/);
  assert.match(css, /\.csv-correction-workbench/);
});

test("28卒 CSV preparation guide explains the safe owner handoff before file selection", async () => {
  const html = await readFile(new URL("../portal/talent/index.html", import.meta.url), "utf8");
  const css = await readFile(new URL("../portal/talent/style.css", import.meta.url), "utf8");
  const guide = buildTalent28CsvPreparationGuide();
  assert.equal(guide.steps.length, 4);
  assert.deepEqual(guide.steps.map((step) => step.category), ["SOURCE_EXACT3", "IDENTITY_MINIMUM", "DATE_FORMAT", "QUARANTINE_REASON"]);
  assert.equal(guide.rawValuesIncluded, false);
  assert.equal(guide.googleSheetsConnectorRead, false);
  assert.equal(guide.productionWriteReachable, false);
  assert.match(html, /talent-28-csv-preparation-guide/);
  assert.match(css, /\.csv-preparation-guide/);
  assert.doesNotMatch(JSON.stringify(guide), /学生 太郎|090|example|source_row_no/i);
});

test("28卒 CSV preflight accepts the sealed column contract without exposing row values", () => {
  const csv = `${header}\n${row(["1", "2028", "CONTACTS_28", "contacts", "学生 太郎", "", "学校", "学部", "090-0000-0000", "", "", "", "2026-08-01", "接触", "選考前", "", "2026-08-10", "フォローあり", "", "", "", "FALSE", ""])}`;
  const result = analyzeTalent28CsvPreflight(csv);
  assert.equal(result.ok, true);
  assert.equal(result.fixedCategory, "PASS");
  assert.equal(result.readiness.category, "READY_FOR_STAGING_PREFLIGHT");
  assert.equal(result.readiness.sourceCoverageCategory, "PARTIAL");
  assert.equal(result.readiness.canRequestStagingPreflight, true);
  assert.equal(result.counts.totalRows, 1);
  assert.equal(result.counts.readyRows, 1);
  assert.equal(result.counts.rowColumnMismatchRows, 0);
  assert.equal(result.counts.invalidSourceRowNoRows, 0);
  assert.equal(result.counts.duplicateSourceRowNoRows, 0);
  assert.equal(result.counts.contactsRows, 1);
  assert.equal(result.counts.entriesRows, 0);
  assert.equal(result.counts.offersRows, 0);
  assert.equal(result.counts.phoneRows, 1);
  assert.equal(result.counts.emailRows, 0);
  assert.equal(result.counts.lineRows, 0);
  assert.equal(result.counts.eventDateRows, 1);
  assert.equal(result.counts.entryStatusRows, 1);
  assert.equal(result.counts.selectionStatusRows, 1);
  assert.equal(result.counts.offerStatusRows, 0);
  assert.equal(result.counts.nextActionRows, 1);
  assert.equal(result.counts.followUpNoteRows, 1);
  assert.equal(result.counts.duplicateStableKeyHintRows, 0);
  assert.equal(result.counts.duplicateContactHintRows, 0);
  assert.equal(result.rawValuesIncluded, false);
  assert.equal(result.networkOperationCount, 0);
  assert.equal(result.productionDbOperationCount, 0);
  const receipt = buildTalent28CsvSafeReceipt(result);
  assert.equal(receipt.category, "READY_FOR_OWNER_DECISION");
  assert.equal(receipt.sourceCoverageCategory, "PARTIAL");
  assert.equal(receipt.statusCoverageCategory, "PRESENT");
  assert.equal(receipt.followUpCoverageCategory, "PRESENT");
  assert.equal(receipt.rawValuesIncluded, false);
  const guide = buildTalent28CsvFixGuide(result);
  assert.equal(guide.nextCategory, "REQUEST_STAGING_PREFLIGHT_APPROVAL");
  assert.equal(guide.steps[0].countCategory, "ZERO");
  assert.equal(TALENT_28_CSV_PREFLIGHT_CONTRACT.databaseOperation, false);
});

test("28卒 CSV preflight accepts the compatible ChatGPT export headers", () => {
  const compatibleHeader = [
    "source_row_no", "graduation_year", "source_type", "source_label", "student_name", "student_name_kana",
    "school_name", "faculty_name", "phone", "email", "line_name", "event_name", "event_date", "event_status",
    "entry_status", "selection_status", "next_action_date", "follow_up_note", "owner_note",
    "stable_key_hint", "mapping_hint", "quarantine_flag", "quarantine_reason"
  ].join(",");
  const csv = `${compatibleHeader}\n${row(["1", "2028", "CONTACTS_28", "contacts", "学生 太郎", "", "学校", "学部", "", "", "", "説明会", "2026-08-01", "接触", "", "", "2026-08-10", "", "", "", "", "FALSE", ""])}`;
  const result = analyzeTalent28CsvPreflight(csv);
  assert.equal(result.ok, true);
  assert.equal(result.headerCategory, "PASS_COMPATIBLE_CHATGPT_EXPORT");
  assert.equal(result.counts.totalRows, 1);
  assert.equal(result.counts.contactsRows, 1);
  assert.equal(result.rawValuesIncluded, false);
});

test("28卒 CSV preflight ignores a trailing blank line in compatible exports", () => {
  const compatibleHeader = [
    "source_row_no", "graduation_year", "source_type", "source_label", "student_name", "student_name_kana",
    "school_name", "faculty_name", "phone", "email", "line_name", "event_name", "event_date", "event_status",
    "entry_status", "selection_status", "next_action_date", "follow_up_note", "owner_note",
    "stable_key_hint", "mapping_hint", "quarantine_flag", "quarantine_reason"
  ].join(",");
  const csv = `${compatibleHeader}\n${row(["1", "2028", "CONTACTS_28", "contacts", "学生 太郎", "", "学校", "学部", "", "", "", "説明会", "2026-08-01", "接触", "", "", "2026-08-10", "", "", "", "", "FALSE", ""])}\n`;
  const result = analyzeTalent28CsvPreflight(csv);
  assert.equal(result.fixedCategory, "PASS");
  assert.equal(result.counts.totalRows, 1);
  assert.equal(result.counts.invalidSourceRowNoRows, 0);
  assert.equal(result.counts.missingIdentityRows, 0);
});

test("28卒 CSV preflight shows an explicit completion state after reading a file", async () => {
  const source = await readFile(new URL("../portal/talent/csv-import-preflight.mjs", import.meta.url), "utf8");
  assert.match(source, /status\.dataset\.completed = "true"/);
  assert.match(source, /検証完了。/);
});

test("28卒 CSV preflight accepts contactless student touchpoints with name and school", () => {
  const csv = `${header}\n${row(["1", "2028", "CONTACTS_28", "fair", "学生名", "", "学校名", "", "", "", "", "イベント", "2026-08-01", "接触", "", "", "", "", "", "", "", "FALSE", ""])}`;
  const result = analyzeTalent28CsvPreflight(csv);
  assert.equal(result.fixedCategory, "PASS");
  assert.equal(result.counts.readyRows, 1);
  assert.equal(result.counts.quarantineRows, 0);
  assert.equal(result.counts.phoneRows + result.counts.emailRows + result.counts.lineRows, 0);
  assert.equal(result.counts.missingIdentityRows, 0);
  assert.equal(result.rawValuesIncluded, false);
});

test("28卒 CSV preflight quarantines unsafe year and identity rows by category only", () => {
  const csv = `${header}\n${row(["1", "2027", "CONTACTS_28", "contacts", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "FALSE", ""])}`;
  const result = analyzeTalent28CsvPreflight(csv);
  assert.equal(result.ok, false);
  assert.equal(result.fixedCategory, "CSV_2028_YEAR_MISMATCH");
  assert.equal(result.readiness.category, "NEEDS_FIX");
  assert.equal(result.readiness.canRequestStagingPreflight, false);
  assert.equal(result.counts.invalidYearRows, 1);
  assert.equal(result.counts.contactsRows, 1);
  assert.equal(result.counts.missingIdentityRows, 1);
  assert.equal(result.counts.quarantineRows, 1);
  assert.deepEqual(Object.keys(result).includes("rows"), false);
});

test("28卒 CSV preflight fails closed on header drift and malformed quarantine flags", () => {
  const badHeader = analyzeTalent28CsvPreflight(header.replace("source_row_no", "row") + "\n1,2028,CONTACTS_28");
  assert.equal(badHeader.fixedCategory, "CSV_HEADER_CONTRACT_MISMATCH");
  assert.equal(badHeader.headerCategory, "HEADER_ORDER_OR_NAME_MISMATCH");

  const badFlag = analyzeTalent28CsvPreflight(`${header}\n${row(["1", "2028", "OFFERS_28", "offers", "学生 太郎", "", "学校", "", "090", "", "", "", "", "", "", "", "", "", "", "", "", "TRUE", ""])}`);
  assert.equal(badFlag.fixedCategory, "CSV_QUARANTINE_CONTRACT_MISMATCH");
  assert.equal(badFlag.counts.inconsistentQuarantineRows, 1);
});

test("28卒 CSV preflight requires a nonsecret source label for traceability", () => {
  const missingLabel = analyzeTalent28CsvPreflight(`${header}\n${row(["1", "2028", "CONTACTS_28", "", "学生 太郎", "", "学校", "", "090", "", "", "", "", "", "", "", "", "", "", "", "", "FALSE", ""])}`);
  assert.equal(missingLabel.fixedCategory, "CSV_SOURCE_LABEL_MISSING");
  assert.equal(missingLabel.counts.missingSourceLabelRows, 1);
  assert.equal(missingLabel.counts.quarantineRows, 1);
  assert.equal(missingLabel.rawValuesIncluded, false);
});

test("28卒 CSV preflight fails closed on row shape and source row number drift", () => {
  const shortRow = analyzeTalent28CsvPreflight(`${header}\n1,2028,CONTACTS_28`);
  assert.equal(shortRow.fixedCategory, "CSV_ROW_COLUMN_COUNT_MISMATCH");
  assert.equal(shortRow.counts.rowColumnMismatchRows, 1);
  assert.equal(shortRow.counts.readyRows, 0);

  const invalidRowNo = analyzeTalent28CsvPreflight(`${header}\n${row(["0", "2028", "CONTACTS_28", "contacts", "学生 太郎", "", "学校", "", "090", "", "", "", "", "", "", "", "", "", "", "", "", "FALSE", ""])}`);
  assert.equal(invalidRowNo.fixedCategory, "CSV_SOURCE_ROW_NO_INVALID");
  assert.equal(invalidRowNo.counts.invalidSourceRowNoRows, 1);

  const duplicateRowNo = analyzeTalent28CsvPreflight(`${header}\n${[
    row(["7", "2028", "CONTACTS_28", "contacts", "学生 太郎", "", "学校", "", "090", "", "", "", "", "", "", "", "", "", "", "", "", "FALSE", ""]),
    row(["7", "2028", "OFFERS_28", "offers", "学生 次郎", "", "学校", "", "080", "", "", "", "", "", "", "", "", "", "", "", "", "FALSE", ""])
  ].join("\n")}`);
  assert.equal(duplicateRowNo.fixedCategory, "CSV_SOURCE_ROW_NO_DUPLICATE");
  assert.equal(duplicateRowNo.counts.duplicateSourceRowNoRows, 2);
  assert.equal(duplicateRowNo.counts.readyRows, 0);
  assert.equal(duplicateRowNo.rawValuesIncluded, false);
});

test("28卒 CSV readiness distinguishes quarantine-ready and source coverage categories", () => {
  const readyWithQuarantine = buildTalent28CsvImportReadiness({
    fixedCategory: "PASS",
    counts: { totalRows: 3, readyRows: 2, quarantineRows: 1, contactsRows: 1, entriesRows: 1, offersRows: 1 }
  });
  assert.equal(readyWithQuarantine.category, "READY_WITH_QUARANTINE");
  assert.equal(readyWithQuarantine.sourceCoverageCategory, "EXACT3");
  assert.equal(readyWithQuarantine.canRequestStagingPreflight, true);
  assert.equal(readyWithQuarantine.rawValuesIncluded, false);

  const noReady = buildTalent28CsvImportReadiness({
    fixedCategory: "PASS",
    counts: { totalRows: 1, readyRows: 0, quarantineRows: 1, contactsRows: 1, entriesRows: 0, offersRows: 0 }
  });
  assert.equal(noReady.category, "NO_READY_ROWS");
  assert.equal(noReady.canRequestStagingPreflight, false);
});

test("28卒 CSV preflight reports duplicate hints by count without returning private values", () => {
  const duplicateContact = [
    row(["1", "2028", "CONTACTS_28", "contacts", "学生 太郎", "", "学校", "", "", "same@example.test", "", "", "", "", "", "", "", "", "", "stable-a", "", "FALSE", ""]),
    row(["2", "2028", "ENTRIES_28", "entries", "学生 次郎", "", "学校", "", "", "same@example.test", "", "", "", "", "", "", "", "", "", "stable-a", "", "FALSE", ""])
  ].join("\n");
  const result = analyzeTalent28CsvPreflight(`${header}\n${duplicateContact}`);
  assert.equal(result.fixedCategory, "CSV_DUPLICATE_HINT_REVIEW_REQUIRED");
  assert.equal(result.counts.duplicateStableKeyHintRows, 2);
  assert.equal(result.counts.duplicateContactHintRows, 2);
  assert.equal(result.rawValuesIncluded, false);
  assert.equal(Object.hasOwn(result, "duplicateValues"), false);
});

test("28卒 CSV operational plan separates local checks from approved staging work", () => {
  const readyPlan = buildTalent28CsvOperationalPlan({ category: "READY_WITH_QUARANTINE" });
  assert.equal(readyPlan.steps.length, 3);
  assert.match(readyPlan.steps[1].label, /別承認/);
  assert.equal(readyPlan.productionWriteReachable, false);
  assert.equal(readyPlan.rawValuesIncluded, false);

  const fixPlan = buildTalent28CsvOperationalPlan({ category: "NEEDS_FIX" });
  assert.match(fixPlan.steps[0].label, /CSV列/);
  assert.doesNotMatch(fixPlan.steps.map((step) => step.label).join(" "), /学生 太郎|example/);
});

test("28卒 CSV safe receipt keeps owner decision categories value-free", () => {
  const duplicate = buildTalent28CsvSafeReceipt({
    fixedCategory: "CSV_DUPLICATE_HINT_REVIEW_REQUIRED",
    readiness: { category: "NEEDS_FIX", sourceCoverageCategory: "EXACT3" },
    counts: { totalRows: 3, duplicateContactHintRows: 2, readyRows: 1 }
  });
  const invalid = buildTalent28CsvSafeReceipt({
    fixedCategory: "CSV_REQUIRED_IDENTITY_INCOMPLETE",
    readiness: { category: "NEEDS_FIX", sourceCoverageCategory: "PARTIAL" },
    counts: { totalRows: 1, missingIdentityRows: 1 }
  });
  assert.equal(duplicate.category, "READY_WITH_DUPLICATE_REVIEW");
  assert.equal(duplicate.issueCategory, "PRESENT");
  assert.equal(invalid.category, "NEEDS_SAFE_FIX");
  assert.equal(invalid.productionWriteReachable, false);
  assert.doesNotMatch(JSON.stringify(duplicate), /student|phone|mail|source_row_no/i);
});

test("28卒 CSV fix guide prioritizes safe correction categories only", () => {
  const guide = buildTalent28CsvFixGuide({
    fixedCategory: "CSV_REQUIRED_IDENTITY_INCOMPLETE",
    readiness: { canRequestStagingPreflight: false },
    counts: { missingIdentityRows: 2, invalidDateRows: 1, duplicateContactHintRows: 0 }
  });
  assert.equal(guide.nextCategory, "IDENTITY");
  assert.deepEqual(guide.steps.map((step) => step.category), ["IDENTITY", "DATE"]);
  assert.equal(guide.steps[0].countCategory, "MULTIPLE");
  assert.equal(guide.rawValuesIncluded, false);
  assert.equal(guide.productionWriteReachable, false);
  assert.doesNotMatch(JSON.stringify(guide), /学生 太郎|090|example|source_row_no/i);
});

test("28卒 CSV correction route points staff back to the safe repair area", async () => {
  const html = await readFile(new URL("../portal/talent/index.html", import.meta.url), "utf8");
  const css = await readFile(new URL("../portal/talent/style.css", import.meta.url), "utf8");
  const identity = buildTalent28CsvCorrectionRoute({ nextCategory: "IDENTITY" });
  const approval = buildTalent28CsvCorrectionRoute({ nextCategory: "REQUEST_STAGING_PREFLIGHT_APPROVAL" });
  assert.equal(identity.target, "IDENTITY_FIELDS");
  assert.equal(identity.rawValuesIncluded, false);
  assert.equal(identity.googleSheetsConnectorRead, false);
  assert.equal(identity.productionWriteReachable, false);
  assert.equal(approval.target, "OWNER_APPROVAL");
  assert.match(html, /talent-28-csv-correction-route/);
  assert.match(css, /\.csv-correction-route/);
  assert.match(css, /\[data-category="REQUEST_STAGING_PREFLIGHT_APPROVAL"\]/);
  assert.doesNotMatch(JSON.stringify(identity), /学生 太郎|090|example|source_row_no/i);
});
