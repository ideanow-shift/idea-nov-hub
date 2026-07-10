# Decision Hub read-only live UI source candidate result 2026-07-11

## Result

CoreOS approved source candidate creation only.

Implemented source candidate:

- file: `portal/decision-hub/app.js`
- change: `DECISION_HUB_READONLY_LIVE = false` -> `true`
- publish: not executed
- UI write connection: not added

## Changed behavior candidate

Read-only UI will call only existing read-only Edge actions when published:

- `decisionListApplications`
- `decisionGetApplicationDetail`
- `decisionListComments`

## Checks

Passed:

- `node --check portal/decision-hub/app.js`
- `git diff --check -- portal/decision-hub/app.js portal/decision-hub/index.html`
- write action string scan
- no Supabase client literal in `portal/decision-hub/app.js`
- no `fetch(` literal in `portal/decision-hub/app.js`
- no `script.google.com` regression in `portal/decision-hub/app.js`
- no `service_role` literal in `portal/decision-hub/app.js`
- disabled buttons remain in `portal/decision-hub/index.html`

Notes:

- `token` appears only in sanitizer/error-message logic.
- No token value, Secret value, raw response, or credential is recorded.

## Disabled buttons confirmed

- `申請`
- `承認`
- `差戻し`
- `却下`

## Still not published

GitHub Pages/public JS reflection has not been executed.
This source candidate requires a separate frontend publish gate.

## Still stopped

- Edge deploy
- successful draft create retry
- B1 broader DML smoke
- DB direct RPC smoke
- UI write connection
- RLS / GRANT
- notification enqueue
- attachment / Storage
- Secret / service_role change
- role / employee_roles change
- portal_apps update
- os.notifications schema change
- rollback / drop

## Next CoreOS decision requested

Please confirm whether to proceed to frontend publish pack for the read-only live UI candidate:

```yaml
decision_hub_readonly_live_ui_frontend_publish_pack:
  source_candidate_done: true
  changed_file:
    - portal/decision-hub/app.js
  publish_requested_now: false
  next_requested_step:
    - frontend publish before-pack
    - public post-check plan
    - no write UI connection
```
