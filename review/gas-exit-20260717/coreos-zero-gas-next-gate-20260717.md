# CoreOS review request: HUB zero-GAS next gate

Date: 2026-07-17
Fresh baseline: `fcc60a12daf06290a00df17fa724bd9effe1a2e2`
Local source commits: `ba18daf` then `6f5fb6f`
Push/publish/deployment actions: 0

## Completed locally

### Commit `ba18daf`: Education new-Web runtime candidate

- Added `portal/education-app/` with staff, store manager, and education admin views.
- Changed both Education fallback routes to `./education-app/`.
- Removed the IDEA LINK legacy GAS deployment ID classifier while retaining stable app ID/name/local route checks.
- All six Education write controls remain disabled.
- No API, GAS, Supabase client, browser storage, credential, notification, or Storage integration.
- Canonical committed `app.js` SHA-256: `f7fc67dd71588c479b09b39cc5b969c9d58beada6a3ac2a7ff5cfd953e8e40e6`.

### Commit `6f5fb6f`: tracked GAS backend retirement candidate

- Deleted the four tracked files under `gas-backend/`.
- Added strict fixture requiring runtime GAS references = 0 and tracked GAS source = 0.
- Did not disable/delete an Apps Script deployment or trigger.
- Did not access or change Script Properties, Secrets, production data, database objects, roles, or notifications.

## Verification

- `education-app-static-fixture`: `12/12 PASS`.
- `hub-zero-gas-source-fixture`: `PASS runtime=0 source=0`.
- Node syntax: PASS.
- `git diff --check`: PASS.
- Desktop rendering: PASS.
- Mobile width: `scrollWidth == innerWidth`.
- Staff/store/admin tab transitions: PASS.
- Enabled write controls inside operational panels: 0.
- Management upstream drift was preserved during automatic rebase.

## Required CoreOS decisions

1. **Education frontend publish:** publishing `ba18daf` changes the Education HUB card from the functioning GAS app to a DB-unconnected new-Web screen. Approve only if this temporary functional reduction is acceptable, or hold until read APIs are ready.
2. **GAS source deletion:** approve `6f5fb6f` for Git publication only after production evidence confirms no remaining consumer depends on the Apps Script deployment.
3. **Production evidence lane:** authorize read-only evidence for `portal_apps` Education/IDEA LINK URLs, current Apps Script deployments, trigger inventory, and recent execution presence. Do not record credential values or business data.
4. **Education Phase1 ownership:** confirm that the first live slice is HUB identity -> my assignments -> content -> progress -> completion. KPI, promotion/debut, interview/motivation, and notifications remain separate ownership gates.

## Recommended sequence

1. Keep both commits local while CoreOS reviews.
2. Approve source-level GAS deletion independently from deployment shutdown.
3. Build Education read APIs and server-side role/scope enforcement before switching the public card, unless a static migration screen is explicitly accepted.
4. After read/write parity is verified, switch `portal_apps`, publish the frontend, observe, disable triggers, rotate affected credentials, and finally retire the Apps Script deployment in separate gates.

## Still stopped

- Git push and GitHub Pages publish.
- `portal_apps` update.
- Apps Script deployment/trigger/Secret changes.
- Education DB DDL/RLS/RPC/GRANT/DML.
- Education Edge deploy and live session/data smoke.
- Notification/LINE WORKS sends and Storage changes.
