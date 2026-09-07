# Store Operations V1 Production Release Manifest

Status: `PRODUCTION_READINESS_CORRECTIVE / NO DEPLOY`

| Field | Frozen value |
|---|---|
| Portfolio Lock | `CTO-PORTFOLIO-EXECUTION-ORDER-2026-08-22-V4` |
| Current Phase | `PHASE_3_STORE_OPERATIONS_MANAGEMENT_V1` |
| Source main SHA | `237ff704aef71f28ad79972d4e4724a4229729c6` |
| Production project | `idea-nov-core` / `nkmxevmioczcmnldreyo` |
| Production current API | `nov-hub-api v127` |
| API rollback SHA | `3d7f46c34c6a2d11318bed859973127fdb2047f53f7b0f8de37ea3df341ccf69` |
| Target API tree | `282c408c834c37a5ff130e8d9e30a07f319a8ae8` plus this corrective PR |
| Target frontend tree | `14a5c872ef845b26d9fc61d7a039a545df3ee0f7` plus this corrective PR |
| Technical UAT | `COMPLETE` |
| Real User UAT | `DEFERRED` |
| UAT runtime | `PRODUCTION EXCLUDED` |
| Production GA | `BLOCKED` |
| Business Data write | 0 |
| Data copy | 0 |

## Release units

1. Apply only the four checksum-frozen migrations in `database-preflight.md` after separate Owner approval.
2. Deploy `nov-hub-api` from the approved release SHA only after DB and Secret/IAM preflight.
3. Configure server-only `STORE_OPERATIONS_PRODUCTION_ROLLOUT_STATE=DISABLED` before deploy. Missing or unknown configuration denies access.
4. Configure `STORE_OPERATIONS_OWNER_PILOT_EMPLOYEE_ID` only for a separately approved `OWNER_PILOT`; it must be one canonical employee UUID, never an email.
5. `LIMITED_REAL_USER_PILOT` requires the Owner ID plus exactly two distinct server-only canonical employee IDs in `STORE_OPERATIONS_REAL_USER_PILOT_EMPLOYEE_ID_1` and `_2`. Missing, malformed, duplicate, or Owner-reused values fail closed. The allowlist never supplies Role, Scope, or Store IDs; the Production resolver remains authoritative.
6. Publish `portal/store-sales` through the exact-SHA Pages workflow; Staging entry assets are removed before upload.
7. Use the existing `store-sales-management` card and route; no duplicate app registration.

## Required API secret/config names

- Default platform environment: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (or separately approved migration to `SUPABASE_SECRET_KEYS`).
- Existing NOV HUB contract: `HUB_APP_SESSION_SIGNING_SECRET`.
- Rollout: `STORE_OPERATIONS_PRODUCTION_ROLLOUT_STATE`.
- Owner pilot only: `STORE_OPERATIONS_OWNER_PILOT_EMPLOYEE_ID`.
- Limited real-user pilot only: `STORE_OPERATIONS_REAL_USER_PILOT_EMPLOYEE_ID_1` and `STORE_OPERATIONS_REAL_USER_PILOT_EMPLOYEE_ID_2`.

Secret values are never committed, displayed or supplied by the browser.

Read-only secret-name inventory confirms `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEYS`, `FIREBASE_API_KEY` and `HUB_APP_SESSION_SIGNING_SECRET` exist. Rollout values are environment-owned, are never frozen in Git, and require separate Owner approval for each Production change. Supabase Edge is the API runtime; Production Cloud Run is not required for Store Operations.

## Production exclusion

UAT principals, technical assumption, UAT enrollment/external binding/audit, Staging launcher, Staging Firebase bridge, Staging secrets and Staging project fallbacks are not Production authorities. Production runtime rejects Staging/UAT sessions and routes before Store Operations authorization.

## Current gate

The rollout code is promotion-ready. Production remains blocked until the four DB migrations, exact Secret/IAM bindings, formal AUTH-01/M019 identity/role/assignment population and separate Owner release approval are read back successfully.
