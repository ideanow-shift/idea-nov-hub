import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";

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

test("isolated Staging launcher uses Google popup bridge and issues only a HUB-session handoff", async () => {
  const app = await read("deploy/nov-hub-staging-ui/app.js");
  const auth = await read("deploy/nov-hub-staging-ui/auth-staging.js");
  const api = await read("deploy/nov-hub-staging-ui/api-client.js");
  const html = await read("deploy/nov-hub-staging-ui/index.html");
  assert.match(app, /beginGoogleLogin/);
  assert.match(auth, /signInWithPopup/);
  assert.doesNotMatch(auth, /signInWithRedirect/);
  assert.match(api, /novHubStagingAuth01SubjectBridgeV1/);
  assert.match(api, /Authorization.*Bearer/su);
  assert.match(api, /storeOperationsHandoffIssueV1/);
  assert.match(api, /authType:\s*"hub_session"/);
  assert.match(html, /店舗営業管理/);
  assert.doesNotMatch(html, /Magic Link|OTP/iu);
  assert.doesNotMatch(`${html}\n${app}\n${api}`, /pin-form|bootstrapWithPin|authType:\s*["']pin["']/iu);
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
  const files = ["index.html", "enrollment-bootstrap.js", "app.js", "api-client.js", "firebase-config.js", "auth-staging.js"];
  for (const file of files) {
    const source = await read(`deploy/nov-hub-staging-ui/dist/${file}`);
    assert.equal(source.includes("nkmxevmioczcmnldreyo"), false, file);
  }
});

test("enrollment fragment is scrubbed and held only in session storage across Google redirect", async () => {
  const html=await read("deploy/nov-hub-staging-ui/index.html");
  const bootstrap=await read("deploy/nov-hub-staging-ui/enrollment-bootstrap.js");
  const app=await read("deploy/nov-hub-staging-ui/app.js");
  assert.ok(html.indexOf("enrollment-bootstrap.js")<html.indexOf('type="module" src="./app.js"'));
  assert.match(bootstrap,/history\.replaceState/);
  assert.match(bootstrap,/fragment\.get\("enrollment"\)/);
  assert.match(bootstrap,/sessionStorage\.setItem/);
  assert.match(app,/delete globalThis\.__NOV_HUB_STAGING_ENROLLMENT__/);
  assert.match(app,/sessionStorage\.removeItem/);
  assert.doesNotMatch(`${bootstrap}\n${app}`,/localStorage|console\./u);
});

test("synchronous enrollment bootstrap scrubs the URL before module initialization", async () => {
  const bootstrap=await read("deploy/nov-hub-staging-ui/enrollment-bootstrap.js");
  const challenge="a".repeat(43);
  let replacement="";
  const values=new Map();
  const context={
    URLSearchParams,
    location:{hash:`#enrollment=${challenge}`,pathname:"/",search:"?store_operations_state=state"},
    history:{replaceState(_state,_title,url){replacement=url;}},
    sessionStorage:{
      getItem(key){return values.get(key)??null;},
      setItem(key,value){values.set(key,value);}
    }
  };
  runInNewContext(bootstrap,context);
  assert.equal(replacement,"/?store_operations_state=state");
  assert.equal(context.__NOV_HUB_STAGING_ENROLLMENT__,challenge);
  assert.equal(values.get("ideaNov.storeOperations.technicalAssumptionChallenge"),challenge);
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
    assert.match(ready.headers.get("content-security-policy"), /script-src 'self' https:\/\/www\.gstatic\.com https:\/\/apis\.google\.com/u);
    assert.deepEqual(await ready.json(), { ok: true });
    assert.equal((await fetch(`${origin}/unknown`)).status, 404);
    assert.equal((await fetch(origin, { method: "POST" })).status, 405);
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
});
