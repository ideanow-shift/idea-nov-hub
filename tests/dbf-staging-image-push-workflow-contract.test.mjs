import assert from "node:assert/strict";
import fs from "node:fs";

const path = new URL("../.github/workflows/dbf-staging-image-push.yml", import.meta.url);
const workflow = fs.readFileSync(path, "utf8").replaceAll("\r\n", "\n");

assert.match(workflow, /^on:\n  workflow_dispatch:\n/mu);
assert.doesNotMatch(workflow, /^  (push|pull_request|pull_request_target|workflow_run|schedule|repository_dispatch):/mu);
assert.match(workflow, /^permissions:\n  contents: read\n  id-token: write\n/mu);
assert.match(workflow, /^    environment: dbf-business-data-staging$/mu);
assert.match(workflow, /EVENT_REPOSITORY_ID: \$\{\{ github\.repository_id \}\}/u);
assert.match(workflow, /EVENT_CONFIRMATION: \$\{\{ github\.event\.inputs\.confirmation \}\}/u);
assert.match(workflow, /PUSH_DBF_STAGING_IMAGE_8A24B4BD/u);
assert.match(workflow, /ref: 8a24b4bd12b00266e3717c650c2d93f48ba9df70/u);
assert.match(workflow, /persist-credentials: false/u);
assert.match(workflow, /workload_identity_provider: projects\/787968950888\/locations\/global\/workloadIdentityPools\/github-dbf-staging\/providers\/github-idea-nov-hub/u);
assert.match(workflow, /service_account: dbf-staging-deployer@idea-nov-dbf-staging\.iam\.gserviceaccount\.com/u);
assert.match(workflow, /IMAGE_URI: asia-northeast1-docker\.pkg\.dev\/idea-nov-dbf-staging\/idea-nov-dbf-staging-ui\/dbf-staging-ui:8a24b4bd12b00266e3717c650c2d93f48ba9df70/u);
assert.match(workflow, /docker build[\s\S]+--file deploy\/dbf-cloud-run-staging-bff-candidate\/Dockerfile[\s\S]+--tag "\$IMAGE_URI"/u);
assert.equal((workflow.match(/docker push "\$IMAGE_URI"/gu) || []).length, 1);
assert.match(workflow, /docker run --detach --name dbf-staging-image-candidate[\s\S]+"\$IMAGE_URI"/u);
assert.match(workflow, /gcloud artifacts repositories describe "\$ARTIFACT_REPOSITORY"/u);
assert.match(workflow, /gcloud artifacts docker images describe "\$IMAGE_URI"/u);
assert.match(workflow, /exact_tag_count.*"1"/u);
assert.match(workflow, /runtimeImport\.\*DISABLED/u);
assert.match(workflow, /productionWrite\.\*DISABLED/u);

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
