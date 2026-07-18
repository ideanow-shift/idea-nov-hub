import assert from "node:assert/strict";
import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildFinancialAccountingRequestMessage,
  buildFinancialAccountingRequestImpact,
  buildFinancialAccountingRequestText,
  buildFinancialBalanceReviewCsv,
  buildFinancialBalanceReviewRows,
  buildFinancialCompletionItems,
  buildFinancialCompletionRequestCsv,
  buildFinancialLocalPreview,
  buildFinancialMappingReviewCsv,
  buildFinancialMappingReviewRows,
  buildFinancialReflectionSummary,
  buildFinancialSubmissionPackage,
  buildFinancialIntakeReceipt,
  combineFinancialWorkbookResults,
  parseFinancialWorkbookBuffer,
  renderFinancialDataIntake,
  validateFinancialMappingConfirmationCsv,
  validateFinancialMappingConfirmationFile,
  validateFinancialWorkbookFiles,
} from "../portal/management-app/financial-data-intake.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = fs.readFileSync(path.join(root, "portal/management-app/app-v2.js"), "utf8");
const html = fs.readFileSync(path.join(root, "portal/management-app/index.html"), "utf8");
const styles = fs.readFileSync(path.join(root, "portal/management-app/styles.css"), "utf8");
const financialIntake = fs.readFileSync(path.join(root, "portal/management-app/financial-data-intake.js"), "utf8");
const visualFixture = fs.readFileSync(path.join(root, "tests/fixtures/management-financial-data-intake.html"), "utf8");
const localPreviewFixture = fs.readFileSync(path.join(root, "tests/fixtures/management-financial-local-preview.html"), "utf8");

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

function workbookFile(name, bytes) {
  return {
    name,
    size: bytes.byteLength,
    async arrayBuffer() {
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    },
  };
}

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
  assert.equal(result.previewRows[0].entityCategory, "STORE_CANDIDATE");
  const receipt = buildFinancialIntakeReceipt(result);
  assert.equal(receipt.productionImportEnabled, false);
  assert.equal(receipt.entityCandidateCount, 1);
  assert.equal(receipt.aggregateExcludedSheetCount, 0);
  const preview = buildFinancialLocalPreview(result);
  assert.equal(preview.importActionEnabled, false);
  assert.equal(preview.entityCandidateCount, 1);
  assert.equal(preview.rows[0].entityName, "損･BASSA新所沢店");
  assert.equal(preview.rows[0].mappingStatus, "READY");
  assert.equal(preview.rows[0].entityCategory, "STORE_CANDIDATE");
});

test("P/L aggregate sheets and missing exact mappings stay review-only", async () => {
  const rows = [
    row(1, ["帳票名：残高試算表(年間推移)"]),
    row(5, ["集計期間：令和07年09月01日", "令和08年08月31日", "決算仕訳を含む"]),
    row(8, ["勘定科目", ...months]),
    ...[...requiredPl.filter((account) => account !== "地代家賃" && account !== "販売管理費合計"), "賃借料", "販売管理費計"].map((account, index) => row(9 + index, [account, ...months.map((_, month) => index * 100 + month)])),
  ];
  const result = await parseFinancialWorkbookBuffer(workbook(rows, "損･全体(合計)"), "PL", { inflateRaw });
  assert.equal(result.status, "PL_LOCAL_VALIDATED_PENDING_MAPPING");
  assert.equal(result.aggregateSheetCount, 1);
  assert.equal(result.entityCandidateCount, 0);
  assert.deepEqual(Object.keys(result.missingByAccount), ["地代家賃", "販売管理費合計"]);
  assert.deepEqual(result.mappingCandidatesByAccount, {
    "地代家賃": { sourceAccount: "賃借料", sheetCount: 1 },
    "販売管理費合計": { sourceAccount: "販売管理費計", sheetCount: 1 },
  });
  assert.equal(result.entityPreviewRows[0].mappingStatus, "LOCAL_CANDIDATE_APPLIED");
  assert.equal(result.entityPreviewRows[0].mappingCandidateCount, 2);
  assert.equal(result.previewRows[0].entityCategory, "AGGREGATE_EXCLUDED_FROM_ENTITY_TOTALS");
  const completion = buildFinancialCompletionItems(result);
  assert.deepEqual(completion.map((item) => item.status), [
    "LOCAL_VALIDATED",
    "MAPPING_REVIEW_REQUIRED",
    "SOURCE_REQUIRED",
    "SOURCE_REQUIRED",
    "SOURCE_REQUIRED",
    "SOURCE_REQUIRED",
    "SOURCE_REQUIRED",
    "RULE_REQUIRED",
  ]);
  assert.match(completion[1].detail, /賃借料 → 地代家賃/);
  assert.match(completion[1].detail, /販売管理費計 → 販売管理費合計/);
  assert.match(completion[1].detail, /経理確認待ち/);
});

test("financial completion checklist stays fail-closed before file selection", () => {
  const completion = buildFinancialCompletionItems(null);
  assert.equal(completion.length, 8);
  assert.equal(completion.filter((item) => item.status === "LOCAL_VALIDATED").length, 0);
  assert.deepEqual(completion.map((item) => item.key), [
    "PL_ANNUAL_REPORT",
    "PL_ACCOUNT_MAPPING",
    "SALES_SUBLEDGER",
    "UTILITY_SUBLEDGER",
    "COUPON_USAGE",
    "BALANCE_SHEET",
    "BUDGET_PLAN",
    "FC_RULE",
  ]);
  const exportFile = buildFinancialCompletionRequestCsv(null);
  assert.equal(exportFile.fileName, "management-financial-missing-data-request.csv");
  assert.equal(exportFile.rowCount, 8);
  assert.match(exportFile.csv, /^\uFEFF"資料区分","資料名","現在状態","依頼内容","提出形式","集計粒度","必須項目","検証条件"/u);
  assert.match(exportFile.csv, /"SALES_SUBLEDGER","売上高の補助残高一覧表","資料待ち"/u);
  assert.match(exportFile.csv, /"対象月×法人×店舗\/部門×勘定科目"/u);
  assert.match(exportFile.csv, /"資産=負債\+純資産・対象期\/候補一意"/u);
  assert.match(exportFile.csv, /"FC合計\/共通\/個店を排他的に分類"/u);
  assert.doesNotMatch(exportFile.csv, /(金額|原本名|employeeId|sessionToken|Authorization|contentIdentity)/iu);
});

test("supplemental local receipt updates only the matching completion requirements", () => {
  const receipt = {
    schemaVersion: "management-financial-supplemental-local-v1",
    category: "LOCAL_SUPPLEMENTAL_FILES_READY",
    validatedKinds: ["UTILITY_SUBLEDGER", "COUPON_USAGE", "BUDGET_PLAN", "FC_RULE"],
    validatedFileCount: 4,
    validatedRowCount: 4,
    productionImportReady: false,
    mutationCount: 0,
    uploadCount: 0,
  };
  const completion = buildFinancialCompletionItems({ localSupplementalReceipt: receipt });
  const supplemental = completion.filter((item) => receipt.validatedKinds.includes(item.key));
  assert.equal(supplemental.length, 4);
  assert.ok(supplemental.every((item) => item.status === "LOCAL_EVIDENCE_RECEIVED"));
  assert.ok(supplemental.every((item) => /本番未投入/u.test(item.detail)));
  assert.equal(completion.find((item) => item.key === "SALES_SUBLEDGER").status, "SOURCE_REQUIRED");
  const forged = buildFinancialCompletionItems({ localSupplementalReceipt: { ...receipt, validatedFileCount: 3 } });
  assert.equal(forged.find((item) => item.key === "FC_RULE").status, "RULE_REQUIRED");
  assert.equal(forged.find((item) => item.key === "UTILITY_SUBLEDGER").status, "SOURCE_REQUIRED");
});

test("store CSV local receipt updates only the sales subledger requirement", () => {
  const receipt = {
    schemaVersion: "management-store-csv-local-validation-v1",
    status: "LOCAL_FILES_READY",
    files: [
      { kind: "STORE_MONTHLY_SALES", category: "VALID", rowCount: 12 },
      { kind: "STORE_DAILY_SALES", category: "VALID", rowCount: 31 },
      { kind: "STORE_RESERVATIONS", category: "VALID", rowCount: 31 },
    ],
  };
  const completion = buildFinancialCompletionItems({ localStoreCsvReceipt: receipt });
  assert.equal(completion.find((item) => item.key === "SALES_SUBLEDGER").status, "LOCAL_EVIDENCE_RECEIVED");
  assert.match(completion.find((item) => item.key === "SALES_SUBLEDGER").detail, /本番照合は未実行/u);
  assert.equal(completion.find((item) => item.key === "UTILITY_SUBLEDGER").status, "SOURCE_REQUIRED");
  assert.equal(completion.find((item) => item.key === "PL_ANNUAL_REPORT").status, "SOURCE_REQUIRED");
  const forged = buildFinancialCompletionItems({ localStoreCsvReceipt: { ...receipt, files: receipt.files.slice(0, 2) } });
  assert.equal(forged.find((item) => item.key === "SALES_SUBLEDGER").status, "SOURCE_REQUIRED");
});

test("financial submission package summarizes local readiness without enabling import", () => {
  const storeReceipt = {
    schemaVersion: "management-store-csv-local-validation-v1",
    status: "LOCAL_FILES_READY",
    files: [
      { kind: "STORE_MONTHLY_SALES", category: "VALID", rowCount: 12 },
      { kind: "STORE_DAILY_SALES", category: "VALID", rowCount: 31 },
      { kind: "STORE_RESERVATIONS", category: "VALID", rowCount: 31 },
    ],
  };
  const supplementalReceipt = {
    schemaVersion: "management-financial-supplemental-local-v1",
    category: "LOCAL_SUPPLEMENTAL_FILES_READY",
    validatedKinds: ["UTILITY_SUBLEDGER", "COUPON_USAGE", "BUDGET_PLAN", "FC_RULE"],
    validatedFileCount: 4,
    validatedRowCount: 4,
    productionImportReady: false,
    mutationCount: 0,
    uploadCount: 0,
  };
  const pkg = buildFinancialSubmissionPackage({
    statement: "PL",
    status: "PL_LOCAL_READY",
    sheetCount: 3,
    missingByAccount: {},
    localStoreCsvReceipt: storeReceipt,
    localSupplementalReceipt: supplementalReceipt,
  });
  assert.equal(pkg.schemaVersion, "management-financial-submission-package-v1");
  assert.equal(pkg.category, "LOCAL_PACKAGE_INCOMPLETE");
  assert.equal(pkg.readyCount, 7);
  assert.equal(pkg.pendingCount, 1);
  assert.equal(pkg.productionImportEnabled, false);
  assert.equal(pkg.mutationCount, 0);
  assert.equal(pkg.uploadCount, 0);
  assert.equal(pkg.nextAction.category, "NEXT_PROVIDE_BALANCE_SHEET");
  assert.match(pkg.nextAction.label, /B\/S/u);
  assert.deepEqual(pkg.nextAction.checklist, ["資産合計", "負債合計", "純資産合計", "12か月列", "対象期・候補一意"]);
  const reflection = buildFinancialReflectionSummary({
    statement: "PL",
    status: "PL_LOCAL_READY",
    sheetCount: 3,
    missingByAccount: {},
    localStoreCsvReceipt: storeReceipt,
    localSupplementalReceipt: supplementalReceipt,
  });
  assert.equal(reflection.schemaVersion, "management-financial-reflection-summary-v1");
  assert.equal(reflection.corporate, "LOCAL_PREVIEW_ACTIVE");
  assert.equal(reflection.stores, "LOCAL_PREVIEW_ACTIVE");
  assert.equal(reflection.production, "DISABLED_PENDING_CONTRACT");
  assert.equal(reflection.productionImportEnabled, false);
  assert.equal(reflection.mutationCount, 0);
  assert.equal(reflection.uploadCount, 0);
  assert.doesNotMatch(JSON.stringify(reflection), /employeeId|sessionToken|Authorization|filename|digest/i);
  assert.deepEqual(pkg.groups.map((group) => [group.key, group.category, group.readyCount, group.totalCount]), [
    ["PL_PACKAGE", "LOCAL_PACKAGE_SECTION_READY", 2, 2],
    ["STORE_PACKAGE", "LOCAL_PACKAGE_SECTION_READY", 5, 5],
    ["BS_PACKAGE", "LOCAL_PACKAGE_SECTION_INCOMPLETE", 0, 1],
  ]);
  assert.deepEqual(pkg.groups.find((group) => group.key === "BS_PACKAGE").pendingKeys, ["BALANCE_SHEET"]);
  assert.doesNotMatch(JSON.stringify(pkg), /employeeId|sessionToken|Authorization|filename|digest/i);
  const requestMessage = buildFinancialAccountingRequestMessage({
    statement: "PL",
    status: "PL_LOCAL_READY",
    sheetCount: 3,
    missingByAccount: {},
    localStoreCsvReceipt: storeReceipt,
    localSupplementalReceipt: supplementalReceipt,
  });
  assert.equal(requestMessage.schemaVersion, "management-financial-accounting-request-message-v1");
  assert.equal(requestMessage.category, "ACCOUNTING_SOURCE_REQUEST");
  assert.match(requestMessage.subject, /B\/S年間データ/u);
  assert.match(requestMessage.bodyLines.join("\n"), /資産合計 \/ 負債合計 \/ 純資産合計/u);
  assert.equal(requestMessage.externalSendEnabled, false);
  assert.equal(requestMessage.productionImportEnabled, false);
  assert.equal(requestMessage.mutationCount, 0);
  assert.equal(requestMessage.uploadCount, 0);
  assert.doesNotMatch(JSON.stringify(requestMessage), /employeeId|sessionToken|Authorization|filename|digest/i);
  const requestImpact = buildFinancialAccountingRequestImpact({
    statement: "PL",
    status: "PL_LOCAL_READY",
    sheetCount: 3,
    missingByAccount: {},
    localStoreCsvReceipt: storeReceipt,
    localSupplementalReceipt: supplementalReceipt,
  });
  assert.equal(requestImpact.schemaVersion, "management-financial-accounting-request-impact-v1");
  assert.equal(requestImpact.category, "NEXT_PROVIDE_BALANCE_SHEET");
  assert.deepEqual(requestImpact.targetLabels, ["B/S", "貸借一致チェック", "法人/部門候補の一意性"]);
  assert.equal(requestImpact.productionImportEnabled, false);
  assert.equal(requestImpact.mutationCount, 0);
  assert.equal(requestImpact.uploadCount, 0);
  assert.doesNotMatch(JSON.stringify(requestImpact), /employeeId|sessionToken|Authorization|filename|digest/i);
  const requestText = buildFinancialAccountingRequestText({
    statement: "PL",
    status: "PL_LOCAL_READY",
    sheetCount: 3,
    missingByAccount: {},
    localStoreCsvReceipt: storeReceipt,
    localSupplementalReceipt: supplementalReceipt,
  });
  assert.equal(requestText.fileName, "management-financial-accounting-request.txt");
  assert.match(requestText.text, /件名: 経営管理システム: B\/S年間データの確認依頼/u);
  assert.match(requestText.href, /^data:text\/plain;charset=utf-8,/u);
  assert.equal(requestText.externalSendEnabled, false);
  assert.equal(requestText.productionImportEnabled, false);
  assert.doesNotMatch(JSON.stringify(requestText), /employeeId|sessionToken|Authorization|contentIdentity|rawFile/i);
  const bsOnly = buildFinancialSubmissionPackage({
    statement: "BS",
    status: "BS_LOCAL_READY",
    sheetCount: 1,
    missingByAccount: {},
    balanceCheck: "BALANCED",
    localStoreCsvReceipt: storeReceipt,
    localSupplementalReceipt: supplementalReceipt,
  });
  assert.equal(bsOnly.category, "LOCAL_PACKAGE_INCOMPLETE");
  assert.equal(bsOnly.nextAction.category, "NEXT_CONFIRM_PL_MAPPING");
  assert.deepEqual(bsOnly.nextAction.checklist, ["弥生会計科目", "正規科目", "対象シート数", "確認済み/否認"]);
  assert.equal(bsOnly.productionImportEnabled, false);
});

test("financial intake accepts external store CSV evidence without enabling production import", () => {
  const createElement = (tagName) => ({ tagName, textContent: "", className: "", href: "", download: "", type: "", accept: "", disabled: false, readOnly: false, multiple: false, hidden: false, value: "", dataset: {}, attributes: {}, children: [], listeners: {}, append(...children) { this.children.push(...children); }, replaceChildren(...children) { this.children = children; }, setAttribute(name, value) { this.attributes[name] = value; }, removeAttribute(name) { delete this.attributes[name]; }, addEventListener(name, listener) { this.listeners[name] = listener; } });
  const doc = { createElement };
  const container = { dataset: {}, ownerDocument: doc, children: [], replaceChildren(...children) { this.children = children; }, querySelector(selector) {
    const key = selector.match(/\[data-([^\]]+)\]/)?.[1]?.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    const walk = (node) => {
      if (key && node?.dataset && Object.hasOwn(node.dataset, key)) return node;
      for (const child of node?.children || []) {
        const found = walk(child);
        if (found) return found;
      }
      return null;
    };
    return walk(this);
  } };
  assert.equal(renderFinancialDataIntake(container, { document: doc }), true);
  assert.equal(typeof container.managementApplyFinancialExternalEvidence, "function");
  container.managementApplyFinancialExternalEvidence({
    localStoreCsvReceipt: {
      schemaVersion: "management-store-csv-local-validation-v1",
      status: "LOCAL_FILES_READY",
      files: [
        { kind: "STORE_MONTHLY_SALES", category: "VALID", rowCount: 1 },
        { kind: "STORE_DAILY_SALES", category: "VALID", rowCount: 1 },
        { kind: "STORE_RESERVATIONS", category: "VALID", rowCount: 1 },
      ],
    },
  });
  const list = container.querySelector("[data-financial-completion-list]");
  const sales = list.children.find((item) => item.dataset.financialCompletionCategory === "SALES_SUBLEDGER");
  assert.equal(sales.dataset.financialCompletionStatus, "LOCAL_EVIDENCE_RECEIVED");
  assert.equal(container.dataset.financialIntakeMounted, "true");
  assert.doesNotMatch(JSON.stringify(container), /upload|DB_INSERT|employeeId|sessionToken/i);
});

test("financial file collection enforces count and total-size limits before parsing", async () => {
  const tooMany = Array.from({ length: 13 }, (_, index) => ({
    name: `financial-${index}.xlsx`,
    size: 1,
    async arrayBuffer() { throw new Error("must not read"); },
  }));
  const countResult = await validateFinancialWorkbookFiles(tooMany, "PL", { inflateRaw });
  assert.equal(countResult.status, "FILE_COUNT_INVALID");
  const tooLarge = Array.from({ length: 5 }, (_, index) => ({
    name: `financial-large-${index}.xlsx`,
    size: 21 * 1024 * 1024,
    async arrayBuffer() { throw new Error("must not read"); },
  }));
  const sizeResult = await validateFinancialWorkbookFiles(tooLarge, "BS", { inflateRaw });
  assert.equal(sizeResult.status, "FILE_TOTAL_SIZE_INVALID");
  const typeResult = await validateFinancialWorkbookFiles([{
    name: "financial.csv",
    size: 10,
    async arrayBuffer() { throw new Error("must not read"); },
  }], "PL", { inflateRaw });
  assert.equal(typeResult.status, "FILE_TYPE_INVALID");
});

test("P/L mapping review exports only fixed accounting confirmation fields", () => {
  const result = {
    statement: "PL",
    missingByAccount: { "地代家賃": 104, "販売管理費合計": 104 },
    mappingCandidatesByAccount: {
      "地代家賃": { sourceAccount: "賃借料", sheetCount: 104 },
      "販売管理費合計": { sourceAccount: "販売管理費計", sheetCount: 104 },
    },
  };
  assert.deepEqual(buildFinancialMappingReviewRows(result), [
    { sourceAccount: "賃借料", canonicalAccount: "地代家賃", sheetCount: 104, status: "ACCOUNTING_CONFIRMATION_PENDING", statusLabel: "経理確認待ち" },
    { sourceAccount: "販売管理費計", canonicalAccount: "販売管理費合計", sheetCount: 104, status: "ACCOUNTING_CONFIRMATION_PENDING", statusLabel: "経理確認待ち" },
  ]);
  const exportFile = buildFinancialMappingReviewCsv(result);
  assert.equal(exportFile.rowCount, 2);
  assert.equal(exportFile.fileName, "management-pl-account-mapping-review.csv");
  assert.match(exportFile.csv, /^\uFEFF"弥生会計科目","正規科目","対象シート数","確認状態"/u);
  assert.match(exportFile.csv, /"賃借料","地代家賃","104","経理確認待ち"/u);
  assert.doesNotMatch(exportFile.csv, /(金額|原本|ファイル名|employeeId|sessionToken|Authorization)/iu);
});

test("mapping review fails closed for unknown or incomplete candidates", () => {
  const unknown = {
    statement: "PL",
    missingByAccount: { "地代家賃": 2 },
    mappingCandidatesByAccount: { "地代家賃": { sourceAccount: "任意科目", sheetCount: 2 } },
  };
  const countMismatch = {
    statement: "PL",
    missingByAccount: { "地代家賃": 2 },
    mappingCandidatesByAccount: { "地代家賃": { sourceAccount: "賃借料", sheetCount: 1 } },
  };
  assert.deepEqual(buildFinancialMappingReviewRows(unknown), []);
  assert.equal(buildFinancialMappingReviewCsv(unknown), null);
  assert.deepEqual(buildFinancialMappingReviewRows(countMismatch), []);
  assert.equal(buildFinancialMappingReviewCsv(countMismatch), null);
});

test("returned accounting mapping CSV is exact, local-only evidence", () => {
  const result = {
    statement: "PL",
    missingByAccount: { "地代家賃": 104, "販売管理費合計": 104 },
    mappingCandidatesByAccount: {
      "地代家賃": { sourceAccount: "賃借料", sheetCount: 104 },
      "販売管理費合計": { sourceAccount: "販売管理費計", sheetCount: 104 },
    },
  };
  const header = '"弥生会計科目","正規科目","対象シート数","確認状態"';
  const accepted = `${header}\r\n"賃借料","地代家賃","104","確認済み"\r\n"販売管理費計","販売管理費合計","104","確認済み"\r\n`;
  assert.deepEqual(validateFinancialMappingConfirmationCsv(accepted, result), {
    status: "MAPPING_CONFIRMATION_LOCAL_EVIDENCE",
    confirmedCount: 2,
    rejectedCount: 0,
  });
  const rejected = accepted.replace('"販売管理費計","販売管理費合計","104","確認済み"', '"販売管理費計","販売管理費合計","104","否認"');
  assert.deepEqual(validateFinancialMappingConfirmationCsv(rejected, result), {
    status: "MAPPING_CONFIRMATION_REJECTED",
    confirmedCount: 1,
    rejectedCount: 1,
  });
});

test("returned mapping CSV rejects row, count, header, status and candidate drift", () => {
  const result = {
    statement: "PL",
    missingByAccount: { "地代家賃": 2 },
    mappingCandidatesByAccount: { "地代家賃": { sourceAccount: "賃借料", sheetCount: 2 } },
  };
  const valid = '"弥生会計科目","正規科目","対象シート数","確認状態"\n"賃借料","地代家賃","2","確認済み"\n';
  for (const invalid of [
    valid.replace("対象シート数", "件数"),
    valid.replace('"2"', '"3"'),
    valid.replace("確認済み", "承認"),
    valid.replace("賃借料", "任意科目"),
    `${valid}"賃借料","地代家賃","2","確認済み"\n`,
  ]) {
    assert.notEqual(validateFinancialMappingConfirmationCsv(invalid, result).status, "MAPPING_CONFIRMATION_LOCAL_EVIDENCE");
  }
  assert.equal(validateFinancialMappingConfirmationCsv(valid.replace(/\n/u, "\n\"extra\"\n"), result).status, "MAPPING_CONFIRMATION_FORMAT_INVALID");
});

test("mapping confirmation file enforces CSV, UTF-8 and 64KB boundary", async () => {
  const result = {
    statement: "PL",
    missingByAccount: { "地代家賃": 1 },
    mappingCandidatesByAccount: { "地代家賃": { sourceAccount: "賃借料", sheetCount: 1 } },
  };
  const csv = '\uFEFF"弥生会計科目","正規科目","対象シート数","確認状態"\r\n"賃借料","地代家賃","1","確認済み"\r\n';
  const bytes = Buffer.from(csv, "utf8");
  assert.equal((await validateFinancialMappingConfirmationFile({
    name: "mapping.csv", size: bytes.length, async arrayBuffer() { return bytes; },
  }, result)).status, "MAPPING_CONFIRMATION_LOCAL_EVIDENCE");
  assert.equal((await validateFinancialMappingConfirmationFile({
    name: "mapping.txt", size: 10, async arrayBuffer() { throw new Error("must not read"); },
  }, result)).status, "MAPPING_CONFIRMATION_FILE_INVALID");
  assert.equal((await validateFinancialMappingConfirmationFile({
    name: "mapping.csv", size: 65537, async arrayBuffer() { throw new Error("must not read"); },
  }, result)).status, "MAPPING_CONFIRMATION_FILE_INVALID");
  assert.equal((await validateFinancialMappingConfirmationFile({
    name: "mapping.csv", size: 2, async arrayBuffer() { return Uint8Array.from([0xc3, 0x28]); },
  }, result)).status, "MAPPING_CONFIRMATION_FILE_INVALID");
});

test("P/L local preview combines current files without enabling production import", async () => {
  const first = await parseFinancialWorkbookBuffer(workbook([
    row(1, ["帳票名：残高試算表(年間推移)"]),
    row(5, ["集計期間：令和07年09月01日", "令和08年08月31日", "決算仕訳を含む"]),
    row(8, ["勘定科目", ...months]),
    ...requiredPl.map((account, index) => row(9 + index, [account, ...months.map(() => index === 0 ? 10000 : 100)])),
  ], "損･BASSA所沢店"), "PL", { inflateRaw });
  const second = await parseFinancialWorkbookBuffer(workbook([
    row(1, ["帳票名：残高試算表(年間推移)"]),
    row(5, ["集計期間：令和07年09月01日", "令和08年08月31日", "決算仕訳を含む"]),
    row(8, ["勘定科目", ...months]),
    ...requiredPl.map((account, index) => row(9 + index, [account, ...months.map(() => index === 0 ? 20000 : 200)])),
  ], "損･KYARA HALF"), "PL", { inflateRaw });
  const combined = combineFinancialWorkbookResults([first, second], "PL");
  assert.equal(combined.status, "PL_LOCAL_READY");
  assert.equal(combined.entityCandidateCount, 2);
  const preview = buildFinancialLocalPreview(combined);
  assert.equal(preview.salesManYen, 36);
  assert.equal(preview.importActionEnabled, false);
  assert.deepEqual(preview.rows.map((item) => item.entityName), ["損･BASSA所沢店", "損･KYARA HALF"]);
});

test("P/L duplicate workbook bytes fail closed without exposing the content identity", async () => {
  const bytes = workbook([
    row(1, ["帳票名：残高試算表(年間推移)"]),
    row(5, ["集計期間：令和07年09月01日", "令和08年08月31日", "決算仕訳を含む"]),
    row(8, ["勘定科目", ...months]),
    ...requiredPl.map((account, index) => row(9 + index, [account, ...months.map(() => index === 0 ? 10000 : 100)])),
  ], "損･BASSA所沢店");
  const result = await validateFinancialWorkbookFiles([
    workbookFile("period13-a.xlsx", bytes),
    workbookFile("period13-copy.xlsx", bytes),
  ], "PL", { inflateRaw });
  assert.equal(result.status, "PL_DUPLICATE_FILE_DETECTED");
  assert.equal(result.duplicateFileCount, 1);
  const preview = buildFinancialLocalPreview(result);
  assert.equal(preview.salesManYen, null);
  assert.equal(preview.ordinaryProfitManYen, null);
  assert.deepEqual(preview.rows, []);
  assert.deepEqual(preview.periodComparisonRows, []);
  assert.equal(preview.importActionEnabled, false);
  assert.equal(buildFinancialMappingReviewCsv(result), null);
  assert.doesNotMatch(JSON.stringify({ result, preview }), /(?:contentIdentity|\b[a-f0-9]{64}\b)/i);
});

test("P/L distinct files for the same period and entity fail closed", async () => {
  const makeBytes = (sales) => workbook([
    row(1, ["帳票名：残高試算表(年間推移)"]),
    row(5, ["集計期間：令和07年09月01日", "令和08年08月31日", "決算仕訳を含む"]),
    row(8, ["勘定科目", ...months]),
    ...requiredPl.map((account, index) => row(9 + index, [account, ...months.map(() => index === 0 ? sales : 100)])),
  ], "損･BASSA所沢店");
  const result = await validateFinancialWorkbookFiles([
    workbookFile("period13-a.xlsx", makeBytes(10000)),
    workbookFile("period13-revised.xlsx", makeBytes(10001)),
  ], "PL", { inflateRaw });
  assert.equal(result.status, "PL_DUPLICATE_ENTITY_PERIOD_DETECTED");
  assert.equal(result.duplicateFileCount, 0);
  assert.equal(result.duplicateEntityPeriodCount, 1);
  const preview = buildFinancialLocalPreview(result);
  assert.equal(preview.status, "PL_DUPLICATE_ENTITY_PERIOD_DETECTED");
  assert.equal(preview.entityCandidateCount, 0);
  assert.equal(preview.salesManYen, null);
  assert.deepEqual(preview.rows, []);
  assert.equal(preview.importActionEnabled, false);
});

test("P/L local preview selects the latest fiscal period and does not add prior years", async () => {
  const makePeriodWorkbook = (startYear, endYear, amount) => workbook([
    row(1, ["帳票名：残高試算表(年間推移)"]),
    row(5, [`集計期間：令和${startYear}年09月01日`, `令和${endYear}年08月31日`, "決算仕訳を含む"]),
    row(8, ["勘定科目", ...months]),
    ...requiredPl.map((account, index) => row(9 + index, [account, ...months.map(() => index === 0 ? amount : 100)])),
  ], "損･BASSA所沢店");
  const period11 = await parseFinancialWorkbookBuffer(makePeriodWorkbook("05", "06", 10000), "PL", { inflateRaw });
  const period12 = await parseFinancialWorkbookBuffer(makePeriodWorkbook("06", "07", 20000), "PL", { inflateRaw });
  const period13 = await parseFinancialWorkbookBuffer(makePeriodWorkbook("07", "08", 30000), "PL", { inflateRaw });
  const preview = buildFinancialLocalPreview(combineFinancialWorkbookResults([period13, period12, period11], "PL"));
  assert.equal(preview.selectedPeriodLabel, "2025年9月〜2026年8月");
  assert.equal(preview.availablePeriodCount, 3);
  assert.equal(preview.selectedPeriodSheetCount, 1);
  assert.equal(preview.historicalPeriodExcludedSheetCount, 2);
  assert.equal(preview.salesManYen, 36);
  assert.equal(preview.normalizedRecordCount, 144);
  assert.equal(preview.totalNormalizedRecordCount, 432);
  assert.equal(preview.importActionEnabled, false);
  assert.deepEqual(preview.periodComparisonRows.map((item) => ({
    periodLabel: item.periodLabel,
    storeCandidateCount: item.storeCandidateCount,
    salesManYen: item.salesManYen,
  })), [
    { periodLabel: "2025年9月〜2026年8月", storeCandidateCount: 1, salesManYen: 36 },
    { periodLabel: "2024年9月〜2025年8月", storeCandidateCount: 1, salesManYen: 24 },
    { periodLabel: "2023年9月〜2024年8月", storeCandidateCount: 1, salesManYen: 12 },
  ]);
});

test("P/L period comparison uses the latest data-month candidate as the common YTD cutoff", async () => {
  const makeYtdWorkbook = (startYear, endYear, activeMonths, salesAmount, profitAmount) => workbook([
    row(1, ["帳票名：残高試算表(年間推移)"]),
    row(5, [`集計期間：令和${startYear}年09月01日`, `令和${endYear}年08月31日`, "決算仕訳を含む"]),
    row(8, ["勘定科目", ...months]),
    ...requiredPl.map((account, index) => row(9 + index, [account, ...months.map((_, month) => {
      if (month >= activeMonths) return 0;
      if (account === "売上高合計") return salesAmount;
      if (account === "経常損益金額") return profitAmount;
      return 100;
    })])),
  ], "損･BASSA所沢店");
  const current = await parseFinancialWorkbookBuffer(makeYtdWorkbook("07", "08", 9, 10000, 2000), "PL", { inflateRaw });
  const prior = await parseFinancialWorkbookBuffer(makeYtdWorkbook("06", "07", 12, 20000, 3000), "PL", { inflateRaw });
  const preview = buildFinancialLocalPreview(combineFinancialWorkbookResults([prior, current], "PL"));
  assert.equal(preview.comparisonMonthCount, 9);
  assert.equal(preview.comparisonRangeLabel, "9月度〜5月度（9か月・データ存在月候補）");
  assert.equal(preview.rows[0].dataThroughMonthLabel, "5月度");
  assert.equal(preview.rows[0].activeMonthCount, 9);
  assert.equal(preview.salesManYen, 9);
  assert.deepEqual(preview.periodComparisonRows.map((item) => ({
    periodLabel: item.periodLabel,
    comparisonMonthCount: item.comparisonMonthCount,
    salesManYen: item.salesManYen,
    dataMonthShortfallCount: item.dataMonthShortfallCount,
  })), [
    { periodLabel: "2025年9月〜2026年8月", comparisonMonthCount: 9, salesManYen: 9, dataMonthShortfallCount: 0 },
    { periodLabel: "2024年9月〜2025年8月", comparisonMonthCount: 9, salesManYen: 18, dataMonthShortfallCount: 0 },
  ]);
  assert.equal(preview.importActionEnabled, false);
});

test("P/L mapping candidates are applied only to the local preview and remain unapproved", async () => {
  const accounts = [...requiredPl.filter((account) => account !== "地代家賃" && account !== "販売管理費合計"), "賃借料", "販売管理費計"];
  const result = await parseFinancialWorkbookBuffer(workbook([
    row(1, ["帳票名：残高試算表(年間推移)"]),
    row(5, ["集計期間：令和07年09月01日", "令和08年08月31日", "決算仕訳を含む"]),
    row(8, ["勘定科目", ...months]),
    ...accounts.map((account, index) => row(9 + index, [account, ...months.map(() => index === 0 ? 10000 : 100)])),
  ], "損･BASSA所沢店"), "PL", { inflateRaw });
  const preview = buildFinancialLocalPreview(result);
  assert.equal(preview.rows[0].mappingStatus, "LOCAL_CANDIDATE_APPLIED");
  assert.equal(preview.rows[0].mappingCandidateCount, 2);
  assert.equal(preview.mappingRequiredAccountCount, 2);
  assert.equal(preview.mappingCandidateAccountCount, 2);
  assert.equal(preview.importActionEnabled, false);
  const confirmedResult = {
    ...result,
    localMappingConfirmation: {
      status: "MAPPING_CONFIRMATION_LOCAL_EVIDENCE",
      confirmedCount: 2,
      rejectedCount: 0,
    },
  };
  const confirmedPreview = buildFinancialLocalPreview(confirmedResult);
  assert.equal(confirmedPreview.mappingConfirmationStatus, "LOCAL_EVIDENCE_RECEIVED");
  assert.equal(confirmedPreview.rows[0].mappingStatus, "LOCAL_EVIDENCE_RECEIVED");
  assert.equal(confirmedPreview.periodComparisonRows[0].mappingStatus, "LOCAL_EVIDENCE_RECEIVED");
  assert.equal(confirmedPreview.mappingRequiredAccountCount, 2);
  assert.equal(confirmedPreview.importActionEnabled, false);
  assert.equal(buildFinancialCompletionItems(confirmedResult).find((item) => item.key === "PL_ACCOUNT_MAPPING").status, "LOCAL_EVIDENCE_RECEIVED");
  assert.doesNotMatch(buildFinancialCompletionRequestCsv(confirmedResult).csv, /PL_ACCOUNT_MAPPING/u);
  const forgedPreview = buildFinancialLocalPreview({
    ...result,
    localMappingConfirmation: { status: "MAPPING_CONFIRMATION_LOCAL_EVIDENCE", confirmedCount: 1, rejectedCount: 0 },
  });
  assert.equal(forgedPreview.mappingConfirmationStatus, "PENDING");
  assert.equal(forgedPreview.rows[0].mappingStatus, "LOCAL_CANDIDATE_APPLIED");
});

test("P/L local preview keeps head-office and FC sheets out of store operations", async () => {
  const makeRows = (amount) => [
    row(1, ["蟶ｳ逾ｨ蜷搾ｼ壽ｮ矩ｫ倩ｩｦ邂苓｡ｨ(蟷ｴ髢捺耳遘ｻ)"]),
    row(5, ["髮・ｨ域悄髢難ｼ壻ｻ､蜥・7蟷ｴ09譛・1譌･", "莉､蜥・8蟷ｴ08譛・1譌･", "豎ｺ邂嶺ｻ戊ｨｳ繧貞性繧"]),
    row(8, ["蜍伜ｮ夂ｧ醍岼", ...months]),
    ...requiredPl.map((account, index) => row(9 + index, [account, ...months.map(() => index === 0 ? amount : 100)])),
  ];
  const store = await parseFinancialWorkbookBuffer(workbook(makeRows(10000), "損･BASSA保谷店"), "PL", { inflateRaw });
  const headOffice = await parseFinancialWorkbookBuffer(workbook(makeRows(20000), "損･本部･経理"), "PL", { inflateRaw });
  const fc = await parseFinancialWorkbookBuffer(workbook(makeRows(30000), "損･FC久米川"), "PL", { inflateRaw });
  const preview = buildFinancialLocalPreview(combineFinancialWorkbookResults([store, headOffice, fc], "PL"));
  assert.equal(preview.entityCandidateCount, 1);
  assert.equal(preview.reviewCandidateCount, 2);
  assert.deepEqual(preview.rows.map((item) => item.entityName), ["損･BASSA保谷店"]);
  assert.deepEqual(preview.reviewRows.map((item) => item.entityCategory), ["NON_STORE_REVIEW_REQUIRED", "FC_REVIEW_REQUIRED"]);
});

test("B/S intake requires exact balanced assets, liabilities, and equity", async () => {
  const balanced = workbook([
    row(1, ["帳票名：残高試算表(年間推移)"]),
    row(5, ["集計期間：令和07年09月01日", "令和08年08月31日"]),
    row(8, ["勘定科目", ...months]),
    row(9, ["資産合計", ...months.map(() => 1_000_000)]),
    row(10, ["負債合計", ...months.map(() => 400_000)]),
    row(11, ["純資産合計", ...months.map(() => 600_000)]),
  ]);
  const ok = await parseFinancialWorkbookBuffer(balanced, "BS", { inflateRaw });
  assert.equal(ok.status, "BS_LOCAL_READY");
  assert.equal(ok.balanceCheck, "BALANCED");
  const preview = buildFinancialLocalPreview(ok);
  assert.equal(preview.statement, "BS");
  assert.equal(preview.balancedEntityCount, 1);
  assert.equal(preview.rows[0].assetsManYen, 100);
  assert.equal(preview.rows[0].liabilitiesManYen, 40);
  assert.equal(preview.rows[0].equityManYen, 60);
  assert.equal(preview.rows[0].balanceDeltaManYen, 0);
  assert.equal(preview.rows[0].balanceStatus, "BALANCED");
  assert.equal(preview.balanceReviewRequiredCount, 0);
  assert.equal(preview.maxAbsBalanceDeltaManYen, 0);
  assert.equal(preview.balanceReadinessCategory, "BS_BALANCE_READY");
  assert.equal(preview.importActionEnabled, false);
  const imbalanced = workbook([
    row(1, ["帳票名：残高試算表(年間推移)"]),
    row(5, ["集計期間：令和07年09月01日", "令和08年08月31日"]),
    row(8, ["勘定科目", ...months]),
    row(9, ["資産合計", ...months.map(() => 1_010_000)]),
    row(10, ["負債合計", ...months.map(() => 400_000)]),
    row(11, ["純資産合計", ...months.map(() => 600_000)]),
  ]);
  const ng = await parseFinancialWorkbookBuffer(imbalanced, "BS", { inflateRaw });
  assert.equal(ng.status, "BS_BALANCE_CHECK_FAILED");
  assert.equal(ng.balanceCheck, "IMBALANCED");
  const ngPreview = buildFinancialLocalPreview(ng);
  assert.equal(ngPreview.balancedEntityCount, 0);
  assert.equal(ngPreview.balanceReviewRequiredCount, 1);
  assert.equal(ngPreview.maxAbsBalanceDeltaManYen, 1);
  assert.equal(ngPreview.rows[0].balanceDeltaManYen, 1);
  assert.equal(ngPreview.balanceReadinessCategory, "BS_BALANCE_REVIEW_REQUIRED");
  const reviewRows = buildFinancialBalanceReviewRows(ng);
  assert.deepEqual(reviewRows, [{
    entityName: "損･BASSA新所沢店",
    periodLabel: "2025年9月〜2026年8月",
    closingMonthLabel: "8月度",
    balanceDeltaManYen: 1,
    statusLabel: "貸借確認待ち",
  }]);
  const reviewCsv = buildFinancialBalanceReviewCsv(ng);
  assert.equal(reviewCsv.fileName, "management-bs-balance-review.csv");
  assert.equal(reviewCsv.rowCount, 1);
  assert.equal(reviewCsv.status, "BS_BALANCE_REVIEW_REQUIRED");
  assert.match(reviewCsv.csv, /"法人候補","対象期","最終月","貸借差額万円","確認状態"/u);
  assert.match(reviewCsv.csv, /"貸借確認待ち"/u);
  assert.equal(reviewCsv.productionImportEnabled, false);
  assert.equal(reviewCsv.externalSendEnabled, false);
  assert.doesNotMatch(JSON.stringify(reviewCsv), /contentIdentity|rawFile|sessionToken|Authorization/i);
});

test("B/S duplicate workbook bytes suppress all balance amounts", async () => {
  const balanced = workbook([
    row(1, ["帳票名：残高試算表(年間推移)"]),
    row(5, ["集計期間：令和07年09月01日", "令和08年08月31日"]),
    row(8, ["勘定科目", ...months]),
    row(9, ["資産合計", ...months.map(() => 1_000_000)]),
    row(10, ["負債合計", ...months.map(() => 400_000)]),
    row(11, ["純資産合計", ...months.map(() => 600_000)]),
  ], "貸･IDEA NOV");
  const result = await validateFinancialWorkbookFiles([
    workbookFile("balance-a.xlsx", balanced),
    workbookFile("balance-copy.xlsx", balanced),
  ], "BS", { inflateRaw });
  assert.equal(result.status, "BS_DUPLICATE_FILE_DETECTED");
  const preview = buildFinancialLocalPreview(result);
  assert.equal(preview.balanceCheck, "NOT_READY");
  assert.equal(preview.balancedEntityCount, 0);
  assert.deepEqual(preview.rows, []);
  assert.equal(buildFinancialBalanceReviewCsv(result), null);
  assert.equal(preview.importActionEnabled, false);
});

test("Management app integrates financial data intake without runtime upload", () => {
  assert.match(html, /id="financial-data-intake"/);
  assert.match(html, /id="financial-local-preview-overview"/);
  assert.match(html, /id="financial-local-preview-four-axis"/);
  assert.match(html, /id="financial-local-preview-departments"/);
  assert.match(html, /id="financial-local-preview-stores"/);
  assert.match(html, /data-section-status="corporate">未反映/);
  assert.match(html, /data-section-status="stores">未反映/);
  assert.match(app, /financial-data-intake\.js\?v=57414b04339de19e/);
  assert.match(financialIntake, /financial-supplemental-csv\.js\?v=7cacd43781126450/);
  assert.match(financialIntake, /renderFinancialSupplementalCsv\(supplemental/);
  assert.match(app, /renderFinancialDataIntake\(elements\.financialDataIntake, \{ externalEvidence: financialExternalEvidence\(\) \}\)/);
  assert.match(app, /management-financial-local-preview/);
  assert.match(app, /updateSectionDataBadges/);
  assert.match(app, /LOCAL_PREVIEW_ACTIVE/);
  assert.match(app, /financialPendingCount/);
  assert.match(app, /不足\$\{financialPendingCount\(\)\}件/);
  assert.match(app, /renderFinancialPreviewOverview/);
  assert.match(app, /renderFinancialPreviewFourAxis/);
  assert.match(app, /renderFinancialPreviewDepartments/);
  assert.match(app, /renderFinancialPreviewStores/);
  assert.match(app, /localPlStoreSummary/);
  assert.match(app, /localPlStoreMatchSummary/);
  assert.match(app, /buildFinancialStoreMatchAction/);
  assert.match(app, /localPlStoreRowsByNormalizedName/);
  assert.match(app, /normalizeStoreCandidateName/);
  assert.match(app, /P\/L \$\{number\.format\(localPl\.storeCandidateCount\)\}候補/);
  assert.match(app, /P\/L照合/);
  assert.match(app, /P\/L候補未照合/);
  assert.match(app, /店舗名対応表を確認/);
  assert.match(app, /店舗名対応表を確認するまで、本番投入は無効です/);
  assert.match(app, /P\/L損益/);
  assert.match(app, /ローカルP\/L候補（本番未投入）/);
  assert.match(app, /buildFinancialLocalReflectionStatus/);
  assert.match(app, /ローカル反映済み/);
  assert.match(app, /本番DB保存・本番投入・承認操作は無効です/);
  assert.match(app, /buildFinancialVisibleScope/);
  assert.match(app, /表示中/);
  assert.match(app, /未反映/);
  assert.match(app, /STORE_CANDIDATE/);
  assert.match(app, /buildBsOverviewPreview/);
  assert.match(app, /ローカルB\/Sプレビュー（本番未投入）/);
  assert.match(app, /貸借差額/);
  assert.match(app, /bsBalanceDeltaText/);
  assert.match(app, /最大貸借差額/);
  assert.match(app, /balanceReviewRequiredCount/);
  assert.match(financialIntake, /balanceReadinessCategory/);
  assert.match(financialIntake, /buildFinancialBalanceReviewCsv/);
  assert.match(financialIntake, /management-bs-balance-review\.csv/);
  assert.match(financialIntake, /B\/S貸借確認CSVを保存/);
  assert.match(app, /年度別P\/L比較（店舗候補のみ）/);
  assert.match(app, /年度別 店舗候補合計/);
  assert.match(app, /合計・本部・FC・共通シートは含みません/);
  assert.match(app, /データ月候補/);
  assert.match(app, /月不足/);
  assert.match(app, /重複ファイル/);
  assert.match(app, /PL_DUPLICATE_FILE_DETECTED/);
  assert.doesNotMatch(app, /\.\.\.value/);
  assert.match(app, /renderFinancialPreviewEmpty/);
  assert.match(app, /仮対応・経理確認前/);
  assert.match(app, /ローカル回答確認済み/);
  assert.match(app, /mappingConfirmationStatus/);
  assert.match(app, /過年度/);
  assert.match(app, /店舗候補売上合計/);
  assert.match(app, /4軸分析へのローカルP\/L補助値（本番未投入）/);
  assert.match(app, /部門別分析へのローカルP\/L候補（本番未投入）/);
  assert.match(app, /合計・共通・FC合計の二重計上は除外/);
  assert.match(app, /buildFinancialCompletionItems, renderFinancialDataIntake/);
  assert.match(app, /buildFinancialMissingDataSummary/);
  assert.match(app, /buildFinancialNextStep/);
  assert.match(app, /buildFinancialAccountingRequestNote/);
  assert.match(app, /本番反映までの不足データ/);
  assert.match(app, /次に必要/);
  assert.match(app, /経理確認:/);
  assert.match(app, /production catalog証跡 \/ provider runtime identity/);
  assert.match(styles, /\.financial-intake-panel/);
  assert.match(styles, /\.financial-intake-preview/);
  assert.match(styles, /\.financial-completion-list/);
  assert.match(styles, /\.financial-submission-package-grid/);
  assert.match(styles, /\.financial-submission-next-action/);
  assert.match(styles, /\.financial-submission-next-list/);
  assert.match(styles, /\.financial-accounting-request/);
  assert.match(styles, /\.financial-accounting-impact-list/);
  assert.match(styles, /\.financial-accounting-request-download/);
  assert.match(styles, /\.financial-completion-heading \{ align-items: stretch; flex-direction: column; \}/);
  assert.match(styles, /\.financial-completion-item \.financial-completion-spec/);
  assert.match(styles, /\.financial-missing-data-summary/);
  assert.match(styles, /\.financial-missing-data-list/);
  assert.match(styles, /\.financial-missing-data-next/);
  assert.match(styles, /\.financial-missing-data-next button/);
  assert.match(styles, /\.financial-missing-data-next \.financial-missing-data-request-note/);
  assert.match(financialIntake, /提出形式/);
  assert.match(financialIntake, /集計粒度/);
  assert.match(financialIntake, /候補完全一致・重複なし・確認済み\/否認/);
  assert.match(styles, /\.financial-mapping-review/);
  assert.match(financialIntake, /経理確認用CSVを保存/);
  assert.match(financialIntake, /不足資料CSVを保存/);
  assert.match(financialIntake, /management-financial-missing-data-request\.csv/);
  assert.match(financialIntake, /management-financial-submission-package-v1/);
  assert.match(financialIntake, /management-financial-reflection-summary-v1/);
  assert.match(financialIntake, /financial-reflection-summary/);
  assert.match(financialIntake, /financialReflectionSummary/);
  assert.match(financialIntake, /submissionPackageHeading/);
  assert.match(financialIntake, /accountingRequestSection/);
  assert.match(financialIntake, /dataset\.financialReflection/);
  assert.match(financialIntake, /確認表示はローカル検証結果だけです/);
  assert.match(styles, /\.financial-reflection-summary/);
  assert.match(styles, /data-financial-reflection="LOCAL_PREVIEW_ACTIVE"/);
  assert.match(styles, /data-financial-reflection="DISABLED_PENDING_CONTRACT"/);
  assert.match(styles, /\.financial-reflection-note/);
  assert.match(financialIntake, /management-financial-accounting-request-message-v1/);
  assert.match(financialIntake, /management-financial-accounting-request-impact-v1/);
  assert.match(financialIntake, /経理へ確認する内容/);
  assert.match(financialIntake, /確認依頼TXTを保存/);
  assert.match(financialIntake, /NEXT_PROVIDE_BALANCE_SHEET/);
  assert.match(financialIntake, /資産合計/);
  assert.match(financialIntake, /対象期・候補一意/);
  assert.match(financialIntake, /MAX_FINANCIAL_FILE_COUNT = 12/);
  assert.match(financialIntake, /MAX_FINANCIAL_TOTAL_BYTES = 100 \* 1024 \* 1024/);
  assert.match(financialIntake, /addEventListener\("drop"/);
  assert.match(financialIntake, /SOURCE_SYSTEM_UNSUPPORTED/);
  assert.match(financialIntake, /Excelから対象期を自動判定/);
  assert.match(styles, /\.financial-intake-drop\.is-dragover/);
  assert.match(financialIntake, /ACCOUNTING_CONFIRMATION_PENDING/);
  assert.match(financialIntake, /経理回答CSVを検証/);
  assert.match(financialIntake, /MAPPING_CONFIRMATION_LOCAL_EVIDENCE/);
  assert.match(financialIntake, /本番承認ではありません/);
  assert.match(styles, /\.financial-mapping-confirmation/);
  assert.match(financialIntake, /DUPLICATE_ENTITY_PERIOD_DETECTED/);
  assert.match(financialIntake, /sha256Identity/);
  assert.match(styles, /\.financial-local-preview-card/);
  assert.match(styles, /\.financial-local-preview-card\.is-empty/);
  assert.match(styles, /\.financial-local-reflection-status/);
  assert.match(styles, /\.financial-visible-scope/);
  assert.match(styles, /\.financial-visible-scope \{ grid-template-columns: 1fr; \}/);
  assert.match(styles, /\.financial-store-match-action/);
  assert.match(styles, /\.financial-store-match-action button/);
  assert.match(styles, /\.section-tab-status/);
  assert.match(styles, /data-section-status-category="LOCAL_PREVIEW_ACTIVE"/);
  assert.doesNotMatch(app, /financialDataIntake[\s\S]{0,240}(upload|importAction|mutation|storage)/i);
  assert.match(visualFixture, /PL_LOCAL_VALIDATED_PENDING_MAPPING/);
  assert.match(visualFixture, /financial-data-intake\.js/);
  assert.doesNotMatch(visualFixture, /(employeeId|sessionToken|Authorization)/i);
  assert.match(localPreviewFixture, /portal\/management-app\/index\.html#overview/);
  assert.match(localPreviewFixture, /management-financial-local-preview/);
  assert.match(localPreviewFixture, /LOCAL_CANDIDATE_APPLIED/);
  assert.match(localPreviewFixture, /BS_LOCAL_READY/);
  assert.match(localPreviewFixture, /balanceSheetPreview/);
  assert.match(localPreviewFixture, /periodComparisonRows/);
  assert.match(localPreviewFixture, /2023年9月〜2024年8月/);
  assert.match(localPreviewFixture, /9月度〜5月度（9か月・データ存在月候補）/);
  assert.match(localPreviewFixture, /historicalPeriodExcludedSheetCount: 66/);
  assert.doesNotMatch(localPreviewFixture, /fetch\(|callApiAction|localStorage|sessionStorage/);
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
    hidden: false,
    href: "",
    download: "",
    files: [],
    listeners: {},
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
    setAttribute(name, value) { this.attributes[name] = value; },
    removeAttribute(name) { delete this.attributes[name]; },
    addEventListener(name, listener) { this.listeners[name] = listener; },
  });
  const document = { createElement };
  const container = { dataset: {}, ownerDocument: document, children: [], replaceChildren(...children) { this.children = children; }, querySelector() { return null; } };
  assert.equal(renderFinancialDataIntake(container, { document }), true);
  const section = container.children[0];
  assert.equal(section.className, "financial-intake-panel");
  assert.equal(section.children[0].children[1].disabled, true);
  assert.equal(section.children[3].children[0].multiple, true);
  assert.equal(section.children[2].children[1].readOnly, true);
  assert.equal(section.children[2].children[2].disabled, true);
  assert.equal(section.children[2].children[3].children[1].value, "UNSUPPORTED");
  assert.ok(section.children[3].listeners.dragover);
  assert.ok(section.children[3].listeners.dragleave);
  assert.ok(section.children[3].listeners.drop);
  assert.equal(section.children[5].className, "financial-mapping-review");
  assert.equal(section.children[6].className, "financial-completion");
  assert.equal(section.children[7].className, "financial-submission-package");
  assert.equal(section.children[8].className, "financial-supplemental-host");
  assert.equal(section.children[8].dataset.productionImport, "DISABLED");
});
