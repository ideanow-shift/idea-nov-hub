# Decision Hub read-only live UI connection before pack 2026-07-11

## Purpose

Decision Hub safe mock is already visible on GitHub Pages.
The next usability step is read-only UI connection only.

This pack asks CoreOS whether `portal/decision-hub/app.js` may switch:

```js
const DECISION_HUB_READONLY_LIVE = false;
```

to:

```js
const DECISION_HUB_READONLY_LIVE = true;
```

## Scope

Allowed candidate:

- `portal/decision-hub/app.js`
- one-line flag change only
- read-only list/detail/comments calls only
- no submit/save/approve/return/reject/cancel UI connection

Existing read-only actions:

- `decisionListApplications`
- `decisionGetApplicationDetail`
- `decisionListComments`

## Current public state

- GitHub Pages URL: `https://ideanow-shift.github.io/idea-nov-hub/decision-hub/`
- Static progress panel published.
- Safe mock labels remain visible.
- Action buttons remain disabled.
- `DECISION_HUB_READONLY_LIVE = false` on public JS.

## Intended user-visible change

After approval and publish:

- Application list can load through the existing read-only Edge/RPC path.
- Detail panel can load safe fields only.
- Comment panel can load visible comments only.
- Empty state remains safe if no records are visible.
- No production request can be submitted from the UI.

## Safety constraints

Must remain true:

- no write action buttons enabled
- no draft create from UI
- no submit / return / approve / reject / cancel from UI
- no attachment upload
- no notification enqueue
- no Storage signed URL
- no Secret / token / PIN / raw claims logging
- no `storage_path` / signed URL / raw original filename exposure
- no `os.notifications` schema change
- no `portal_apps` update

## Pre-check candidate

- Confirm changed file is `portal/decision-hub/app.js` only.
- Confirm diff is the one-line live flag change only.
- Confirm `portal/decision-hub/index.html` action buttons are still disabled.
- Confirm `portal/js/api.js` already includes read-only actions.
- Confirm public JS has no Secret / service_role / API key literal.

## Post-check candidate

- Public URL returns HTTP 200.
- Public `portal/decision-hub/app.js` contains `DECISION_HUB_READONLY_LIVE = true`.
- Public page still shows safe labels.
- Write buttons remain disabled.
- Read-only list empty/safe response is accepted.
- No raw response / token / PIN / raw claims are recorded.

## Still stopped

- successful draft create retry
- B1 broader DML smoke
- DB direct RPC smoke
- Edge deploy
- RLS / GRANT change
- notification enqueue
- attachment / Storage
- Secret / service_role change
- role / employee_roles change
- portal_apps update
- os.notifications schema change
- rollback / drop

## CoreOS decision requested

Please confirm whether Decision Hub may proceed with the one-line read-only UI live flag change:

```yaml
decision_hub_readonly_live_ui_connection:
  requested: true
  file: portal/decision-hub/app.js
  change: DECISION_HUB_READONLY_LIVE false -> true
  write_actions: still_disabled
  dml: none
  edge_deploy: none
  pages_publish: after_approval
```
