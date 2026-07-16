import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  SANITIZED_CSV_REQUIREMENTS,
  buildCsvRequirementsView,
  renderCsvRequirements,
  validateCsvRequirements,
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

test("renderer exposes local downloads without upload or runtime action", () => {
  const createElement = (tagName) => ({ tagName, textContent: "", className: "", href: "", download: "", attributes: {}, children: [], dataset: {}, append(...children) { this.children.push(...children); }, setAttribute(name, value) { this.attributes[name] = value; } });
  const container = { dataset: {}, children: [], replaceChildren(...children) { this.children = children; } };
  assert.equal(renderCsvRequirements(container, SANITIZED_CSV_REQUIREMENTS, { createElement }), true);
  assert.equal(container.dataset.csvRequirementStatus, "READY_FOR_FILE_PREPARATION");
  assert.equal(container.children.length, 3);
  assert.equal(container.children[2].children.length, 3);
  assert.deepEqual(container.children[2].children.map((item) => item.children[1].tagName), ["a", "a", "a"]);
  assert.deepEqual(container.children[2].children.map((item) => item.children[1].download), [
    "store-monthly-sales-template.csv",
    "store-daily-sales-template.csv",
    "store-reservations-template.csv",
  ]);
  assert.equal(container.children[2].children.every((item) => item.children[1].href.startsWith("data:text/csv")), true);
  assert.equal(renderCsvRequirements(null, SANITIZED_CSV_REQUIREMENTS, { createElement }), false);
});

test("active Management app integrates display only", () => {
  assert.match(html, /id="csv-requirements"/);
  assert.match(html, /app-v2\.js\?v=67fbb994f1b3290b/);
  assert.match(html, /styles\.css\?v=770c7def287cf2b9/);
  assert.match(app, /store-csv-requirements\.js\?v=0235672a316f69f4/);
  assert.match(app, /renderCsvRequirements\(elements\.csvRequirements, data\.requiredCsvFiles\)/);
  assert.doesNotMatch(app, /csvRequirements[\s\S]{0,240}(upload|submit|import|mutation)/i);
});
