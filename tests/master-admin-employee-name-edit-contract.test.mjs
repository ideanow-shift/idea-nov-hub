import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const frontend = readFileSync(new URL("../portal/master-admin/master-admin.js", import.meta.url), "utf8");
const api = readFileSync(new URL("../supabase/functions/nov-hub-api/index.ts", import.meta.url), "utf8");

const detailStart = frontend.indexOf("function renderEmployeeDetail");
const detailEnd = frontend.indexOf("\nfunction renderStoreDetail", detailStart);
assert.ok(detailStart >= 0 && detailEnd > detailStart);
const detail = frontend.slice(detailStart, detailEnd);

assert.match(detail, /fieldInput\("full_name", "氏名", employee\.full_name \|\| "", \{ required: true/);
assert.match(detail, /name="expected_updated_at" value="\$\{escapeHtml\(employee\.updated_at \|\| ""\)\}"/);

const saveStart = frontend.indexOf("async function saveEmployee(event)");
const saveEnd = frontend.indexOf("\nasync function retireEmployee", saveStart);
assert.ok(saveStart >= 0 && saveEnd > saveStart);
const save = frontend.slice(saveStart, saveEnd);
assert.match(save, /payload\.full_name = String\(payload\.full_name \|\| ""\)\.trim\(\)/);
assert.match(save, /if \(!payload\.full_name\)[\s\S]{0,120}氏名を入力してください/);

const updateStart = api.indexOf("async function updateCoreEmployee");
const updateEnd = api.indexOf("\nasync function linkFirebaseUid", updateStart);
assert.ok(updateStart >= 0 && updateEnd > updateStart);
const update = api.slice(updateStart, updateEnd);
assert.match(api, /if \(action === "masterUpdateEmployee"\) \{\s*assertMasterEditor\(employee\)/);
assert.match(update, /STALE_EMPLOYEE/);
assert.match(update, /Object\.prototype\.hasOwnProperty\.call\(payload, "full_name"\)/);
assert.match(update, /updates\.full_name = String\(payload\.full_name \|\| ""\)\.trim\(\)/);
assert.doesNotMatch(update, /delete updates\.full_name;\s*const changedUpdates/);
assert.match(update, /\.\.\.\(expectedUpdatedAt \? \{ updated_at: `eq\.\$\{expectedUpdatedAt\}` \} : \{\}\)/);
assert.match(update, /appendMasterChangeLog\("employees"/);

console.log("master admin employee name edit contract: PASS");
