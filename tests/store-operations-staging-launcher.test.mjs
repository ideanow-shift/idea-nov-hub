import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const exec = promisify(execFile);
const root = resolve(import.meta.dirname, "..");
const read = (path) => readFile(resolve(root, path), "utf8");

test("Production Portal contains no Store Operations Staging launcher dependency", async () => {
  const production = `${await read("portal/js/main.js")}\n${await read("portal/js/api.js")}\n${await read("portal/js/firebase-config.js")}`;
  for (const forbidden of [
    "zgkoofphhivesclehrom",
    "idea-nov-store-operations-staging-ui-787968950888",
    "storeOperationsStagingUatEnabled",
    "createStoreOperationsStagingHandoff",
    "storeOperationsHandoffIssueV1"
  ]) assert.equal(production.includes(forbidden), false, forbidden);
});

test("isolated Staging launcher reuses formal login and issues only a HUB-session handoff", async () => {
  const app = await read("deploy/nov-hub-staging-ui/app.js");
  const api = await read("deploy/nov-hub-staging-ui/api-client.js");
  const html = await read("deploy/nov-hub-staging-ui/index.html");
  assert.match(app, /signInWithGoogle/);
  assert.match(api, /bootstrapWithPin/);
  assert.match(api, /storeOperationsHandoffIssueV1/);
  assert.match(api, /authType:\s*"hub_session"/);
  assert.match(html, /店舗営業管理/);
  assert.doesNotMatch(html, /Magic Link|OTP/iu);
  assert.doesNotMatch(`${app}\n${api}`, /service_role|HUB_APP_SESSION_SIGNING_SECRET/iu);
});

test("launcher transports only opaque code and state in the callback fragment", async () => {
  const app = await read("deploy/nov-hub-staging-ui/app.js");
  assert.match(app, /callback\.hash\s*=\s*new URLSearchParams\(\{ handoff_code: handoffCode, state: request\.state \}\)/);
  assert.doesNotMatch(app, /callback\.(?:search|searchParams).*sessionToken/su);
  assert.doesNotMatch(app, /console\.(?:log|info|warn|error)/u);
});

test("launcher build rejects Production project references", async () => {
  await exec(process.execPath, ["build.mjs"], { cwd: resolve(root, "deploy/nov-hub-staging-ui") });
  const files = ["index.html", "app.js", "api-client.js", "firebase-config.js", "auth.js"];
  for (const file of files) {
    const source = await read(`deploy/nov-hub-staging-ui/dist/${file}`);
    assert.equal(source.includes("nkmxevmioczcmnldreyo"), false, file);
  }
});

test("launcher server is static, no-store, framed off and has a readiness endpoint", async () => {
  process.env.NODE_ENV = "test";
  const { createNovHubStagingServer } = await import("../deploy/nov-hub-staging-ui/server.mjs");
  const server = createNovHubStagingServer();
  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    const ready = await fetch(`${origin}/ready`);
    assert.equal(ready.status, 200);
    assert.equal(ready.headers.get("cache-control"), "no-store");
    assert.equal(ready.headers.get("x-frame-options"), "DENY");
    assert.match(ready.headers.get("content-security-policy"), /https:\/\/identitytoolkit\.googleapis\.com/u);
    assert.deepEqual(await ready.json(), { ok: true });
    assert.equal((await fetch(`${origin}/unknown`)).status, 404);
    assert.equal((await fetch(origin, { method: "POST" })).status, 405);
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
});
