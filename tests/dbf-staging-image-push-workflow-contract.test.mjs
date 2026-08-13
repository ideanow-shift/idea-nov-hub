import assert from "node:assert/strict";
import fs from "node:fs";

const path = new URL("../.github/workflows/dbf-staging-image-push.yml", import.meta.url);
const workflow = fs.readFileSync(path, "utf8").replaceAll("\r\n", "\n");

assert.match(workflow, /^on:\n  workflow_dispatch:\n/mu);
assert.doesNotMatch(workflow, /^  (push|pull_request|pull_request_target|workflow_run|schedule|repository_dispatch):/mu);
assert.match(workflow, /^      source_sha:\n[\s\S]*?required: true\n[\s\S]*?type: string$/mu);
assert.match(workflow, /^permissions:\n  contents: read\n  id-token: write\n/mu);
assert.match(workflow, /^    environment: dbf-business-data-staging$/mu);
assert.match(workflow, /EVENT_REPOSITORY_ID: \$\{\{ github\.repository_id \}\}/u);
assert.match(workflow, /EVENT_SHA: \$\{\{ github\.sha \}\}/u);
assert.match(workflow, /EVENT_CONFIRMATION: \$\{\{ github\.event\.inputs\.confirmation \}\}/u);
assert.match(workflow, /test "\$EVENT_SHA" = "\$APPROVED_SOURCE_SHA"/u);
assert.match(workflow, /grep -Eq '\^\[0-9a-f\]\{40\}\$'/u);
assert.match(workflow, /PUSH_DBF_STAGING_IMAGE_\$APPROVED_SOURCE_SHA/u);
assert.match(workflow, /ref: \$\{\{ github\.event\.inputs\.source_sha \}\}/u);
assert.match(workflow, /persist-credentials: false/u);
assert.match(workflow, /workload_identity_provider: projects\/787968950888\/locations\/global\/workloadIdentityPools\/github-dbf-staging\/providers\/github-idea-nov-hub/u);
assert.match(workflow, /service_account: dbf-staging-deployer@idea-nov-dbf-staging\.iam\.gserviceaccount\.com/u);
assert.match(workflow, /IMAGE_URI: asia-northeast1-docker\.pkg\.dev\/idea-nov-dbf-staging\/idea-nov-dbf-staging-ui\/dbf-staging-ui:\$\{\{ github\.event\.inputs\.source_sha \}\}/u);
assert.match(workflow, /docker build[\s\S]+--file deploy\/dbf-cloud-run-staging-bff-candidate\/Dockerfile[\s\S]+--tag "\$IMAGE_URI"/u);
assert.equal((workflow.match(/docker push "\$IMAGE_URI"/gu) || []).length, 1);
assert.match(workflow, /docker run --detach --name dbf-staging-image-candidate[\s\S]+"\$IMAGE_URI"/u);
assert.match(workflow, /gcloud artifacts repositories describe "\$ARTIFACT_REPOSITORY"/u);
assert.match(workflow, /gcloud artifacts docker images describe "\$IMAGE_URI"/u);
assert.match(workflow, /exact_tag_count.*"1"/u);
assert.match(workflow, /runtimeImport\.\*DISABLED/u);
assert.match(workflow, /productionWrite\.\*DISABLED/u);
assert.match(workflow, /http:\/\/127\.0\.0\.1:18080\/ready/u);
assert.match(workflow, /http:\/\/127\.0\.0\.1:18080\/ready\//u);
assert.match(workflow, /http:\/\/127\.0\.0\.1:18080\/healthz\)" = "404"/u);

const runtimeSmokeStart = workflow.indexOf("      - name: Run the exact image and verify runtime");
const runtimeSmokeEnd = workflow.indexOf("      - name: Push the verified image exactly once");
assert.ok(runtimeSmokeStart >= 0 && runtimeSmokeEnd > runtimeSmokeStart);
const runtimeSmoke = workflow.slice(runtimeSmokeStart, runtimeSmokeEnd);
const forbiddenCurlPipelines = runtimeSmoke
  .split("\n")
  .filter((line) => /\bcurl\b.*\|.*\b(?:grep|head|sed)\b/u.test(line));

assert.deepEqual(forbiddenCurlPipelines, []);
assert.match(runtimeSmoke, /MANAGEMENT_BODY="\$RUNNER_TEMP\/dbf-runtime-management\.html"/u);
assert.match(runtimeSmoke, /APP_V2_BODY="\$RUNNER_TEMP\/dbf-runtime-app-v2\.js"/u);
assert.match(runtimeSmoke, /trap 'rm -f "\$\{runtime_response_files\[@\]\}"' EXIT/u);
assert.match(runtimeSmoke, /--output "\$MANAGEMENT_BODY"[\s\S]+--write-out '%\{http_code\}'/u);
assert.match(runtimeSmoke, /test "\$management_http_code" = "200"/u);
assert.match(runtimeSmoke, /test -s "\$MANAGEMENT_BODY"/u);
assert.match(runtimeSmoke, /grep --fixed-strings --quiet 'BASSA GROUP 経営管理ダッシュボード' "\$MANAGEMENT_BODY"/u);
assert.match(runtimeSmoke, /--output "\$APP_V2_BODY"[\s\S]+--write-out '%\{http_code\}'/u);
assert.match(runtimeSmoke, /test "\$app_v2_http_code" = "200"/u);
assert.match(runtimeSmoke, /test -s "\$APP_V2_BODY"/u);
assert.match(runtimeSmoke, /grep --fixed-strings --quiet 'STAGING' "\$APP_V2_BODY"/u);
assert.match(runtimeSmoke, /grep --fixed-strings --quiet 'HUBログインが必要です' "\$APP_V2_BODY"/u);
assert.doesNotMatch(runtimeSmoke, /\|\| true/u);
assert.doesNotMatch(runtimeSmoke, /\b(?:cat|tee)\b[^\n]*\$(?:MANAGEMENT_BODY|APP_V2_BODY)/u);

for (const pin of [
  "actions/checkout@11d5960a326750d5838078e36cf38b85af677262",
  "google-github-actions/auth@c200f3691d83b41bf9bbd8638997a462592937ed",
  "google-github-actions/setup-gcloud@aa5489c8933f4cc7a4f7d45035b3b1440c9c10db"
]) assert.match(workflow, new RegExp(pin.replaceAll("/", "\\/"), "u"));

for (const forbidden of [
  "gcloud run deploy",
  "gcloud run services update",
  "gcloud run services update-traffic",
  "gcloud services enable",
  "add-iam-policy-binding",
  "set-iam-policy",
  "supabase db push",
  "supabase functions deploy",
  "actions/deploy-pages",
  "actions/upload-artifact",
  "dbf-staging-ui:latest"
]) assert.doesNotMatch(workflow, new RegExp(forbidden.replaceAll("/", "\\/"), "iu"));

for (const forbiddenPermission of [
  "contents: write",
  "packages: write",
  "deployments: write",
  "actions: write",
  "pull-requests: write",
  "issues: write"
]) assert.doesNotMatch(workflow, new RegExp(forbiddenPermission, "u"));

console.log("dbf staging image push workflow contract: PASS");
