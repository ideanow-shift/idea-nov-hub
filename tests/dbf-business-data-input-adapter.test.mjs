import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { parseClipboardGrid, prepareDbfInput, prepareManualDbfInput, STORE_METRIC_GROUPS, validateOfficialStoreBaseline } from "../portal/management-app/dbf-business-data-input-adapter.js";

const month = "2026-06";
const companyKey = "0001";
const storeKey = "0001";

test("CSV adapter preserves the established normalized row contract", () => {
  const result = prepareDbfInput({ sourceType: "csv_upload", factKind: "store_operating_result", fiscalMonth: month, file: { name: "stores.csv" }, text: "fiscal_month,company_key,store_key,metric_code,value,definition_version,confirmation_status\n2026-06,0001,0001,TOTAL_SALES,100,v1,confirmed\n" });
  assert.equal(result.sourceType, "csv_upload");
  assert.equal(result.sourceSystem, "dbf_phase_c_normalized_csv_v1");
  assert.equal(result.normalizedRows[0].metricCode, "TOTAL_SALES");
});

test("Manual P/L and B/S generate normalized rows and deterministic evidence", () => {
  const pl = prepareManualDbfInput({ factKind: "pl", fiscalMonth: month, rows: [{ companyKey, accountCode: "4000", accountName: "技術売上", amount: "1,000", sourceRowCategory: "detail" }] });
  const bs = prepareManualDbfInput({ factKind: "bs", fiscalMonth: month, rows: [{ companyKey, accountCode: "1000", accountName: "現金", amount: 1000, classification: "asset" }, { companyKey, accountCode: "3000", accountName: "純資産", amount: 1000, classification: "equity" }] });
  assert.equal(pl.normalizedRows[0].amount, 1000);
  assert.equal(bs.normalizedRows[0].storeKey, null);
  assert.equal(pl.sourceArtifact.content, prepareManualDbfInput({ factKind: "pl", fiscalMonth: month, rows: [{ companyKey, accountCode: "4000", accountName: "技術売上", amount: "1,000", sourceRowCategory: "detail" }] }).sourceArtifact.content);
});

test("Manual store monthly supports every existing metric and converts percent input", () => {
  assert.equal(STORE_METRIC_GROUPS.flatMap((group) => group.metrics).length, 19);
  const result = prepareManualDbfInput({ factKind: "store_operating_result", fiscalMonth: month, rows: [{ companyKey, storeKey, metricCode: "TOTAL_REPEAT_RATE", value: 71 }] });
  assert.equal(result.normalizedRows[0].value, 0.71);
});

test("Manual store monthly preserves the explicitly selected confirmation status", () => {
  for (const confirmationStatus of ["provisional", "confirmed"]) {
    const result = prepareManualDbfInput({ factKind: "store_operating_result", fiscalMonth: month, rows: [{ companyKey, storeKey, metricCode: "TOTAL_SALES", value: 100, confirmationStatus }] });
    assert.equal(result.normalizedRows[0].confirmationStatus, confirmationStatus);
  }
});

test("Manual rate bounds, required fields, B/S scope and budget ambiguity fail closed", () => {
  for (const value of [-1, 101]) assert.throws(() => prepareManualDbfInput({ factKind: "store_operating_result", fiscalMonth: month, rows: [{ companyKey, storeKey, metricCode: "TOTAL_REPEAT_RATE", value }] }), /STORE_METRIC_RATE_INVALID/u);
  assert.throws(() => prepareManualDbfInput({ factKind: "pl", fiscalMonth: month, rows: [{ companyKey, accountCode: "", accountName: "売上", amount: 1 }] }), /ACCOUNT_CODE_REQUIRED/u);
  assert.throws(() => prepareManualDbfInput({ factKind: "bs", fiscalMonth: month, rows: [{ companyKey, storeKey, accountCode: "1000", accountName: "現金", amount: 1, classification: "asset" }] }), /BS_STORE_SCOPE_PROHIBITED/u);
  assert.throws(() => prepareManualDbfInput({ factKind: "bs", fiscalMonth: month, rows: [{ companyKey, accountCode: "1000", accountName: "現金", amount: 1, classification: "asset" }] }), /BS_BALANCE_CHECK_FAILED/u);
  assert.throws(() => prepareManualDbfInput({ factKind: "budget", fiscalMonth: month, rows: [{ companyKey, scenarioCode: "BASE", accountCode: "4000", metricCode: "TOTAL_SALES", amount: 1 }] }), /BUDGET_MEASURE_AMBIGUOUS/u);
});

test("Manual budget and clipboard grid preserve exact dimensions", () => {
  const result = prepareManualDbfInput({ factKind: "budget", fiscalMonth: month, rows: [{ companyKey, storeKey, scenarioCode: "BASE", metricCode: "TOTAL_SALES", amount: 100 }] });
  assert.equal(result.normalizedRows[0].accountCode, null);
  assert.deepEqual(parseClipboardGrid("1\t2\n3\t4", 2, 2), [["1", "2"], ["3", "4"]]);
  assert.throws(() => parseClipboardGrid("1\t2", 2, 2), /CLIPBOARD_DIMENSION_MISMATCH/u);
});

test("official Store Master baseline is exactly 20 stores, DIRECT 13 and FC 7", () => {
  const companies = [{ id: "direct", code: "0001" }, { id: "fc", code: "0002" }];
  const stores = [{ id: "hq", code: "honbu", name: "本部", companyId: "direct" }, ...Array.from({ length: 13 }, (_, index) => ({ id: `d${index}`, code: `d${index}`, name: `直営${index}`, companyId: "direct" })), ...Array.from({ length: 7 }, (_, index) => ({ id: `f${index}`, code: `f${index}`, name: `FC${index}`, companyId: "fc" }))];
  assert.deepEqual(validateOfficialStoreBaseline({ companies, stores }), { stores: stores.slice(1), direct: 13, fc: 7 });
});

test("management UI exposes manual entry without a second write pipeline", () => {
  const source = fs.readFileSync(new URL("../portal/management-app/business-data-management-preview.js", import.meta.url), "utf8");
  const adapter = fs.readFileSync(new URL("../portal/management-app/dbf-business-data-input-adapter.js", import.meta.url), "utf8");
  for (const label of ["CSVから取り込む", "画面で直接入力", "71%", "＋ 行を追加", "この内容で取り込む"]) assert.match(source, new RegExp(label, "u"));
  for (const label of ["データ状態（必須）", "確定値", "Store Operationsの正式データとして利用します", "暫定値", "Store Operationsの正式実績にはまだ表示されません"]) assert.match(source, new RegExp(label, "u"));
  assert.match(source, /confirmationMissing/u);
  assert.doesNotMatch(source, /confirmationStatus: "provisional"/u);
  for (const label of ["売上", "顧客", "単価", "リピート", "生産性"]) assert.match(adapter, new RegExp(label, "u"));
  assert.match(source, /prepareDbfInput/u);
  assert.match(source, /sourceType,/u);
  assert.doesNotMatch(source, /localStorage/u);
  assert.equal((source.match(/DBF_IMPORT_RUNTIME\.start\(/gu) || []).length, 1);
  assert.equal((source.match(/DBF_IMPORT_RUNTIME\.validate\(/gu) || []).length, 1);
  assert.equal((source.match(/DBF_IMPORT_RUNTIME\.promote\(/gu) || []).length, 1);
});
