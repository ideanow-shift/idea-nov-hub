import test from "node:test";
import assert from "node:assert/strict";
import { analyzeTalent28CsvPreflight, buildTalent28CsvImportReadiness, buildTalent28CsvOperationalPlan, buildTalent28CsvTemplate, TALENT_28_CSV_PREFLIGHT_CONTRACT } from "../portal/talent/csv-import-preflight.mjs";

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

test("28卒 CSV preflight accepts the sealed column contract without exposing row values", () => {
  const csv = `${header}\n${row(["1", "2028", "CONTACTS_28", "contacts", "学生 太郎", "", "学校", "学部", "090-0000-0000", "", "", "", "2026-08-01", "", "", "", "", "", "", "", "", "FALSE", ""])}`;
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
  assert.equal(result.counts.duplicateStableKeyHintRows, 0);
  assert.equal(result.counts.duplicateContactHintRows, 0);
  assert.equal(result.rawValuesIncluded, false);
  assert.equal(result.networkOperationCount, 0);
  assert.equal(result.productionDbOperationCount, 0);
  assert.equal(TALENT_28_CSV_PREFLIGHT_CONTRACT.databaseOperation, false);
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
