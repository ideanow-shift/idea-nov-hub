import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const migrationUrl = new URL("../supabase/migrations/20260814090000_employee_emergency_contact_foundation.sql", import.meta.url);
const bytes = readFileSync(migrationUrl);
const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
const sha256 = createHash("sha256").update(bytes).digest("hex").toUpperCase();

assert.equal(sha256, "A898F5968B0F7D111DCF4DE5DD18D860EB9966F1E534E6A669EFBA9389942C5F");
assert.equal(bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])), false);
assert.match(source, /^begin;\r?\n/iu);
assert.match(source, /\r?\ncommit;\r?\n?$/iu);
assert.doesNotMatch(source, /\brollback\b/iu);
assert.doesNotMatch(source, /\b(drop|truncate)\s+(table|column|constraint)\b/iu);
assert.doesNotMatch(source, /\b(insert\s+into|update|delete\s+from)\s+public\.employees\b/iu);
assert.doesNotMatch(source, /\balter\s+table\s+public\.employees\b/iu);
assert.equal((source.match(/force row level security/giu) || []).length, 2);
assert.match(source, /revoke all on table public\.employee_emergency_contacts from service_role;\s*grant select, insert, update on table public\.employee_emergency_contacts to service_role;/iu);
assert.match(source, /revoke all on table public\.employee_emergency_contact_audit_logs from service_role;\s*grant select, insert on table public\.employee_emergency_contact_audit_logs to service_role;/iu);
assert.doesNotMatch(source, /grant [^;]*delete[^;]*service_role/iu);
assert.doesNotMatch(source, /grant [^;]*(anon|authenticated)/iu);

console.log(`master admin personal phone migration: PASS ${sha256}`);
