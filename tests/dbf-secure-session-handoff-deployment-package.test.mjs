import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const migrationPath = "supabase/migrations/20260812105304_dbf_secure_session_handoff_store.sql";
const migration = read(migrationPath);
const workflow = read(".github/workflows/dbf-secure-session-handoff-validation.yml");
const portalApi = read("portal/js/api.js");
const managementApp = read("portal/management-app/app-v2.js");
const edgeRouter = read("supabase/functions/nov-hub-api/index.ts");
const browserBuild = path.join(root, "build/dbf-staging-pages");
const manifest = JSON.parse(read("review/dbf-secure-session-handoff-deployment-package-v1.json"));

assert.match(migration, /^begin;/u);
assert.match(migration, /commit;\s*$/u);
assert.doesNotMatch(migration, /\b(drop|truncate)\b/iu);
assert.equal((migration.match(/security definer/giu) || []).length, 0);
assert.match(migration, /alter table dbf_handoff\.codes force row level security/iu);
assert.match(migration, /revoke all on schema dbf_handoff from anon, authenticated/iu);
assert.match(migration, /grant execute on function public\.dbf_staging_handoff_consume_v1[\s\S]+to service_role/iu);

assert.equal(manifest.production.supabaseProjectRef, "nkmxevmioczcmnldreyo");
assert.equal(manifest.production.migrationSha256, crypto.createHash("sha256").update(migration.replaceAll("\r\n", "\n")).digest("hex"));
assert.equal(manifest.staging.supabaseProjectRef, "zgkoofphhivesclehrom");
assert.equal(manifest.production.edgeCurrentVersion, 120);
assert.equal(manifest.production.edgePlannedVersion, 121);
assert.equal(manifest.staging.cloudRunRollbackRevision, "idea-nov-dbf-staging-ui-00001-h74");
assert.deepEqual(Object.values(manifest.remoteOperations), [0, 0, 0, 0, 0, 0, 0]);

assert.match(workflow, /pull_request:/u);
assert.match(workflow, /workflow_dispatch:/u);
assert.match(workflow, /permissions:\s*\n\s*contents: read/u);
assert.match(workflow, /deno check supabase\/functions\/nov-hub-api\/index\.ts/u);
assert.match(workflow, /dbf-secure-session-handoff-fresh-postgres\.test\.mjs/u);
assert.doesNotMatch(workflow, /pull_request_target|id-token:\s*write|permissions:\s*write/iu);
assert.doesNotMatch(workflow, /google-github-actions|gcloud|docker push|cloud run deploy|supabase db push|supabase functions deploy/iu);
assert.doesNotMatch(workflow, /\$\{\{\s*secrets\./iu);
assert.match(portalApi, /setDbfStagingSessionAuth/u);
assert.match(portalApi, /authType: "dbf_staging_session"/u);
assert.match(managementApp, /setDbfStagingSessionAuth\(session\.sessionToken\)/u);
assert.match(edgeRouter, /DBF_STAGING_SESSION_AUDIENCE = "dbf_staging_session_v1"/u);
assert.match(edgeRouter, /DBF Staging session cannot access this action/u);

if (fs.existsSync(browserBuild)) {
  const files = fs.readdirSync(browserBuild, { recursive: true })
    .filter((entry) => fs.statSync(path.join(browserBuild, entry)).isFile());
  const browserText = files.map((entry) => read(path.join("build/dbf-staging-pages", entry))).join("\n");
  assert.doesNotMatch(browserText, /nkmxevmioczcmnldreyo/u);
  assert.doesNotMatch(browserText, /service_role|PRIVATE KEY|DB_PASSWORD/u);
}

process.stdout.write(`DBF secure handoff deployment package PASS (${crypto.createHash("sha256").update(migration).digest("hex")})\n`);
