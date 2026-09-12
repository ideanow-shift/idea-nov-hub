# Employee directory launch corrective — 2026-09-12

- LOCK_ID: CTO-PORTFOLIO-EXECUTION-ORDER-2026-08-22-V4
- CURRENT_PHASE: PHASE_3_STORE_OPERATIONS_MANAGEMENT_V1
- Scope: existing HUB Core Employee Master authorization/UI contract maintenance.
- Store Operations retains priority. No phase, role definition, schema or employee data changes.
- Baseline main: 6bd719048a82c02e99341b7eb0c81fdcc65149fa (PR #205).

## Finding

The reported user's active assignments include area_manager, idea_link.staff and hr.viewer.
Only active status and role keys were inspected; no credentials were read.
The API maps these roles to level 3. Its fixed core-master-admin entry requires level 4.
Production has no portal_apps row for core-master-admin/master-admin, so the fixed entry is used.
The production nov-hub-api v145 index.ts matches baseline main.

Two filters drop an already authorized directory viewer:
1. API canAccessApp rejects the level-3 user despite canViewMasterAdmin granting hr.viewer.
2. HUB selectReleasedAppsForEmployee drops the Master Admin app for hr.viewer.
NOV NAVI independently displays the directory card, then labels it coming_soon when its app is absent.

## Correction

- For the two existing Master Admin app IDs only, hr.viewer satisfies the API's level gate.
- Active user/app and configured tag/department/position restrictions remain enforced.
- HUB preserves the server-returned directory for an explicit hr.viewer role; display tags alone do not qualify.
- No client app fallback is added.
- Master Admin edit authorization is unchanged.
- main.js cache key is advanced.

## Verification

- Node regression command: 12 tests passed, zero failures:
  node --test tests/nov-navi-dashboard-boundary.test.mjs tests/store-operations-hub-integration.test.mjs tests/master-admin-employee-name-edit-contract.test.mjs tests/master-admin-emergency-contact-contract.test.mjs tests/master-admin-navigation-contract.test.mjs
- New directory pipeline fixture executes the actual API and HUB filter functions together.
  Covers reported role combination, level-1 hr.viewer, executive/admin, unauthorized staff,
  tag-only role claims, inactive user/app, configured restrictions and absent server app.
- node --check portal/js/main.js: PASS.
- deno check supabase/functions/nov-hub-api/index.ts: PASS.
- git diff --check: PASS.
- The existing NOV NAVI CI test imports the new pipeline fixture.

## Isolated Staging

- Project: idea-nov-staging (zgkoofphhivesclehrom).
- Function: nov-hub-directory-staging v1.
- Bundle SHA256: 0c125c248ca62ac307808da59010d21515726c71be974cc602cdb0cce03397b5.
- Uses production baseline files plus this API patch.
- Deployment-only adaptation: EDGE_FUNCTION_PATH is /nov-hub-directory-staging.
- Existing custom Firebase/HUB authentication is retained (verify_jwt=false).
- All deployed files read back exactly match the submitted bundle.
- GET /healthz: 200, dataAccessed=false.
- OPTIONS: 204.
- Anonymous masterListEmployees: 401 TOKEN_MISSING.
- Invalid-token masterListEmployees: 401 TOKEN_VERIFICATION_FAILED.
- Shared Staging nov-hub-api v17 was not overwritten.
- No Staging business writes or role assignments.

Authenticated hosted UI/UAT is NOT complete: no authorized Staging viewer session was available.
Local pipeline verification does not substitute for authenticated hosted UAT.

## Production approval scope and remaining gate

Production changes performed: zero. Employee data and role assignments changed: zero.

After review and authenticated Staging viewer UAT, request separate Owner approval for:
1. Deploy the bounded canAccessApp patch to production nov-hub-api, after rechecking v145 baseline drift.
2. Publish the corrected HUB main.js and index.html cache reference, reviewing the Pages artifact
   for unrelated unpublished changes before release.

Do not change role assignments, migrations, write flags, credentials or employee data.
Post-release read-only check: reported user opens the employee list; editor actions remain denied.
Rollback: restore prior API v145 bundle and prior approved Pages artifact, subject to Owner approval.
