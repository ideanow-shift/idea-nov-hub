import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("../", import.meta.url);
const server = fs.readFileSync(new URL("deploy/dbf-cloud-run-staging-bff-candidate/server.mjs", root), "utf8");
const validation = fs.readFileSync(new URL(".github/workflows/dbf-secure-session-handoff-validation.yml", root), "utf8");
const imagePush = fs.readFileSync(new URL(".github/workflows/dbf-staging-image-push.yml", root), "utf8");
const manifest = JSON.parse(fs.readFileSync(new URL("review/dbf-cloud-run-ready-endpoint-corrective-v1.json", root), "utf8"));

assert.match(server, /pathname === "\/ready" && request\.method === "GET"/u);
assert.doesNotMatch(server, /pathname === "\/healthz"/u);
assert.match(server, /"content-type": "text\/plain; charset=utf-8"/u);
assert.match(server, /"cache-control": "no-store"/u);
assert.match(server, /response\.end\("ready\\n"\)/u);

for (const workflow of [validation, imagePush]) {
  assert.match(workflow, /127\.0\.0\.1:18080\/ready/u);
  assert.doesNotMatch(workflow, /127\.0\.0\.1:18080\/healthz[^\n]*= "200"/u);
}

assert.equal(manifest.environment, "staging");
assert.equal(manifest.target.projectId, "idea-nov-dbf-staging");
assert.equal(manifest.target.projectNumber, "787968950888");
assert.equal(manifest.target.service, "idea-nov-dbf-staging-ui");
assert.equal(manifest.readiness.path, "/ready");
assert.equal(manifest.readiness.port, 8080);
assert.equal(manifest.readiness.status, 200);
assert.equal(manifest.readiness.contentType, "text/plain");
assert.equal(manifest.readiness.cacheControl, "no-store");
assert.equal(manifest.deployment.startupProbePath, "/ready");
assert.equal(manifest.deployment.rollbackRevision, "idea-nov-dbf-staging-ui-00001-h74");

console.log("dbf cloud run ready endpoint contract: PASS");
