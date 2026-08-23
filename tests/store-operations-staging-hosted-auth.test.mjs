import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const build = readFileSync("deploy/store-operations-staging-ui/build.mjs", "utf8");
const server = readFileSync("deploy/store-operations-staging-ui/server.mjs", "utf8");
const packageJson = readFileSync("deploy/store-operations-staging-ui/package.json", "utf8");
const index = readFileSync("supabase/functions/nov-hub-api/index.ts", "utf8");

test("hosted Store Operations has no independent login or browser Supabase Auth", () => {
  assert.equal(existsSync("deploy/store-operations-staging-ui/auth-callback-entry.js"), false);
  assert.equal(existsSync("deploy/store-operations-staging-ui/auth-callback.html"), false);
  assert.equal(existsSync("deploy/store-operations-staging-ui/staging-session-refresh-entry.js"), false);
  assert.equal(existsSync("deploy/store-operations-staging-ui/staging-handoff-entry.js"), true);
  assert.doesNotMatch(build, /auth\/callback|staging-session-refresh|supabase-js|access_token|refresh_token/i);
  assert.doesNotMatch(server, /auth\/callback|access_token|refresh_token/i);
  assert.doesNotMatch(packageJson, /@supabase\/supabase-js|auth-js/i);
});

test("backend exposes no Store Operations Auth onboarding action", () => {
  assert.doesNotMatch(index, /storeOperationsUatOnboardV1|onboardStoreOperationsUatUser|\/auth\/v1\/otp|\/auth\/v1\/admin\/users/);
  assert.doesNotMatch(index, /STORE_OPERATIONS_UAT_ONBOARDING_SECRET|verifyNativeStagingAuthSubject/);
});

test("browser build remains Staging-only and fail-closed on NOV HUB session", () => {
  assert.match(build, /requireHubSession:true/);
  assert.match(build, /runtime-config\.production\.js/);
  assert.match(build, /PRODUCTION_REF_IN_BROWSER_BUILD/);
  assert.match(build, /\/api\/store-operations/);
  assert.match(build, /const forbidden = "nkmxevmioczcmnldreyo"/);
});

test("Cloud Run shell blocks caching, framing and callback routing", () => {
  assert.match(server, /\"Cache-Control\"\s*:\s*\"no-store\"/);
  assert.match(server, /frame-ancestors 'none'/);
  assert.doesNotMatch(server, /pathname === \"\/auth\/callback\"/);
  assert.match(server, /Location:\"\/store-sales\/\"/);
});
