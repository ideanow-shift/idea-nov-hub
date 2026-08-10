import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../supabase/functions/nov-hub-api/index.ts", import.meta.url), "utf8");
const start = source.indexOf('const TALENT_WORKFLOW_ROLE_KEYS');
const end = source.indexOf('\nfunction indexById', start);
const candidate = source.slice(start, end);
const routeStart = source.indexOf('if (action === "talentWorkflowAssigneesRead")');
const route = source.slice(routeStart, source.indexOf('\n    if (action ===', routeStart + 10));

assert.ok(start >= 0 && end > start && routeStart >= 0, "candidate boundary must exist");
assert.match(candidate, /super_admin.*backoffice.*hr\.admin.*hr\.staff/);
assert.doesNotMatch(candidate, /executive|store_manager|department_manager|general_staff/);
assert.match(candidate, /corporation_id: `eq\.\$\{corporationId\}`/);
assert.match(candidate, /is_active: "eq\.true"/);
assert.match(candidate, /employment_status/);
assert.match(candidate, /TALENT_WORKFLOW_MAX_ASSIGNEES \+ 1/);
assert.match(candidate, /TALENT_WORKFLOW_MAX_ROLE_ASSIGNMENTS \+ 1/);
assert.match(candidate, /new Set\(employeeIds\)\.size !== employeeIds\.length/);
assert.match(candidate, /roles[\s\S]*is_active: "eq\.true"/);
assert.match(candidate, /employee_roles[\s\S]*is_active: "eq\.true"/);
assert.match(candidate, /TALENT_WORKFLOW_DIRECTORY_UNAVAILABLE/);
assert.deepEqual([...candidate.matchAll(/employeeId:|displayName:/g)].map((match) => match[0]), ["employeeId:", "displayName:"]);
assert.doesNotMatch(candidate, /insert|update|delete|rpc|storage|notification|enqueue/iu);
assert.match(route, /assertTalentWorkflowViewer\(employee\)/);
assert.match(route, /listTalentWorkflowAssignees\(employee\)/);
assert.doesNotMatch(route, /payload|employeeId|roleKeys|scope/);

console.log("nov-hub-api talent workflow assignees read-only contract: PASS");
