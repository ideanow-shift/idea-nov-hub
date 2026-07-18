import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  SANITIZED_CSV_REQUIREMENTS,
  buildLocalValidationReceipt,
  buildCsvRequirementsView,
  renderCsvRequirements,
  validateCsvRequirements,
  validateLocalCsvFile,
  validateLocalCsvText,
} from "../portal/management-app/store-csv-requirements.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = fs.readFileSync(path.join(root, "portal/management-app/app-v2.js"), "utf8");
const html = fs.readFileSync(path.join(root, "portal/management-app/index.html"), "utf8");

test("accepted three-file contract exposes preparation fields only", () => {
  assert.equal(validateCsvRequirements(SANITIZED_CSV_REQUIREMENTS), true);
  const view = buildCsvRequirementsView(SANITIZED_CSV_REQUIREMENTS);
  assert.equal(view.status, "READY_FOR_FILE_PREPARATION");
  assert.equal(view.labels.length, 3);
  assert.equal(view.templates.length, 3);
  assert.deepEqual(view.labels, [
    "店舗別月次売上｜必要項目: 対象月・店舗・売上｜用途: 店舗KPI",
    "日次売上｜必要項目: 営業日・店舗・売上・客数・客単価｜用途: 日次進捗",
    "予約状況｜必要項目: 営業日・店舗・予約枠・予約数｜用途: 予約充足率",
  ]);
  assert.deepEqual(view.templates.map(({ filename }) => filename), [
    "store-monthly-sales-template.csv",
    "store-daily-sales-template.csv",
    "store-reservations-template.csv",
  ]);
  assert.deepEqual(view.templates.map(({ csv }) => csv), [
    '\uFEFF"対象月","店舗","売上"\r\n',
    '\uFEFF"営業日","店舗","売上","客数","客単価"\r\n',
    '\uFEFF"営業日","店舗","予約枠","予約数"\r\n',
  ]);
  view.templates.forEach((template) => {
    assert.equal(template.href.startsWith("data:text/csv;charset=utf-8,%EF%BB%BF"), true);
    assert.equal(decodeURIComponent(template.href.split(",")[1]), template.csv);
  });
});

test("unknown, missing, reordered, and wrong values fail closed", () => {
  const clone = () => SANITIZED_CSV_REQUIREMENTS.map((item) => ({ ...item }));
  assert.equal(validateCsvRequirements([]), false);
  assert.equal(validateCsvRequirements(clone().slice(0, 2)), false);
  assert.equal(validateCsvRequirements(clone().reverse()), false);
  assert.equal(validateCsvRequirements(clone().map((item, index) => index ? item : { ...item, rawId: "hidden" })), false);
  assert.equal(validateCsvRequirements(clone().map((item, index) => index ? item : { ...item, fields: "unknown" })), false);
  const invalid = buildCsvRequirementsView([{ name: "raw", fields: "private", purpose: "unknown" }]);
  assert.deepEqual(invalid, { status: "INVALID", summary: "CSV要件を安全に確認できません。取込は実行しません。", labels: [], templates: [] });
});

test("local validator accepts exact headers and returns sanitized counts only", () => {
  assert.deepEqual(validateLocalCsvText(0, '\uFEFF"対象月","店舗","売上"\r\n"2026-07","店舗A","100"\r\n'), { category: "VALID", valid: true, rowCount: 1 });
  assert.deepEqual(validateLocalCsvText(1, '営業日,店舗,売上,客数,客単価\n2026-07-01,"店舗,本店",100,2,50\n2026-07-02,店舗B,200,4,50\n'), { category: "VALID", valid: true, rowCount: 2 });
  assert.deepEqual(validateLocalCsvText(2, '"営業日","店舗","予約枠","予約数"\n"2026-07-01","店舗""A","10","5"\n'), { category: "VALID", valid: true, rowCount: 1 });
  const resultText = JSON.stringify(validateLocalCsvText(0, '対象月,店舗,売上\nprivate-value,private-store,100\n'));
  assert.doesNotMatch(resultText, /private/);
});

test("local validator fails closed for malformed and mismatched CSV", () => {
  assert.deepEqual(validateLocalCsvText(0, '\uFEFF"対象月","店舗","売上"\r\n'), { category: "NO_DATA_ROWS", valid: false, rowCount: 0 });
  assert.deepEqual(validateLocalCsvText(0, '店舗,対象月,売上\nA,2026-07,100\n'), { category: "HEADER_MISMATCH", valid: false, rowCount: 0 });
  assert.deepEqual(validateLocalCsvText(0, '対象月,店舗\n2026-07,A\n'), { category: "HEADER_MISMATCH", valid: false, rowCount: 0 });
  assert.deepEqual(validateLocalCsvText(0, '対象月,店舗,売上\n2026-07,A\n'), { category: "ROW_SHAPE_INVALID", valid: false, rowCount: 0 });
  assert.deepEqual(validateLocalCsvText(0, '対象月,店舗,売上\n"2026-07,A,100\n'), { category: "CSV_MALFORMED", valid: false, rowCount: 0 });
  assert.deepEqual(validateLocalCsvText(0, '対象月,店\uFFFD,売上\n2026-07,A,100\n'), { category: "CSV_MALFORMED", valid: false, rowCount: 0 });
  assert.deepEqual(validateLocalCsvText(3, 'anything'), { category: "REQUEST_INVALID", valid: false, rowCount: 0 });
});

test("semantic values and duplicate business keys fail closed", () => {
  assert.deepEqual(validateLocalCsvText(0, '対象月,店舗,売上\n2026-13,店舗A,100\n'), { category: "PERIOD_VALUE_INVALID", valid: false, rowCount: 0 });
  assert.deepEqual(validateLocalCsvText(1, '営業日,店舗,売上,客数,客単価\n2026-02-30,店舗A,100,2,50\n'), { category: "PERIOD_VALUE_INVALID", valid: false, rowCount: 0 });
  assert.deepEqual(validateLocalCsvText(0, '対象月,店舗,売上\n2026-07," 店舗A",100\n'), { category: "STORE_VALUE_INVALID", valid: false, rowCount: 0 });
  assert.deepEqual(validateLocalCsvText(0, '対象月,店舗,売上\n2026-07,店舗A,-1\n'), { category: "NUMBER_VALUE_INVALID", valid: false, rowCount: 0 });
  assert.deepEqual(validateLocalCsvText(1, '営業日,店舗,売上,客数,客単価\n2026-07-01,店舗A,100,1.5,50\n'), { category: "NUMBER_VALUE_INVALID", valid: false, rowCount: 0 });
  assert.deepEqual(validateLocalCsvText(2, '営業日,店舗,予約枠,予約数\n2026-07-01,店舗A,5,6\n'), { category: "RESERVATION_VALUE_INVALID", valid: false, rowCount: 0 });
  assert.deepEqual(validateLocalCsvText(0, '対象月,店舗,売上\n2026-07,店舗A,100\n2026-07,店舗A,200\n'), { category: "DUPLICATE_KEY", valid: false, rowCount: 0 });
});

test("file boundary enforces type, size, and read failure without raw output", async () => {
  const validFile = { name: "monthly.csv", size: 48, text: async () => '対象月,店舗,売上\n2026-07,店舗A,100\n' };
  assert.deepEqual(await validateLocalCsvFile(0, validFile), { category: "VALID", valid: true, rowCount: 1 });
  assert.deepEqual(await validateLocalCsvFile(0, { ...validFile, name: "monthly.txt" }), { category: "FILE_TYPE_INVALID", valid: false, rowCount: 0 });
  assert.deepEqual(await validateLocalCsvFile(0, { ...validFile, size: 5 * 1024 * 1024 + 1 }), { category: "FILE_TOO_LARGE", valid: false, rowCount: 0 });
  assert.deepEqual(await validateLocalCsvFile(0, { ...validFile, text: async () => { throw new Error("private read detail"); } }), { category: "READ_FAILED", valid: false, rowCount: 0 });
});

test("local receipt contains aggregate fixed fields only", () => {
  const receipt = buildLocalValidationReceipt([
    { category: "VALID", valid: true, rowCount: 12 },
    { category: "VALID", valid: true, rowCount: 31 },
    { category: "VALID", valid: true, rowCount: 31 },
  ]);
  assert.deepEqual(receipt, {
    schemaVersion: "management-store-csv-local-validation-v1",
    status: "LOCAL_FILES_READY",
    files: [
      { kind: "STORE_MONTHLY_SALES", category: "VALID", rowCount: 12 },
      { kind: "STORE_DAILY_SALES", category: "VALID", rowCount: 31 },
      { kind: "STORE_RESERVATIONS", category: "VALID", rowCount: 31 },
    ],
  });
  assert.doesNotMatch(JSON.stringify(receipt), /employee|staff|salary|storeName|fileName|digest|private/i);
  assert.equal(buildLocalValidationReceipt([receipt.files[0], receipt.files[1], receipt.files[2]]), null);
  assert.equal(buildLocalValidationReceipt([
    { category: "VALID", valid: true, rowCount: 1, rawValue: "private" },
    { category: "VALID", valid: true, rowCount: 1 },
    { category: "VALID", valid: true, rowCount: 1 },
  ]), null);
});

test("renderer exposes local download and validation without runtime action", async () => {
  const createElement = (tagName) => ({ tagName, textContent: "", className: "", href: "", download: "", type: "", accept: "", hidden: false, value: "", files: [], attributes: {}, listeners: {}, children: [], dataset: {}, append(...children) { this.children.push(...children); }, setAttribute(name, value) { this.attributes[name] = value; }, removeAttribute(name) { delete this.attributes[name]; if (name === "href") this.href = ""; }, addEventListener(name, listener) { this.listeners[name] = listener; } });
  const container = { dataset: {}, children: [], replaceChildren(...children) { this.children = children; } };
  assert.equal(renderCsvRequirements(container, SANITIZED_CSV_REQUIREMENTS, { createElement }), true);
  assert.equal(container.dataset.csvRequirementStatus, "READY_FOR_FILE_PREPARATION");
  assert.equal(container.dataset.csvLocalValidation, "ENABLED");
  assert.equal(container.children.length, 5);
  assert.equal(container.children[2].dataset.csvReady, "NOT_READY");
  assert.equal(container.children[2].textContent, "ローカル確認 0/3");
  assert.equal(container.children[3].dataset.csvReceipt, "NOT_READY");
  assert.equal(container.children[3].attributes["aria-disabled"], "true");
  assert.equal(container.children[3].href, "");
  assert.equal(container.children[4].children.length, 3);
  assert.deepEqual(container.children[4].children.map((item) => item.children[1].children[0].tagName), ["a", "a", "a"]);
  assert.deepEqual(container.children[4].children.map((item) => item.children[1].children[0].download), [
    "store-monthly-sales-template.csv",
    "store-daily-sales-template.csv",
    "store-reservations-template.csv",
  ]);
  assert.equal(container.children[4].children.every((item) => item.children[1].children[0].href.startsWith("data:text/csv")), true);
  const firstItem = container.children[4].children[0];
  const input = firstItem.children[1].children[1].children[0];
  const status = firstItem.children[2];
  input.files = [{ name: "private-name.csv", size: 48, text: async () => '対象月,店舗,売上\n2026-07,private-store,100\n' }];
  input.value = "private-path";
  await input.listeners.change({ currentTarget: input });
  assert.equal(status.dataset.csvValidation, "VALID");
  assert.equal(status.textContent, "ローカル確認OK: 1件");
  assert.equal(container.children[2].textContent, "ローカル確認 1/3");
  assert.equal(input.value, "");
  const visibleText = (node) => [node.textContent, ...(node.children || []).flatMap(visibleText)].join(" ");
  assert.doesNotMatch(visibleText(container), /private/);
  const remainingFiles = [
    { name: "daily.csv", size: 80, text: async () => '営業日,店舗,売上,客数,客単価\n2026-07-01,店舗A,100,2,50\n' },
    { name: "reservations.csv", size: 70, text: async () => '営業日,店舗,予約枠,予約数\n2026-07-01,店舗A,10,5\n' },
  ];
  for (let index = 1; index < 3; index += 1) {
    const nextInput = container.children[4].children[index].children[1].children[1].children[0];
    nextInput.files = [remainingFiles[index - 1]];
    await nextInput.listeners.change({ currentTarget: nextInput });
  }
  assert.equal(container.children[2].dataset.csvReady, "LOCAL_FILES_READY");
  assert.equal(container.children[2].dataset.csvReadyCount, "3");
  assert.equal(container.children[2].textContent, "ローカル確認 3/3完了。取込はまだ実行できません。");
  assert.equal(container.children[3].dataset.csvReceipt, "READY");
  assert.equal(container.children[3].attributes["aria-disabled"], "false");
  assert.match(container.children[3].href, /^data:application\/json;charset=utf-8,/);
  const receipt = JSON.parse(decodeURIComponent(container.children[3].href.split(",")[1]));
  assert.deepEqual(receipt.files.map(({ rowCount }) => rowCount), [1, 1, 1]);
  assert.doesNotMatch(JSON.stringify(receipt), /private|店舗A/);
  input.files = [{ name: "private-invalid.csv", size: 40, text: async () => "対象月,店舗,売上\n2026-13,private-store,100\n" }];
  await input.listeners.change({ currentTarget: input });
  assert.equal(container.children[3].dataset.csvReceipt, "NOT_READY");
  assert.equal(container.children[3].attributes["aria-disabled"], "true");
  assert.equal(container.children[3].href, "");
  assert.equal(renderCsvRequirements(null, SANITIZED_CSV_REQUIREMENTS, { createElement }), false);
});

test("renderer emits sanitized local receipt callback for Management finance bridge", async () => {
  const createElement = (tagName) => ({ tagName, textContent: "", className: "", href: "", download: "", type: "", accept: "", hidden: false, value: "", files: [], attributes: {}, listeners: {}, children: [], dataset: {}, append(...children) { this.children.push(...children); }, setAttribute(name, value) { this.attributes[name] = value; }, removeAttribute(name) { delete this.attributes[name]; if (name === "href") this.href = ""; }, addEventListener(name, listener) { this.listeners[name] = listener; } });
  const receipts = [];
  const container = { dataset: {}, children: [], replaceChildren(...children) { this.children = children; } };
  assert.equal(renderCsvRequirements(container, SANITIZED_CSV_REQUIREMENTS, { createElement, onReceipt: (receipt) => receipts.push(receipt) }), true);
  assert.equal(receipts.at(-1), null);
  const files = [
    { name: "monthly.csv", size: 48, text: async () => "対象月,店舗,売上\n2026-07,店舗A,100\n" },
    { name: "daily.csv", size: 80, text: async () => "営業日,店舗,売上,客数,客単価\n2026-07-01,店舗A,100,2,50\n" },
    { name: "reservations.csv", size: 70, text: async () => "営業日,店舗,予約枠,予約数\n2026-07-01,店舗A,10,5\n" },
  ];
  for (let index = 0; index < 3; index += 1) {
    const input = container.children[4].children[index].children[1].children[1].children[0];
    input.files = [files[index]];
    await input.listeners.change({ currentTarget: input });
  }
  assert.deepEqual(receipts.at(-1), {
    schemaVersion: "management-store-csv-local-validation-v1",
    status: "LOCAL_FILES_READY",
    files: [
      { kind: "STORE_MONTHLY_SALES", category: "VALID", rowCount: 1 },
      { kind: "STORE_DAILY_SALES", category: "VALID", rowCount: 1 },
      { kind: "STORE_RESERVATIONS", category: "VALID", rowCount: 1 },
    ],
  });
  assert.doesNotMatch(JSON.stringify(receipts.at(-1)), /店舗A|private|digest/i);
  const firstInput = container.children[4].children[0].children[1].children[1].children[0];
  firstInput.files = [{ name: "monthly-invalid.csv", size: 40, text: async () => "対象月,店舗,売上\n2026-13,店舗A,100\n" }];
  await firstInput.listeners.change({ currentTarget: firstInput });
  assert.equal(receipts.at(-1), null);
});

test("active Management app integrates display only", () => {
  assert.match(html, /id="csv-requirements"/);
  assert.match(html, /app-v2\.js\?v=7112912fb7ad4627/);
  assert.match(html, /styles\.css\?v=01c0dc5f8f414bef/);
  assert.match(app, /store-csv-requirements\.js\?v=9d6bb401afd343fb/);
  assert.match(app, /renderCsvRequirements\(elements\.csvRequirements, data\.requiredCsvFiles, \{/);
  assert.match(app, /localStoreCsvReceipt/);
  assert.doesNotMatch(app, /csvRequirements[\s\S]{0,240}(upload|submit|import|mutation)/i);
});
