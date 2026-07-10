# Decision Hub read-only live frontend publish before pack 2026-07-11

## Purpose

Prepare the publish gate for Decision Hub read-only live UI connection.

This is a before-pack only.
GitHub Pages publish execution is not approved in this pack.

## CoreOS decision received

```yaml
decision_hub_readonly_live_source_candidate: accepted
frontend_publish_before_pack_creation: approved
frontend_publish_execution: not_yet_approved
edge_deploy: not_approved
write_connection: not_approved
```

## Candidate commit

- commit: `183c2be Prepare Decision Hub read-only live UI`
- changed runtime file: `portal/decision-hub/app.js`
- change: `DECISION_HUB_READONLY_LIVE = false` -> `true`
- companion result doc: `docs/decision-hub-readonly-live-ui-source-candidate-result-20260711.md`

## Publish scope

Allowed publish target candidate:

- `portal/decision-hub/app.js`

No other runtime file should be newly changed for this gate.

## Intended behavior after publish

- Decision Hub page may load existing read-only actions.
- The screen remains read-only.
- Empty/no-data response is safe.
- Detail/comments load only through existing read-only safe path.

Existing read-only actions:

- `decisionListApplications`
- `decisionGetApplicationDetail`
- `decisionListComments`

## Not included

- Edge deploy
- Edge source change
- `portal/js/api.js` change
- submit / draft save / approve / return / reject / cancel UI connection
- attachment UI
- notification enqueue
- Storage / signed URL
- Secret / service_role / role change
- `portal_apps` update
- `os.notifications` schema change

## Pre-publish checks

Run before any publish execution:

```text
git status --short
git diff HEAD -- portal/decision-hub/app.js
node --check portal/decision-hub/app.js
git diff --check -- portal/decision-hub/app.js portal/decision-hub/index.html
```

Required checks:

- changed runtime file is only `portal/decision-hub/app.js`
- diff is only `DECISION_HUB_READONLY_LIVE false -> true`
- `portal/decision-hub/index.html` write buttons remain disabled
- `portal/decision-hub/app.js` has no `fetch(`
- `portal/decision-hub/app.js` has no Supabase client literal
- `portal/decision-hub/app.js` has no `script.google.com`
- `portal/decision-hub/app.js` has no `service_role`
- no Secret / token value / raw claims / raw response logging

## Public publish execution candidate

Not approved yet.

If approved later:

```text
git push
```

or the approved GitHub Pages publish path for this repo.

## Public post-check plan

After approval and publish execution:

- public URL returns HTTP 200
- public `portal/decision-hub/app.js` contains `DECISION_HUB_READONLY_LIVE = true`
- public page still contains `設計中 / DB未接続`
- public page still contains `本番申請はまだ送信されません`
- write buttons remain disabled:
  - `申請`
  - `承認`
  - `差戻し`
  - `却下`
- no `script.google.com`
- no Supabase client literal
- no `service_role`
- no Secret / API key exposure
- no write action call from Decision Hub UI

## Read-only smoke plan

After public publish:

- open signed-in NOV HUB session
- open Decision Hub page
- confirm read-only list load attempt
- record only safe result:
  - HTTP/safe status category
  - list visible / empty / safe error
  - forbidden exposure boolean
- do not record:
  - token
  - PIN
  - raw claims
  - raw response
  - employee id
  - application id
  - comment body real value

## Rollback candidate

Rollback source change candidate:

```diff
- const DECISION_HUB_READONLY_LIVE = true;
+ const DECISION_HUB_READONLY_LIVE = false;
```

Rollback execution is a separate gate.

## Still stopped

- GitHub Pages publish execution
- Edge deploy
- successful draft create retry
- UI write connection
- RLS / GRANT
- notification enqueue
- Storage / attachment
- Secret / service_role change
- role / employee_roles change
- portal_apps update
- os.notifications schema change
- rollback / drop

## CoreOS decision requested

Please confirm whether to proceed to frontend publish limited execution:

```yaml
decision_hub_readonly_live_frontend_publish_execution:
  requested: true
  source_commit: 183c2be
  runtime_file:
    - portal/decision-hub/app.js
  intended_change:
    - DECISION_HUB_READONLY_LIVE true
  write_actions: disabled
  edge_deploy: none
  secret_change: none
  rollback_separate_gate: true
```
