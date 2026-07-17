import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSanitizedYayoiPlReceipt,
  parseYayoiPlWorkbook,
  readZipEntries,
} from "../review/management-yayoi-pl-local-adapter.mjs";

function zipStore(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const [name, text] of entries) {
    const nameBuffer = Buffer.from(name);
    const data = Buffer.from(text);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(0, 10);
    local.writeUInt32LE(0, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, nameBuffer, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(0, 12);
    central.writeUInt32LE(0, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt32LE(0, 34);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBuffer);
    offset += local.length + nameBuffer.length + data.length;
  }
  const centralOffset = offset;
  const central = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(central.length, 12);
  eocd.writeUInt32LE(centralOffset, 16);
  return Buffer.concat([...localParts, central, eocd]);
}

const cell = (ref, value) => typeof value === "number"
  ? `<c r="${ref}"><v>${value}</v></c>`
  : `<c r="${ref}" t="inlineStr"><is><t>${String(value)}</t></is></c>`;

const row = (index, values) => `<row r="${index}">${values.map((value, column) => {
  const letter = String.fromCharCode(65 + column);
  return cell(`${letter}${index}`, value);
}).join("")}</row>`;

function workbook(rows) {
  const worksheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.join("")}</sheetData></worksheet>`;
  return zipStore([
    ["xl/workbook.xml", '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="損･BASSA新所沢店" sheetId="1" r:id="rId1"/></sheets></workbook>'],
    ["xl/_rels/workbook.xml.rels", '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'],
    ["xl/worksheets/sheet1.xml", worksheet],
  ]);
}

const requiredAccounts = [
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
];

function acceptedWorkbook(accounts = requiredAccounts) {
  const monthHeaders = ["9月度", "10月度", "11月度", "12月度", "1月度", "2月度", "3月度", "4月度", "5月度", "6月度", "7月度", "8月度"];
  return workbook([
    row(1, ["帳票名：残高試算表(年間推移)"]),
    row(5, ["令和07年09月01日", "令和08年08月31日", "決算仕訳を含む"]),
    row(6, ["税抜/税込：税抜"]),
    row(8, ["勘定科目", ...monthHeaders]),
    ...accounts.map((account, index) => row(9 + index, [account, ...monthHeaders.map((_, month) => 1000 + index + month)])),
  ]);
}

test("zip reader accepts stored xlsx package entries", () => {
  const entries = readZipEntries(acceptedWorkbook());
  assert.equal(entries.has("xl/workbook.xml"), true);
  assert.equal(entries.has("xl/worksheets/sheet1.xml"), true);
});

test("Yayoi PL adapter normalizes accepted annual transition workbook", () => {
  const result = parseYayoiPlWorkbook(acceptedWorkbook());
  assert.equal(result.status, "YAYOI_PL_READY_FOR_NORMALIZATION");
  assert.equal(result.sheetCount, 1);
  assert.equal(result.sheetsWithTwelveMonths, 1);
  assert.equal(result.normalizedRecordCount, 144);
  assert.deepEqual(result.missingByAccount, {});
  assert.equal(result.metadata.reportNamePresent, true);
  assert.equal(result.metadata.taxMode, "税抜/税込：税抜");
});

test("missing mapped account rows fail closed without blocking local validation", () => {
  const result = parseYayoiPlWorkbook(acceptedWorkbook(requiredAccounts.filter((account) => account !== "地代家賃")));
  assert.equal(result.status, "YAYOI_PL_LOCAL_VALIDATED_PENDING_MAPPING");
  assert.deepEqual(result.missingByAccount, { "地代家賃": 1 });
  const receipt = buildSanitizedYayoiPlReceipt([result]);
  assert.deepEqual(receipt, {
    schemaVersion: "management-yayoi-pl-local-adapter-v1",
    status: "LOCAL_VALIDATED_PENDING_ACCOUNT_MAPPING",
    workbookCount: 1,
    sheetCount: 1,
    normalizedRecordCount: 132,
    allSheetsHaveTwelveMonths: true,
    mappingRequiredAccountCount: 1,
    mappingCandidateAccountCount: 0,
    aggregateSheetHandlingRequired: false,
    dbMutationReady: false,
    importActionEnabled: false,
  });
});

test("source-evidenced aliases remain review candidates instead of becoming approved mappings", () => {
  const accounts = [
    ...requiredAccounts.filter((account) => account !== "地代家賃" && account !== "販売管理費合計"),
    "賃借料",
    "販売管理費計",
  ];
  const result = parseYayoiPlWorkbook(acceptedWorkbook(accounts));
  assert.equal(result.status, "YAYOI_PL_LOCAL_VALIDATED_PENDING_MAPPING");
  assert.deepEqual(result.mappingCandidatesByAccount, {
    "地代家賃": { sourceAccount: "賃借料", sheetCount: 1 },
    "販売管理費合計": { sourceAccount: "販売管理費計", sheetCount: 1 },
  });
  const receipt = buildSanitizedYayoiPlReceipt([result]);
  assert.equal(receipt.mappingRequiredAccountCount, 2);
  assert.equal(receipt.mappingCandidateAccountCount, 2);
  assert.equal(receipt.dbMutationReady, false);
  assert.equal(receipt.importActionEnabled, false);
});

test("invalid report shape rejects import readiness", () => {
  const result = parseYayoiPlWorkbook(workbook([row(1, ["not yayoi"]), row(8, ["勘定科目", "9月度"])]));
  assert.equal(result.status, "YAYOI_PL_FORMAT_INVALID");
  assert.equal(buildSanitizedYayoiPlReceipt([result])?.importActionEnabled, false);
});
