import assert from "node:assert/strict";
import test from "node:test";
import { REQUIRED_ACCOUNT_MAP, dryRunWorkbook } from "../review/store-operations-monthly-import/phase1-import.mjs";

function zipStore(entries) {
  const local = []; const central = []; let offset = 0;
  for (const [name, text] of entries) {
    const nameBuffer = Buffer.from(name); const data = Buffer.from(text); const header = Buffer.alloc(30); const record = Buffer.alloc(46);
    header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(20, 4); header.writeUInt32LE(data.length, 18); header.writeUInt32LE(data.length, 22); header.writeUInt16LE(nameBuffer.length, 26);
    record.writeUInt32LE(0x02014b50, 0); record.writeUInt16LE(20, 4); record.writeUInt16LE(20, 6); record.writeUInt32LE(data.length, 20); record.writeUInt32LE(data.length, 24); record.writeUInt16LE(nameBuffer.length, 28); record.writeUInt32LE(offset, 42);
    local.push(header, nameBuffer, data); central.push(record, nameBuffer); offset += header.length + nameBuffer.length + data.length;
  }
  const directory = Buffer.concat(central); const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(entries.length, 8); eocd.writeUInt16LE(entries.length, 10); eocd.writeUInt32LE(directory.length, 12); eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, eocd]);
}

const cell = (ref, value) => value === null ? `<c r="${ref}"/>` : typeof value === "number" ? `<c r="${ref}"><v>${value}</v></c>` : `<c r="${ref}" t="inlineStr"><is><t>${value}</t></is></c>`;
const row = (number, values) => `<row r="${number}">${values.map((value, index) => cell(`${String.fromCharCode(65 + index)}${number}`, value)).join("")}</row>`;

function sheetXml({ accountNames = Object.keys(REQUIRED_ACCOUNT_MAP), month = "2026年4月", fiscalLabel = "2025年9月1日", invalidValue = false, blankValue = false }) {
  const values = [
    row(1, ["帳票名：残高試算表（年間推移）"]), row(5, [fiscalLabel]), row(6, ["税抜"]),
    row(8, ["勘定科目", month, "上半期", "当期残高"]),
    ...accountNames.map((account, index) => row(9 + index, [account, blankValue && index === 0 ? null : invalidValue && index === 0 ? "bad" : 100 + index, 999, 999])),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${values.join("")}</sheetData></worksheet>`;
}

function fixture({ omitStore = false, month = "2026年4月", fiscalLabel = "2025年9月1日", accounts, invalidValue = false, blankValue = false, unknownPl = false } = {}) {
  const storeNames = [...Array(20)].map((_, index) => `損･${index < 13 ? "D" : "F"}${String(index + 1).padStart(2, "0")}`);
  const names = [...storeNames, "損･本部", "損･EC事業部", "貸･除外", "資料･比較"];
  const entries = []; const workbookSheets = []; const relationships = [];
  names.forEach((name, index) => {
    const id = index + 1; const path = `worksheets/sheet${id}.xml`;
    workbookSheets.push(`<sheet name="${name}" sheetId="${id}" r:id="rId${id}"/>`);
    relationships.push(`<Relationship Id="rId${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="${path}"/>`);
    entries.push([`xl/${path}`, sheetXml({ month, fiscalLabel, accountNames: accounts, invalidValue, blankValue })]);
  });
  if (unknownPl) {
    const id = names.length + 1; workbookSheets.push(`<sheet name="損･未知" sheetId="${id}" r:id="rId${id}"/>`); relationships.push(`<Relationship Id="rId${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${id}.xml"/>`); entries.push([`xl/worksheets/sheet${id}.xml`, sheetXml({ month, fiscalLabel, accountNames: accounts })]);
  }
  entries.unshift(
    ["xl/workbook.xml", `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${workbookSheets.join("")}</sheets></workbook>`],
    ["xl/_rels/workbook.xml.rels", `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships.join("")}</Relationships>`],
  );
  const mapping = storeNames.filter((_, index) => !(omitStore && index === 19)).map((yayoi_sheet_name, index) => ({ yayoi_sheet_name, entity_type: "store", corporation_id: `fixture-corp-${index < 13 ? "d" : "f"}`, store_id: `fixture-store-${String(index + 1).padStart(2, "0")}`, direct_or_fc: index < 13 ? "direct" : "fc", import_enabled: true, effective_from: "2020-01-01", effective_to: null }));
  mapping.push({ yayoi_sheet_name: "損･本部", entity_type: "headquarters", corporation_id: "fixture-corp-direct", store_id: null, direct_or_fc: "not_applicable", import_enabled: true, effective_from: "2020-01-01", effective_to: null });
  mapping.push({ yayoi_sheet_name: "損･EC事業部", entity_type: "ec_department", corporation_id: "fixture-corp-direct", store_id: null, direct_or_fc: "not_applicable", import_enabled: true, effective_from: "2020-01-01", effective_to: null });
  return { buffer: zipStore(entries), mapping };
}

const run = (options = {}, mappingPatch = (mapping) => mapping) => {
  const value = fixture(options); return dryRunWorkbook(value.buffer, { fileName: "fixture.xlsx", targetPeriod: "2026-04", mapping: mappingPatch(value.mapping) });
};

test("fixture-only parser selects P/L, maps 20 stores, and normalizes four metrics", () => {
  const result = run();
  assert.equal(result.status, "DRY_RUN_READY"); assert.equal(result.mode, "fixture_only");
  assert.equal(result.total_sheet_count, 24); assert.equal(result.selected_sheet_count, 22); assert.equal(result.excluded_sheet_count, 2);
  assert.deepEqual(result.mapping, { store_count: 20, direct_count: 13, fc_count: 7, mismatch_count: 0 });
  assert.equal(result.target_account_count, 8); assert.equal(result.normalized_record_count, 176);
  assert.equal(result.db_connection_count, 0); assert.equal(result.production_connection_count, 0); assert.equal(result.file_write_count, 0);
  assert.equal(result.normalized_records.find((row) => row.store_id === "fixture-store-14" && row.metric_code === "monthly_profit").amount, null);
  assert.equal(result.normalized_records.some((row) => row.store_id && row.corporation_id === "fixture-corp-d" && row.metric_code === "monthly_sales" && row.amount === 103), true);
  assert.equal(result.normalized_records.filter((row) => row.store_id === null).length, 16);
});

test("hash is deterministic and no input buffer mutation occurs", () => {
  const value = fixture(); const before = Buffer.from(value.buffer); const first = dryRunWorkbook(value.buffer, { targetPeriod: "2026-04", mapping: value.mapping }); const second = dryRunWorkbook(value.buffer, { targetPeriod: "2026-04", mapping: value.mapping });
  assert.equal(first.workbook_hash, second.workbook_hash); assert.deepEqual(value.buffer, before);
});

test("Reiwa and R fiscal labels normalize to the matching Gregorian fiscal year", () => {
  assert.equal(run({ fiscalLabel: "令和7年9月1日" }).status, "DRY_RUN_READY");
  assert.equal(run({ fiscalLabel: "R7年9月1日" }).status, "DRY_RUN_READY");
});

test("invalid era, missing month, and future fiscal labels fail closed", () => {
  for (const fiscalLabel of ["令和元年9月1日", "令和7年", "令和8年9月1日", "平成30年9月1日"]) {
    const result = run({ fiscalLabel });
    assert.equal(result.status, "FAIL_CLOSED");
    assert.ok(result.quarantine.some((item) => item.issue_type === "invalid_pl_sheet"));
  }
});

test("twenty-store mismatch fails closed", () => { const result = run({ omitStore: true }); assert.equal(result.status, "FAIL_CLOSED"); assert.equal(result.normalized_record_count, 0); assert.ok(result.quarantine.some((item) => item.issue_type === "store_composition_invalid")); });
test("missing target month fails closed", () => { const result = run({ month: "2026年5月" }); assert.equal(result.status, "FAIL_CLOSED"); assert.ok(result.quarantine.some((item) => item.issue_type === "target_period_missing")); });
test("missing required account fails closed", () => { const result = run({ accounts: Object.keys(REQUIRED_ACCOUNT_MAP).slice(1) }); assert.equal(result.status, "FAIL_CLOSED"); assert.ok(result.quarantine.some((item) => item.issue_type === "required_account_missing")); });
test("invalid numeric value is quarantined", () => { const result = run({ invalidValue: true }); assert.equal(result.status, "FAIL_CLOSED"); assert.ok(result.quarantine.some((item) => item.issue_type === "invalid_numeric_value")); });
test("unknown P/L sheet is quarantined", () => { const result = run({ unknownPl: true }); assert.equal(result.status, "FAIL_CLOSED"); assert.ok(result.quarantine.some((item) => item.issue_type === "unknown_sheet")); });
test("duplicate fixed mapping fails closed", () => { const result = run({}, (mapping) => [...mapping, { ...mapping[0] }]); assert.equal(result.status, "FAIL_CLOSED"); assert.ok(result.quarantine.some((item) => item.issue_type === "multiple_mapping_candidates")); });
test("blank selected value is quarantined", () => { const result = run({ blankValue: true }); assert.equal(result.status, "FAIL_CLOSED"); assert.ok(result.quarantine.some((item) => item.issue_type === "required_value_missing")); });
test("unknown account and duplicate row are quarantined", () => { const unknown = run({ accounts: [...Object.keys(REQUIRED_ACCOUNT_MAP), "未知科目"] }); const duplicate = run({ accounts: [...Object.keys(REQUIRED_ACCOUNT_MAP), "技術売上高"] }); assert.equal(unknown.status, "FAIL_CLOSED"); assert.ok(unknown.quarantine.some((item) => item.issue_type === "unknown_account")); assert.equal(duplicate.status, "FAIL_CLOSED"); assert.ok(duplicate.quarantine.some((item) => item.issue_type === "duplicate_row")); });
