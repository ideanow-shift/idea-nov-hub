# GAS deployment retirement operator checklist

This checklist is for a separately approved production gate. It is not permission to inspect credentials or disable anything now.

## Read-only evidence

- Run the SELECT-only `portal_apps` evidence query and record row counts plus non-secret URLs.
- Confirm source/public scans show zero GAS runtime references after the approved frontend publish.
- Check Apps Script deployment execution presence for a CoreOS-approved observation window without recording request bodies, user values, or Script Properties.
- Inventory active time/event triggers by trigger type and handler name only.
- Confirm LINE WORKS delivery ownership has moved before disabling notification-related triggers.
- Confirm no bookmark, portal card, external system, or scheduled job still targets the deployment.

## Separate execution gates

1. Freeze GAS writes.
2. Complete final data delta and verify counts/business keys.
3. Switch the approved frontend/API routes.
4. Observe the new runtime.
5. Disable triggers.
6. Rotate affected credentials without recording values in artifacts.
7. Disable the Apps Script deployment.
8. Delete only after a later destructive-retirement approval.

Any unexpected traffic, dependency, failed parity check, or credential ambiguity is a stop condition.
