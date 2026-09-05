import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const frontend = readFileSync(new URL("../portal/master-admin/master-admin.js", import.meta.url), "utf8");
const api = readFileSync(new URL("../supabase/functions/nov-hub-api/index.ts", import.meta.url), "utf8");
const standardHtml = readFileSync(new URL("../portal/master-admin/index.html", import.meta.url), "utf8");
const stableHtml = readFileSync(new URL("../portal/master-admin-stable/index.html", import.meta.url), "utf8");

const employeeCreateVersion = "master-admin-employee-create-20260905-3";
assert.match(standardHtml, new RegExp(`master-admin\\.js\\?v=${employeeCreateVersion}`));
assert.match(stableHtml, new RegExp(`master-admin\\.js\\?v=${employeeCreateVersion}`));

const safeSelectionStart = frontend.indexOf("function getSafeSelectedRow");
const safeSelectionEnd = frontend.indexOf("\nfunction getSafeRowsForCurrentView", safeSelectionStart);
const safeSelection = frontend.slice(safeSelectionStart, safeSelectionEnd > safeSelectionStart ? safeSelectionEnd : safeSelectionStart + 500);
assert.match(safeSelection, /state\.selectedId === NEW_EMPLOYEE_ID/);

const safeViewStart = frontend.indexOf("function renderSafeMasterAdminView");
const safeViewEnd = frontend.indexOf("\nfunction forceRecoveryEmployeeTable", safeViewStart);
assert.ok(safeViewStart >= 0 && safeViewEnd > safeViewStart);
const safeView = frontend.slice(safeViewStart, safeViewEnd);
assert.match(safeView, /state\.view === "employees" && state\.permissions\.canEdit/);
assert.match(safeView, /addEmployeeButton\.textContent = "社員追加"/);
assert.match(safeView, /addEmployeeButton\.addEventListener\("click", startCreateEmployee\)/);

const createUiStart = frontend.indexOf("function renderNewEmployeeDetail");
const createUiEnd = frontend.indexOf("\nfunction validateEmployeeFormPayload", createUiStart);
const createUi = frontend.slice(createUiStart, createUiEnd);
assert.doesNotMatch(createUi, /isActiveEmployee/);
assert.match(createUi, /fieldInput\("employee_id", "社員番号"/);
assert.match(createUi, /fieldInput\("full_name", "氏名"/);
assert.match(createUi, /fieldInput\("joined_on", "入社日"/);
assert.doesNotMatch(createUi, /新卒|中途/);
assert.match(createUi, /fieldInput\("email", "メール（任意）", "", \{ type: "text", inputMode: "email"/);
assert.match(createUi, /fieldInput\("employee_id"[^\n]+required: true/);
assert.match(createUi, /fieldInput\("full_name"[^\n]+required: true/);

function sourceBetween(start, end) {
  const first = frontend.indexOf(start);
  const last = frontend.indexOf(end, first);
  assert.ok(first >= 0 && last > first, `source bounds: ${start}`);
  return frontend.slice(first, last);
}

// Execute the real submission handler with in-memory API/DOM doubles only.
// No network or Production employee writes are available in this sandbox.
const submissionSource = [
  sourceBetween("function validateEmployeeFormPayload", "function renderEmployeeCreatedPanel"),
  sourceBetween("function normalizeEmployeeEmailInput", "function updateDirtyState"),
].join("\n");
for (const scenario of [
  { email: "", expected: "" },
  { email: " 　\u200B\uFEFF", expected: "" },
  { email: " User@Example.com ", expected: "user@example.com" },
  { email: "Ｕｓｅｒ＠Ｅｘａｍｐｌｅ．ｃｏｍ", expected: "user@example.com" },
  { email: "invalid", rejected: true },
  { email: "a@@example.com", rejected: true },
  { email: "", employee_id: "", rejected: true },
  { email: "", full_name: "", rejected: true },
  { email: "", duplicate: true, rejected: true },
  { email: "", stores: ["store-a", "store-a", ""], rejected: true },
  { email: "", stores: ["store-a", "", "store-a"], rejected: true },
  { email: "", stores: ["store-a", "store-b", "store-c"], expected: "" },
]) {
  const calls = [];
  const messages = [];
  const payload = { employee_id: "TEST-ONLY", full_name: "Fixture Employee", email: scenario.email };
  if (scenario.employee_id !== undefined) payload.employee_id = scenario.employee_id;
  if (scenario.full_name !== undefined) payload.full_name = scenario.full_name;
  if (scenario.stores) [payload.store_id, payload.store_assignment_2, payload.store_assignment_3] = scenario.stores;
  const button = {};
  const sandbox = {
    state: { employees: scenario.duplicate ? [{ employee_id: "TEST-ONLY" }] : [] },
    document: { querySelector: () => ({}) },
    collectEmployeePayload: () => ({ ...payload }),
    getInvalidDateField: () => null,
    showToast: (message) => messages.push(message),
    setSaveStatus: () => {},
    callApiAction: async (action, data) => { calls.push({ action, data }); return { employee: { id: "fixture-only" } }; },
    refreshEmployees: async () => {},
    render: () => {},
    restoreSaveButtonState: () => {},
    console: { error: (error) => { throw error; } },
    event: { preventDefault() {}, currentTarget: { querySelector: () => button } },
  };
  await runInNewContext(`${submissionSource}\nsaveNewEmployee(event)`, sandbox);
  assert.equal(calls.length, scenario.rejected ? 0 : 1, JSON.stringify(scenario));
  if (!scenario.rejected) {
    assert.equal(calls[0].action, "masterCreateEmployee");
    assert.equal(calls[0].data.email, scenario.expected);
  } else {
    assert.ok(messages.length > 0);
  }
}

const startCreateStart = frontend.indexOf("function startCreateEmployee");
const startCreateEnd = frontend.indexOf("\nfunction renderNewEmployeeDetail", startCreateStart);
const startCreate = frontend.slice(startCreateStart, startCreateEnd);
assert.match(startCreate, /if \(!state\.permissions\.canEdit\)/);
assert.match(startCreate, /removeSafeMasterAdminView\(\)/);
assert.match(startCreate, /state\.selectedId = NEW_EMPLOYEE_ID/);

const createApiStart = api.indexOf("async function createCoreEmployee");
const createApiEnd = api.indexOf("\nasync function updateCoreEmployee", createApiStart);
assert.ok(createApiStart >= 0 && createApiEnd > createApiStart);
const createApi = api.slice(createApiStart, createApiEnd);
assert.match(createApi, /employee_id: `eq\.\$\{employeeId\}`/);
assert.match(createApi, /DUPLICATE_EMPLOYEE_ID/);
assert.match(createApi, /appendMasterChangeLog\("employees"/);
assert.match(createApi, /actionType: "create"/);

assert.match(api, /if \(action === "masterCreateEmployee"\) \{\s*assertMasterEditor\(employee\)/);

console.log("master admin employee create contract: PASS");
