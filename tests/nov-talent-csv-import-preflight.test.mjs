import test from "node:test";
import assert from "node:assert/strict";
import { analyzeTalent28CsvPreflight, TALENT_28_CSV_PREFLIGHT_CONTRACT } from "../portal/talent/csv-import-preflight.mjs";

const header = [
  "source_row_no", "graduation_year", "source_type", "source_label", "student_name", "student_name_kana",
  "school_name", "faculty_or_department", "phone", "email", "line_name", "event_name", "event_date",
  "entry_status", "selection_status", "offer_status", "next_action_date", "follow_up_note", "owner_note",
  "stable_key_hint", "mapping_hint", "quarantine_flag", "quarantine_reason"
].join(",");

const row = (values) => Array.from({ length: 23 }, (_, index) => values[index] ?? "").join(",");

test("28卒 CSV preflight accepts the sealed column contract without exposing row values", () => {
  const csv = `${header}\n${row(["1", "2028", "CONTACTS_28", "contacts", "学生 太郎", "", "学校", "学部", "090-0000-0000", "", "", "", "2026-08-01", "", "", "", "", "", "", "", "", "FALSE", ""])}`;
  const result = analyzeTalent28CsvPreflight(csv);
  assert.equal(result.ok, true);
  assert.equal(result.fixedCategory, "PASS");
  assert.equal(result.counts.totalRows, 1);
  assert.equal(result.counts.readyRows, 1);
  assert.equal(result.counts.contactsRows, 1);
  assert.equal(result.counts.entriesRows, 0);
  assert.equal(result.counts.offersRows, 0);
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
