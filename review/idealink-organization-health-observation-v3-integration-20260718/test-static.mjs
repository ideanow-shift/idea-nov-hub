import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const backend = await readFile(new URL("../../supabase/functions/nov-hub-api/index.ts", import.meta.url), "utf8");
const module = await readFile(new URL("../../supabase/functions/nov-hub-api/organization_health_monitoring_candidate.ts", import.meta.url), "utf8");
const frontend = await readFile(new URL("../../portal/idea-link-app/index.html", import.meta.url), "utf8");
let passed = 0; const test = (fn) => { fn(); passed += 1; };
test(() => assert.match(backend, /readOrganizationHealthMonitoringCandidate/));
test(() => assert.match(backend, /ideaLinkOrganizationHealthMonitoringRead/));
test(() => assert.match(module, /visibility: "eq\.public"/));
test(() => assert.match(module, /status: "eq\.active"/));
test(() => assert.match(module, /MIN_COHORT = 5/));
test(() => assert.match(module, /MAX_STORES = 40/));
test(() => assert.doesNotMatch(module, /insert|update|delete|upsert|rpc\(/i));
test(() => assert.doesNotMatch(module, /fetch\(|notification|enqueue|sendIdeaLink/i));
test(() => assert.match(frontend, /良否や個人を評価するものではありません/));
test(() => assert.match(frontend, /自動的な人事判断には使用しません/));
console.log(JSON.stringify({ scenarios: 10, passed, selectOnly: true, protectedSendDiff: 0 }));


