import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const document = await readFile(new URL("../docs/store_operations_management/production_release/staging-core-uat-foundation.md", import.meta.url), "utf8");
const runtime = await readFile(new URL("../supabase/functions/nov-hub-api/index.ts", import.meta.url), "utf8");

test("foundation records the real three-user UAT set and keeps hosted access fail-closed", () => {
  assert.match(document, /Three distinct, real, active Staging users/u);
  assert.match(document, /Executive or `super_admin`/u);
  assert.match(document, /Area Manager/u);
  assert.match(document, /Store Manager/u);
  assert.match(document, /Hosted Role UAT remains fail-closed/u);
});

test("foundation adopts existing M019 scope and rejects duplicate Core Role ownership", () => {
  assert.match(document, /accounting\.current_consumer_access_contracts/u);
  assert.match(document, /Core has no Role master and must not receive a duplicate one/u);
  assert.match(document, /fake identity/u);
});

test("management runtime still rejects client identity and keeps assigned scope enabled", () => {
  const body = runtime.slice(runtime.indexOf("async function handleManagementFromDeployedBaseline"), runtime.indexOf("async function resolveDbfHandoffBusinessDataAdmin"));
  assert.match(body, /assignedScopeEnabled:\s*true/u);
  assert.doesNotMatch(body, /payload\.(?:employeeId|role|storeId|storeUuid)/u);
});
