# GAS deployment retirement operator checklist

This checklist is for a separately approved production gate. It is not
permission to inspect credentials, open Script Properties, disable triggers, or
archive a deployment now.

## Current source/public prerequisite

The source/public side is already zero-GAS:

- tracked `gas-backend`: absent
- tracked `.gs`, `appsscript.json`, `.clasp.json`: 0
- public Education route: HTTP 200
- public HUB top `script.google.com` / `google.script.run` hits: 0
- `hub-zero-gas-source-fixture`: PASS `runtime=0 source=0`
- strict GAS exit source check: PASS

## Read-only evidence gate

Run only after explicit production-read-only approval.

Allowed evidence:

- `portal_apps` SELECT-only evidence row counts and fixed categories.
- Public route HTTP status categories for replacement pages.
- Apps Script deployment execution presence as fixed counts/categories for the
  approved observation window.
- Active trigger inventory by trigger type and handler category only.
- Ownership categories for LINE WORKS / notification delivery replacement.
- External-dependency categories for bookmarks, portal cards, scheduled jobs,
  and known integration owners.

Prohibited evidence:

- request/response bodies
- Script Properties
- deployment URLs if not already public and non-secret
- credentials, tokens, keys, cookies, session IDs
- user names, employee IDs, row data, business payload values
- raw execution logs or stack traces

Read-only terminal categories:

- `GAS_RETIREMENT_EVIDENCE_READY`
- `GAS_TRAFFIC_STILL_PRESENT`
- `GAS_TRIGGER_STILL_REQUIRED`
- `REPLACEMENT_ROUTE_NOT_READY`
- `DEPENDENCY_OWNER_NOT_READY`
- `EVIDENCE_CONTRACT_FAILED`

Any category other than `GAS_RETIREMENT_EVIDENCE_READY` stops the retirement
lane without disabling anything.

## Disable/archive execution gate

Run only after `GAS_RETIREMENT_EVIDENCE_READY` and a separate explicit
operator approval.

Execution order:

1. Freeze legacy GAS writes.
2. Confirm replacement route/read-only parity remains ready.
3. Disable time/event triggers first.
4. Verify disabled trigger count equals the approved active trigger count.
5. Disable/archive the Apps Script deployment.
6. Record only fixed sanitized result categories.
7. Leave deletion for a later destructive-retirement gate.

Execution terminal categories:

- `GAS_DEPLOYMENT_ARCHIVED_CLEAN`
- `TRIGGER_DISABLE_NOT_EXACT`
- `DEPLOYMENT_ARCHIVE_NOT_EXACT`
- `POST_ARCHIVE_OBSERVATION_NOT_EXACT`
- `RETIREMENT_ACTION_ABORTED_SAFE_STOP`

## Stop conditions

- any unexpected traffic to the deployment
- any still-active portal/app/scheduled dependency
- replacement route not HTTP 200
- trigger count mismatch
- credential/Secret ambiguity
- request to inspect Script Properties or raw logs
- need to delete rather than disable/archive
- user-visible product behavior regression

No production DML, database schema change, notification send, Secret rotation,
or destructive deletion is authorized by this checklist.
