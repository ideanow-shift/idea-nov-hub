import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const callback = readFileSync("deploy/store-operations-staging-ui/auth-callback-entry.js", "utf8");
const sessionRefresh = readFileSync("deploy/store-operations-staging-ui/staging-session-refresh-entry.js", "utf8");
const build = readFileSync("deploy/store-operations-staging-ui/build.mjs", "utf8");
const server = readFileSync("deploy/store-operations-staging-ui/server.mjs", "utf8");
const app = readFileSync("portal/store-sales/app.js", "utf8");

test("callback uses native Staging Supabase session and a fixed destination", () => {
  assert.match(callback, /createClient/);
  assert.match(callback, /detectSessionInUrl: true/);
  assert.match(callback, /supabase\.auth\.getSession\(\)/);
  assert.match(callback, /location\.replace\(FIXED_DESTINATION\)/);
  assert.doesNotMatch(callback, /URLSearchParams|access_token\s*=|service_role|nkmxevmioczcmnldreyo/);
});

test("hosted app restores and verifies the persisted Staging Auth session", () => {
  assert.match(sessionRefresh, /detectSessionInUrl: false/);
  assert.match(sessionRefresh, /persistSession: true/);
  assert.match(sessionRefresh, /supabase\.auth\.getSession\(\)/);
  assert.match(sessionRefresh, /supabase\.auth\.getUser\(session\.access_token\)/);
  assert.match(sessionRefresh, /STORE_SALES_SESSION_REFRESHER/);
  assert.match(app, /refreshSession: typeof globalThis\.STORE_SALES_SESSION_REFRESHER/);
  assert.match(build, /staging-session-refresh\.js/);
  assert.doesNotMatch(sessionRefresh, /employeeId|storeId|scopeMode|roleKey|service_role|nkmxevmioczcmnldreyo/);
});

test("browser build is Staging-only and strips Production configuration", () => {
  assert.match(build, /runtime-config\.production\.js/);
  assert.match(build, /PRODUCTION_REF_IN_BROWSER_BUILD/);
  assert.match(build, /zgkoofphhivesclehrom/);
  assert.doesNotMatch(callback, /employeeId|storeId|scopeMode|roleKey/);
});

test("Cloud Run shell blocks caching, framing and non-fixed callback routing", () => {
  assert.match(server, /Cache-Control\": \"no-store/);
  assert.match(server, /frame-ancestors 'none'/);
  assert.match(server, /pathname === "\/auth\/callback" \? types\["\.html"\]/);
  assert.match(server, /pathname === \"\/auth\/callback\"/);
  assert.match(server, /Location:\"\/store-sales\/\"/);
});
