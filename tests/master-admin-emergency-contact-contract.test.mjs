import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const frontend = readFileSync(new URL("../portal/master-admin/master-admin.js", import.meta.url), "utf8");
const api = readFileSync(new URL("../supabase/functions/nov-hub-api/index.ts", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20260814090000_employee_emergency_contact_foundation.sql", import.meta.url), "utf8");

assert.match(frontend, /<strong>緊急連絡先<\/strong>/);
assert.match(frontend, /安否確認に使用する本人の電話番号/);
assert.match(frontend, /社員一覧・CSVには表示しません/);
assert.match(frontend, /masterReadEmployeeEmergencyContact/);
assert.match(frontend, /masterUpdateEmployeeEmergencyContact/);
assert.match(frontend, /id="employee_emergency_phone"[^>]*autocomplete="off"/);
assert.doesNotMatch(frontend, /DATA_INTAKE_TARGETS[\s\S]{0,1200}緊急連絡先/);

const normalizeStart = frontend.indexOf("function normalizeEmployeeEmergencyPhone");
const normalizeEnd = frontend.indexOf("\nfunction updateEmployeeEmergencyContactBadge", normalizeStart);
assert.ok(normalizeStart >= 0 && normalizeEnd > normalizeStart);
const phoneContext = {};
vm.runInNewContext(frontend.slice(normalizeStart, normalizeEnd), phoneContext);
assert.equal(phoneContext.normalizeEmployeeEmergencyPhone("090-1234-5678"), "09012345678");
assert.equal(phoneContext.normalizeEmployeeEmergencyPhone("+81 90 1234 5678"), "+819012345678");
assert.equal(phoneContext.getEmployeeEmergencyPhoneValidationError("090-1234-5678"), "");
assert.notEqual(phoneContext.getEmployeeEmergencyPhoneValidationError("123"), "");

assert.match(api, /assertMasterViewer\(employee\)[\s\S]{0,180}readEmployeeEmergencyContact/);
assert.match(api, /assertMasterEditor\(employee\)[\s\S]{0,180}updateEmployeeEmergencyContact/);
assert.match(api, /select: "employee_id,employee_phone_number,updated_at"/);
assert.match(api, /emergency_contact_configured_before/);
assert.match(api, /Actor employee id is invalid/);
assert.doesNotMatch(api, /appendMasterChangeLog\([\s\S]{0,400}employee_phone_number/);

const employeeListStart = api.indexOf("async function listCoreEmployeesForAdmin");
const employeeListEnd = api.indexOf("\nfunction sanitizeLineWorksDestination", employeeListStart);
assert.ok(employeeListStart >= 0 && employeeListEnd > employeeListStart);
assert.doesNotMatch(api.slice(employeeListStart, employeeListEnd), /employee_emergency_contacts|employee_phone_number/);

assert.match(migration, /create table public\.employee_emergency_contacts/);
assert.match(migration, /to_regclass\('public\.employees'\) is null/);
assert.match(migration, /EMPLOYEE_EMERGENCY_CONTACT_CANONICAL_PARENT_MISSING/);
assert.match(migration, /EMPLOYEE_EMERGENCY_CONTACT_CANONICAL_PARENT_INVALID/);
assert.doesNotMatch(migration, /references core\.employees/i);
assert.match(migration, /employee_phone_number text/);
assert.match(migration, /create table public\.employee_emergency_contact_audit_logs/);
assert.match(migration, /event_type in \('created', 'updated', 'cleared'\)/);
assert.match(migration, /security invoker/);
assert.match(migration, /set search_path = pg_catalog, public/);
assert.match(migration, /after insert or update of employee_phone_number/);
assert.doesNotMatch(migration, /employee_phone_number[^\n]*employee_emergency_contact_audit_logs/);
assert.match(migration, /enable row level security/);
assert.match(migration, /revoke all[\s\S]*from anon/);
assert.match(migration, /revoke all[\s\S]*from authenticated/);
assert.match(
  migration,
  /revoke all on table public\.employee_emergency_contacts from service_role;\s*grant select, insert, update on table public\.employee_emergency_contacts to service_role;/
);
assert.match(
  migration,
  /revoke all on table public\.employee_emergency_contact_audit_logs from service_role;\s*grant select, insert on table public\.employee_emergency_contact_audit_logs to service_role;/
);
assert.match(
  migration,
  /revoke all on function public\.audit_employee_emergency_contact_change\(\) from service_role;\s*grant execute on function public\.audit_employee_emergency_contact_change\(\) to service_role;/
);
assert.doesNotMatch(migration, /grant [^;]*delete[^;]*service_role/i);
assert.doesNotMatch(migration, /grant [^;]*(anon|authenticated)/i);
assert.doesNotMatch(migration, /emergency_contact_name/);

console.log("master admin emergency contact contract: PASS");
