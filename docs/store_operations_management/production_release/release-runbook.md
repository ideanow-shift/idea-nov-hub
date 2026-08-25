# Production Owner-only Pilot Release Runbook

This document is not authorization to execute any Production step.

1. Re-run the Production catalog preflight and freeze exact checksums.
2. Obtain Owner approval for the exact release SHA, four migrations and deployment units.
3. Apply the four migrations in the frozen order.
4. Read back schema, RLS/FORCE RLS, ACLs, functions and zero business rows written by release.
5. Verify Edge secret/config names and bindings without revealing values.
6. Confirm rollout config is exactly `DISABLED` before deploying `nov-hub-api`.
7. Deploy the approved API source and verify liveness/readiness plus target project.
8. Confirm the formal NOV HUB → AUTH-01 → canonical Employee → Role → M019 Assignment → Scope chain.
9. Publish the approved frontend; remove Staging entry files before artifact upload.
10. Verify unauthenticated and all authenticated Store Operations access is denied while `DISABLED`.
11. Under a separate Owner approval, set `OWNER_PILOT` with exactly one canonical Owner employee UUID.
12. Run Owner Hosted Smoke: HTTP 200, 20 official stores, unauthorized stores zero, business writes zero.
13. Append evidence and stop. Do not select `GENERAL`.

`GENERAL` requires separate Owner approval and completed Toda/Masumoto real-user UAT.
