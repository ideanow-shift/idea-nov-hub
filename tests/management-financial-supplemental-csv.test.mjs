import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  FINANCIAL_SUPPLEMENTAL_DEFINITIONS,
  buildFinancialSupplementalReceipt,
  buildFinancialSupplementalTemplates,
  renderFinancialSupplementalCsv,
  validateFinancialSupplementalCsvFile,
  validateFinancialSupplementalCsvText,
} from "../portal/management-app/financial-supplemental-csv.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "portal/management-app/financial-supplemental-csv.js"), "utf8");
const visualFixture = fs.readFileSync(path.join(root, "tests/fixtures/management-financial-supplemental-csv.html"), "utf8");

const csv = (key, rows) => {
  const definition = FINANCIAL_SUPPLEMENTAL_DEFINITIONS.find((item) => item.key === key);
  return [definition.headers, ...rows].map((row) => row.join(",")).join("\r\n");
};

const validRows = Object.freeze({
  UTILITY_SUBLEDGER: [["2026-06", "法人候補", "店舗候補", "水道光熱費", "1234.50"]],
  COUPON_USAGE: [["2026-06", "店舗候補", "新規", "1200"]],
  BUDGET_PLAN: [["2026-06", "店舗", "店舗候補", "売上高", "100000"]],
  FC_RULE: [["第13期", "店舗候補", "FC個店", "集計対象"]],
});

test("supplemental templates have fixed UTF-8 CSV identities", () => {
  const templates = buildFinancialSupplementalTemplates();
  assert.equal(templates.length, 4);
  assert.deepEqual(templates.map((item) => item.key), ["UTILITY_SUBLEDGER", "COUPON_USAGE", "BUDGET_PLAN", "FC_RULE"]);
  templates.forEach((item) => {
    assert.match(item.fileName, /^management-[a-z-]+-template\.csv$/u);
    assert.match(item.href, /^data:text\/csv;charset=utf-8,/u);
    const decoded = decodeURIComponent(item.href.split(",")[1]);
    assert.ok(decoded.startsWith("\uFEFF"));
    assert.match(decoded, new RegExp(item.headers[0], "u"));
  });
});

test("all four supplemental contracts accept canonical rows", () => {
  for (const [key, rows] of Object.entries(validRows)) {
    assert.deepEqual(validateFinancialSupplementalCsvText(key, csv(key, rows)), {
      category: "VALID",
      key,
      valid: true,
      rowCount: 1,
      mutationCount: 0,
      uploadCount: 0,
    });
  }
});

test("supplemental validation fails closed on headers, periods, numbers, enums and duplicate keys", () => {
  assert.equal(validateFinancialSupplementalCsvText("UTILITY_SUBLEDGER", "wrong\r\nvalue").category, "HEADER_MISMATCH");
  assert.equal(validateFinancialSupplementalCsvText("UTILITY_SUBLEDGER", csv("UTILITY_SUBLEDGER", [["2026-13", "法人", "店舗", "水道光熱費", "1"]])).category, "PERIOD_VALUE_INVALID");
  assert.equal(validateFinancialSupplementalCsvText("COUPON_USAGE", csv("COUPON_USAGE", [["2026-06", "店舗", "区分", "-1"]])).category, "NUMBER_VALUE_INVALID");
  assert.equal(validateFinancialSupplementalCsvText("BUDGET_PLAN", csv("BUDGET_PLAN", [["2026-06", "全社", "候補", "売上高", "1"]])).category, "ENUM_VALUE_INVALID");
  assert.equal(validateFinancialSupplementalCsvText("FC_RULE", csv("FC_RULE", [["2026", "候補", "FC個店", "集計対象"]])).category, "PERIOD_VALUE_INVALID");
  assert.equal(validateFinancialSupplementalCsvText("FC_RULE", csv("FC_RULE", [["第13期", "候補", "加盟店", "集計対象"]])).category, "ENUM_VALUE_INVALID");
  assert.equal(validateFinancialSupplementalCsvText("UTILITY_SUBLEDGER", csv("UTILITY_SUBLEDGER", [...validRows.UTILITY_SUBLEDGER, ...validRows.UTILITY_SUBLEDGER])).category, "DUPLICATE_KEY");
  assert.equal(validateFinancialSupplementalCsvText("UTILITY_SUBLEDGER", csv("UTILITY_SUBLEDGER", [["2026-06", " 法人", "店舗", "水道光熱費", "1"]])).category, "TEXT_VALUE_INVALID");
});

test("malformed, replacement characters and unknown contracts are rejected", () => {
  assert.equal(validateFinancialSupplementalCsvText("UNKNOWN", "a,b").category, "REQUEST_INVALID");
  assert.equal(validateFinancialSupplementalCsvText("UTILITY_SUBLEDGER", '"unterminated').category, "CSV_MALFORMED");
  assert.equal(validateFinancialSupplementalCsvText("UTILITY_SUBLEDGER", csv("UTILITY_SUBLEDGER", [["2026-06", "法\uFFFD人", "店舗", "水道光熱費", "1"]])).category, "CSV_MALFORMED");
});

test("file boundary validates type, size and read failures without raw values", async () => {
  const validText = csv("UTILITY_SUBLEDGER", validRows.UTILITY_SUBLEDGER);
  assert.equal((await validateFinancialSupplementalCsvFile("UTILITY_SUBLEDGER", { name: "utility.csv", size: validText.length, text: async () => validText })).category, "VALID");
  assert.equal((await validateFinancialSupplementalCsvFile("UTILITY_SUBLEDGER", { name: "utility.xlsx", size: 1, text: async () => validText })).category, "FILE_TYPE_INVALID");
  assert.equal((await validateFinancialSupplementalCsvFile("UTILITY_SUBLEDGER", { name: "utility.csv", size: 5 * 1024 * 1024 + 1, text: async () => validText })).category, "FILE_TOO_LARGE");
  assert.equal((await validateFinancialSupplementalCsvFile("UTILITY_SUBLEDGER", { name: "utility.csv", size: 1, text: async () => { throw new Error("private"); } })).category, "READ_FAILED");
});

test("receipt contains only fixed categories and aggregate counts", () => {
  const results = Object.entries(validRows).map(([key, rows]) => validateFinancialSupplementalCsvText(key, csv(key, rows)));
  const receipt = buildFinancialSupplementalReceipt(results);
  assert.deepEqual(receipt, {
    schemaVersion: "management-financial-supplemental-local-v1",
    category: "LOCAL_SUPPLEMENTAL_FILES_READY",
    validatedFileCount: 4,
    validatedRowCount: 4,
    productionImportReady: false,
    mutationCount: 0,
    uploadCount: 0,
  });
  assert.equal(buildFinancialSupplementalReceipt(results.slice(0, 3)), null);
  assert.doesNotMatch(JSON.stringify(receipt), /(法人候補|店舗候補|水道光熱費|100000)/u);
});

test("renderer exposes local-only actions and disabled production import", () => {
  const createElement = (tagName) => ({
    tagName,
    textContent: "",
    className: "",
    type: "",
    value: "",
    disabled: false,
    hidden: false,
    dataset: {},
    children: [],
    attributes: {},
    listeners: {},
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(name, listener) { this.listeners[name] = listener; },
  });
  const document = { createElement };
  const container = { dataset: {}, ownerDocument: document, children: [], replaceChildren(...children) { this.children = children; } };
  assert.equal(renderFinancialSupplementalCsv(container, { document }), true);
  const section = container.children[0];
  assert.equal(container.dataset.productionImport, "DISABLED");
  assert.equal(section.children[0].children[1].disabled, true);
  assert.equal(section.children[3].children.length, 4);
  assert.equal(section.children[3].children[0].dataset.financialSupplementalKey, "UTILITY_SUBLEDGER");
  assert.equal(section.children[3].children[0].children[1].children[1].children[0].type, "file");
});

test("source has no network, persistence, production mutation or sensitive identity path", () => {
  assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|localStorage|sessionStorage|indexedDB|FormData/u);
  assert.doesNotMatch(source, /(employeeId|sessionToken|Authorization|service_role|DB_INSERT|DB_UPDATE)/u);
  assert.match(source, /productionImportReady: false/u);
  assert.match(source, /mutationCount: 0/u);
  assert.match(source, /uploadCount: 0/u);
  assert.match(visualFixture, /financial-supplemental-csv\.js/u);
  assert.match(visualFixture, /management-app\/styles\.css/u);
  assert.doesNotMatch(visualFixture, /fetch\(|localStorage|sessionStorage|Authorization/u);
});
