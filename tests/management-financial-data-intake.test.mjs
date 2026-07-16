import assert from "node:assert/strict";
import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildFinancialLocalPreview,
  buildFinancialIntakeReceipt,
  combineFinancialWorkbookResults,
  parseFinancialWorkbookBuffer,
  renderFinancialDataIntake,
} from "../portal/management-app/financial-data-intake.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = fs.readFileSync(path.join(root, "portal/management-app/app-v2.js"), "utf8");
const html = fs.readFileSync(path.join(root, "portal/management-app/index.html"), "utf8");
const styles = fs.readFileSync(path.join(root, "portal/management-app/styles.css"), "utf8");

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
  const central = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(central.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, central, eocd]);
}

const cell = (ref, value) => typeof value === "number"
  ? `<c r="${ref}"><v>${value}</v></c>`
  : `<c r="${ref}" t="inlineStr"><is><t>${String(value)}</t></is></c>`;

const row = (index, values) => `<row r="${index}">${values.map((value, column) => cell(`${String.fromCharCode(65 + column)}${index}`, value)).join("")}</row>`;

function workbook(sheetRows, sheetName = "損･BASSA新所沢店") {
  return zipStore([
    ["xl/workbook.xml", `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${sheetName}" sheetId="1" r:id="rId1"/></sheets></workbook>`],
    ["xl/_rels/workbook.xml.rels", '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'],
    ["xl/worksheets/sheet1.xml", `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows.join("")}</sheetData></worksheet>`],
  ]);
}

const months = ["9月度", "10月度", "11月度", "12月度", "1月度", "2月度", "3月度", "4月度", "5月度", "6月度", "7月度", "8月度"];
const requiredPl = ["売上高合計", "売上原価", "売上総損益金額", "給与手当", "法定福利費", "福利厚生費", "地代家賃", "水道光熱費", "広告宣伝費", "販売管理費合計", "営業損益金額", "経常損益金額"];
const inflateRaw = (bytes) => zlib.inflateRawSync(Buffer.from(bytes));

test("P/L intake validates Yayoi workbook and preserves import disabled boundary", async () => {
  const rows = [
    row(1, ["帳票名：残高試算表(年間推移)"]),
    row(5, ["集計期間：令和07年09月01日", "令和08年08月31日", "決算仕訳を含む"]),
    row(6, ["税抜/税込：税抜"]),
    row(8, ["勘定科目", ...months]),
    ...requiredPl.map((account, index) => row(9 + index, [account, ...months.map((_, month) => index * 100 + month)])),
  ];
  const result = await parseFinancialWorkbookBuffer(workbook(rows), "PL", { inflateRaw });
  assert.equal(result.status, "PL_LOCAL_READY");
  assert.equal(result.normalizedRecordCount, 144);
  assert.equal(result.previewRows[0].entityCategory, "ENTITY_CANDIDATE");
  const receipt = buildFinancialIntakeReceipt(result);
  assert.equal(receipt.productionImportEnabled, false);
  assert.equal(receipt.entityCandidateCount, 1);
  assert.equal(receipt.aggregateExcludedSheetCount, 0);
  const preview = buildFinancialLocalPreview(result);
  assert.equal(preview.importActionEnabled, false);
  assert.equal(preview.entityCandidateCount, 1);
  assert.equal(preview.rows[0].entityName, "損･BASSA新所沢店");
  assert.equal(preview.rows[0].mappingStatus, "READY");
});

test("P/L aggregate sheets and missing exact mappings stay review-only", async () => {
  const rows = [
    row(1, ["帳票名：残高試算表(年間推移)"]),
    row(5, ["集計期間：令和07年09月01日", "令和08年08月31日", "決算仕訳を含む"]),
    row(8, ["勘定科目", ...months]),
    ...requiredPl.filter((account) => account !== "地代家賃" && account !== "販売管理費合計").map((account, index) => row(9 + index, [account, ...months.map((_, month) => index * 100 + month)])),
  ];
  const result = await parseFinancialWorkbookBuffer(workbook(rows, "損･全体(合計)"), "PL", { inflateRaw });
  assert.equal(result.status, "PL_LOCAL_VALIDATED_PENDING_MAPPING");
  assert.equal(result.aggregateSheetCount, 1);
  assert.equal(result.entityCandidateCount, 0);
  assert.deepEqual(Object.keys(result.missingByAccount), ["地代家賃", "販売管理費合計"]);
  assert.equal(result.previewRows[0].entityCategory, "AGGREGATE_EXCLUDED_FROM_ENTITY_TOTALS");
});

test("P/L local preview combines current files without enabling production import", async () => {
  const first = await parseFinancialWorkbookBuffer(workbook([
    row(1, ["帳票名：残高試算表(年間推移)"]),
    row(5, ["集計期間：令和07年09月01日", "令和08年08月31日", "決算仕訳を含む"]),
    row(8, ["勘定科目", ...months]),
    ...requiredPl.map((account, index) => row(9 + index, [account, ...months.map(() => index === 0 ? 10000 : 100)])),
  ], "損･店舗A"), "PL", { inflateRaw });
  const second = await parseFinancialWorkbookBuffer(workbook([
    row(1, ["帳票名：残高試算表(年間推移)"]),
    row(5, ["集計期間：令和07年09月01日", "令和08年08月31日", "決算仕訳を含む"]),
    row(8, ["勘定科目", ...months]),
    ...requiredPl.map((account, index) => row(9 + index, [account, ...months.map(() => index === 0 ? 20000 : 200)])),
  ], "損･店舗B"), "PL", { inflateRaw });
  const combined = combineFinancialWorkbookResults([first, second], "PL");
  assert.equal(combined.status, "PL_LOCAL_READY");
  assert.equal(combined.entityCandidateCount, 2);
  const preview = buildFinancialLocalPreview(combined);
  assert.equal(preview.salesManYen, 36);
  assert.equal(preview.importActionEnabled, false);
  assert.deepEqual(preview.rows.map((item) => item.entityName), ["損･店舗A", "損･店舗B"]);
});

test("B/S intake requires exact balanced assets, liabilities, and equity", async () => {
  const balanced = workbook([
    row(1, ["帳票名：残高試算表(年間推移)"]),
    row(5, ["集計期間：令和07年09月01日", "令和08年08月31日"]),
    row(8, ["勘定科目", ...months]),
    row(9, ["資産合計", ...months.map(() => 100)]),
    row(10, ["負債合計", ...months.map(() => 40)]),
    row(11, ["純資産合計", ...months.map(() => 60)]),
  ]);
  const ok = await parseFinancialWorkbookBuffer(balanced, "BS", { inflateRaw });
  assert.equal(ok.status, "BS_LOCAL_READY");
  assert.equal(ok.balanceCheck, "BALANCED");
  const imbalanced = workbook([
    row(1, ["帳票名：残高試算表(年間推移)"]),
    row(5, ["集計期間：令和07年09月01日", "令和08年08月31日"]),
    row(8, ["勘定科目", ...months]),
    row(9, ["資産合計", ...months.map(() => 101)]),
    row(10, ["負債合計", ...months.map(() => 40)]),
    row(11, ["純資産合計", ...months.map(() => 60)]),
  ]);
  const ng = await parseFinancialWorkbookBuffer(imbalanced, "BS", { inflateRaw });
  assert.equal(ng.status, "BS_BALANCE_CHECK_FAILED");
  assert.equal(ng.balanceCheck, "IMBALANCED");
});

test("Management app integrates financial data intake without runtime upload", () => {
  assert.match(html, /id="financial-data-intake"/);
  assert.match(html, /id="financial-local-preview-overview"/);
  assert.match(html, /id="financial-local-preview-stores"/);
  assert.match(app, /financial-data-intake\.js\?v=d46791b258753015/);
  assert.match(app, /renderFinancialDataIntake\(elements\.financialDataIntake\)/);
  assert.match(app, /management-financial-local-preview/);
  assert.match(app, /renderFinancialPreviewOverview/);
  assert.match(app, /renderFinancialPreviewStores/);
  assert.match(app, /renderFinancialPreviewEmpty/);
  assert.match(styles, /\.financial-intake-panel/);
  assert.match(styles, /\.financial-intake-preview/);
  assert.match(styles, /\.financial-local-preview-card/);
  assert.match(styles, /\.financial-local-preview-card\.is-empty/);
  assert.doesNotMatch(app, /financialDataIntake[\s\S]{0,240}(upload|importAction|mutation|storage)/i);
});

test("renderer exposes disabled production state", () => {
  const createElement = (tagName) => ({
    tagName,
    textContent: "",
    className: "",
    type: "",
    value: "",
    disabled: false,
    dataset: {},
    children: [],
    attributes: {},
    files: [],
    listeners: {},
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(name, listener) { this.listeners[name] = listener; },
  });
  const document = { createElement };
  const container = { dataset: {}, ownerDocument: document, children: [], replaceChildren(...children) { this.children = children; }, querySelector() { return null; } };
  assert.equal(renderFinancialDataIntake(container, { document }), true);
  const section = container.children[0];
  assert.equal(section.className, "financial-intake-panel");
  assert.equal(section.children[0].children[1].disabled, true);
  assert.equal(section.children[3].children[0].multiple, true);
});
