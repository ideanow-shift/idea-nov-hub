import assert from "node:assert/strict";
import { request as httpRequest } from "node:http";
import { fileURLToPath } from "node:url";
import { canonicalManagementTarget } from "../deploy/dbf-cloud-run-staging-bff-candidate/canonical-navigation.js";
import { createDbfStagingServer } from "../deploy/dbf-cloud-run-staging-bff-candidate/server.mjs";

function rawRequest(port, path, options = {}) {
  return new Promise((resolve, reject) => {
    const request = httpRequest({ hostname: "127.0.0.1", port, path, method: options.method || "GET", headers: options.headers || {} }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { body += chunk; });
      response.on("end", () => resolve({ status: response.statusCode, headers: response.headers, body }));
    });
    request.on("error", reject);
    if (options.body) request.write(options.body);
    request.end();
  });
}

assert.equal(canonicalManagementTarget(""), "/management-app/index.html#businessdata");
assert.equal(canonicalManagementTarget("#businessdata"), "/management-app/index.html#businessdata");
assert.equal(
  canonicalManagementTarget("#handoff_code=code_123&state=state_456&redirect=https%3A%2F%2Fevil.example"),
  "/management-app/index.html#handoff_code=code_123&state=state_456"
);

const server = createDbfStagingServer({
  staticRoot: fileURLToPath(new URL("../build/dbf-staging-pages", import.meta.url)),
  fetchJwks: async () => ({ keys: [] }),
  exchangeWithHubBackend: async () => { throw new Error("exchange must remain fail-closed"); }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
try {
  const { port } = server.address();
  const root = await rawRequest(port, "/");
  assert.equal(root.status, 200);
  assert.match(root.body, /src="\/dbf-staging-canonical-navigation\.js"/u);
  assert.doesNotMatch(root.body, /http-equiv="refresh"/iu);

  const canonicalRedirect = await rawRequest(port, "/management-app");
  assert.equal(canonicalRedirect.status, 308);
  assert.equal(canonicalRedirect.headers.location, "/management-app/");

  const directoryIndex = await rawRequest(port, "/management-app/");
  assert.equal(directoryIndex.status, 200);
  assert.match(directoryIndex.body, /BASSA GROUP 経営管理ダッシュボード/u);
  const explicitIndex = await rawRequest(port, "/management-app/index.html");
  assert.equal(explicitIndex.status, 200);
  assert.equal(explicitIndex.body, directoryIndex.body);

  const css = await rawRequest(port, "/management-app/styles.css");
  assert.equal(css.status, 200);
  assert.match(css.headers["content-type"], /^text\/css/u);
  const app = await rawRequest(port, "/management-app/app-v2.js");
  assert.equal(app.status, 200);
  assert.match(app.headers["content-type"], /^text\/javascript/u);
  const preview = await rawRequest(port, "/management-app/business-data-management-preview.js");
  assert.equal(preview.status, 200);
  assert.match(preview.headers["content-type"], /^text\/javascript/u);

  assert.equal((await rawRequest(port, "/management-app/management-app/")).status, 404);
  assert.equal((await rawRequest(port, "/unknown-path")).status, 404);
  assert.equal((await rawRequest(port, "/%2e%2e/secret")).status, 400);
  assert.equal((await rawRequest(port, "/management-app/%2e%2e/secret")).status, 400);
  assert.equal((await rawRequest(port, "/management-app/%00secret")).status, 400);
  assert.equal((await rawRequest(port, "/management-app/%5c..%5csecret")).status, 400);

  const readiness = await rawRequest(port, "/ready");
  assert.equal(readiness.status, 200);
  assert.equal(readiness.headers["content-type"], "text/plain; charset=utf-8");
  assert.equal(readiness.headers["cache-control"], "no-store");
  assert.equal(readiness.body, "ready\n");
  assert.equal((await rawRequest(port, "/ready/")).status, 404);
  assert.equal((await rawRequest(port, "/healthz")).status, 404);
  assert.equal((await rawRequest(port, "/ready", { method: "POST" })).status, 405);
  const malformed = await rawRequest(port, "/session/handoff/exchange", {
    method: "POST",
    headers: { "content-type": "application/json", "content-length": "1" },
    body: "{"
  });
  assert.equal(malformed.status, 401);
} finally {
  await new Promise((resolve) => server.close(resolve));
}

console.log("dbf cloud run canonical routing: PASS");
