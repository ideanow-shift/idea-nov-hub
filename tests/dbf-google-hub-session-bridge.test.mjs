import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const mainSource = await readFile(new URL("../portal/js/main.js", import.meta.url), "utf8");
const indexSource = await readFile(new URL("../portal/index.html", import.meta.url), "utf8");
const edgeSource = await readFile(new URL("../supabase/functions/nov-hub-api/index.ts", import.meta.url), "utf8");
const actionSource = await readFile(
  new URL("../supabase/functions/nov-hub-api/dbf_handoff_actions_candidate.mjs", import.meta.url),
  "utf8"
);

const prepareStart = mainSource.indexOf("async function prepareManagementPlatformLaunch");
const prepareEnd = mainSource.indexOf("\nfunction isIdeaLinkApp", prepareStart);
assert.ok(prepareStart >= 0 && prepareEnd > prepareStart, "management launch preparation must exist");
const prepareSource = mainSource.slice(prepareStart, prepareEnd);
const ensureStart = mainSource.indexOf("async function ensureManagementWebHubSession");
const ensureEnd = mainSource.indexOf("\nasync function ensureTalentHubSessionFreshness", ensureStart);
assert.ok(ensureStart >= 0 && ensureEnd > ensureStart, "HUB session freshness gate must exist");
const ensureSource = mainSource.slice(ensureStart, ensureEnd);

assert.match(
  prepareSource,
  /if \(isCoreMasterAdminApp\(app\)\) \{\s*await ensureManagementWebHubSession\(\);\s*saveManagementHubSessionAuthContext\(context\);\s*return;/u,
  "Core Master Admin must receive a verified NOV HUB session for both Google and PIN login"
);
assert.match(
  prepareSource,
  /if \(state\.authType === "pin"\) \{\s*saveManagementHubSessionAuthContext\(context\);/u,
  "existing PIN management launch must continue to use the HUB session"
);
assert.match(
  prepareSource,
  /await saveManagementPlatformAuthContext\(context\);/u,
  "non-DBF Management Platform Firebase launch behavior must remain available"
);
assert.match(indexSource, /main\.js\?v=dbf-google-hub-session-bridge-20260814-1/u);
assert.match(
  ensureSource,
  /setNovHubSession\(current, \{ persist: false \}\)/u,
  "expired or malformed HUB sessions must be rejected before Master Admin launch"
);
assert.match(ensureSource, /const refreshed = await fetchPortalData\(\);/u);

assert.match(
  edgeSource,
  /authenticate\(String\(input\.token \|\| ""\), \{ \.\.\.\(input\.payload \|\| \{\}\), authType: "hub_session" \}, "dbfStagingHandoffIssueV1"\)/u,
  "DBF handoff issue must remain HUB-session-only at the backend"
);
assert.match(
  actionSource,
  /payload\.authType !== "hub_session"/u,
  "frontend auth spoofing must not relax the DBF handoff contract"
);
assert.doesNotMatch(prepareSource, /roleKeys|business_data_admin|businessDataAdmin/u);

console.log("dbf Google-to-HUB session bridge contract: PASS");
