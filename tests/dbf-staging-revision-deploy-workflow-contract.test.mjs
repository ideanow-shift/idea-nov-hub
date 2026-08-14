import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflow = fs.readFileSync(path.join(root, ".github/workflows/dbf-staging-revision-deploy.yml"), "utf8");

test("DBF revision deploy is manual-only and bound to the staging target", () => {
  assert.match(workflow, /workflow_dispatch:/u);
  assert.doesNotMatch(workflow, /\n\s+(push|pull_request|schedule):/u);
  assert.match(workflow, /idea-nov-dbf-staging/u);
  assert.match(workflow, /787968950888/u);
  assert.match(workflow, /asia-northeast1/u);
  assert.match(workflow, /idea-nov-dbf-staging-ui/u);
  assert.match(workflow, /refs\/heads\/main/u);
  assert.match(workflow, /printf '%s' "\$EVENT_SHA" \| grep -Eq/u);
  assert.doesNotMatch(workflow, /test "\$EVENT_SHA" = "\$APPROVED_SOURCE_SHA"/u);
  assert.match(workflow, /DEPLOY_DBF_STAGING_REVISION_/u);
  assert.match(workflow, /DBF_PREFLIGHT \$label=\$actual/u);
  assert.match(workflow, /DBF preflight mismatch/u);
  assert.match(workflow, /assert_positive_integer rollback_max_instances/u);
});

test("DBF revision deploy uses immutable digest, zero-traffic validation, and rollback", () => {
  assert.match(workflow, /sha256:\[0-9a-f\]\{64\}/u);
  assert.match(workflow, /--no-traffic/u);
  assert.match(workflow, /--min=0/u);
  assert.match(workflow, /--max=1/u);
  assert.match(workflow, /status\.latestCreatedRevisionName/u);
  assert.match(workflow, /update-traffic/u);
  assert.match(workflow, /rollback_revision/u);
  assert.match(workflow, /if: failure\(\)/u);
});

test("DBF revision deploy preserves IAP, runtime identity, port, and private IAM", () => {
  assert.match(workflow, /run\.googleapis\.com\/iap-enabled/u);
  assert.match(workflow, /run\.googleapis\.com\/ingress/u);
  assert.match(workflow, /dbf-staging-ui-runtime@idea-nov-dbf-staging\.iam\.gserviceaccount\.com/u);
  assert.match(workflow, /containerPort/u);
  assert.match(workflow, /scaling\.minInstanceCount/u);
  assert.match(workflow, /scaling\.maxInstanceCount/u);
  assert.match(workflow, /run\.googleapis\.com\/minScale/u);
  assert.match(workflow, /run\.googleapis\.com\/maxScale/u);
  assert.match(workflow, /assert_eq min_instances "0" "\$min_instances"/u);
  assert.match(workflow, /test "\$max_instances" = "1"/u);
  assert.match(workflow, /allUsers/u);
  assert.match(workflow, /allAuthenticatedUsers/u);
  assert.doesNotMatch(workflow, /--allow-unauthenticated/u);
});
