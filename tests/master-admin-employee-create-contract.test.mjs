import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const frontend = readFileSync(new URL("../portal/master-admin/master-admin.js", import.meta.url), "utf8");
const api = readFileSync(new URL("../supabase/functions/nov-hub-api/index.ts", import.meta.url), "utf8");

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
assert.match(createUi, /fieldInput\("employee_id", "社員番号"/);
assert.match(createUi, /fieldInput\("full_name", "氏名"/);
assert.match(createUi, /fieldInput\("joined_on", "入社日"/);
assert.doesNotMatch(createUi, /新卒|中途/);

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
