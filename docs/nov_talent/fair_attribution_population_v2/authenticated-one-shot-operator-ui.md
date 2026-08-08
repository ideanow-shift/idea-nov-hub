# Authenticated One-Shot Operator UI

## Purpose

This Staging-only control closes the browser-to-Executor handoff without copying or extracting the HUB session token. It does not change the fixed Manifest v2, the Population RPC, or the database contract.

## Request path

1. The published NOV HUB page obtains the existing HUB session through the shared session helper.
2. The browser sends only its normal `Authorization` header. The preparation command body is exactly `{}`.
3. `nov-talent-staging-api` validates the session against HUB and resolves the canonical Employee UUID and role server-side.
4. The Edge Function reads the sealed Manifest/source package from a Staging secret. It never returns or logs the package.
5. A read-only preflight recomputes the fixed Manifest/source contract, live Candidate snapshot, live Fair snapshot, active Fair references, and empty Attribution/Audit state.
6. The existing service-role-only RPC remains the only write path and repeats the authoritative locked checks in its single transaction.

## Default-off gates

The control is unavailable unless all of these server settings are present:

- `NOV_TALENT_FAIR_ATTRIBUTION_POPULATION_V2_ENABLED=true`
- `NOV_TALENT_FAIR_ATTRIBUTION_POPULATION_V2_BROWSER_APPROVED=true`
- `NOV_TALENT_FAIR_ATTRIBUTION_POPULATION_V2_APPROVAL_SHA256` contains the approved one-shot token digest
- `NOV_TALENT_FAIR_ATTRIBUTION_POPULATION_V2_PAYLOAD_GZIP_BASE64` contains the gzip/base64 encoded exact-key payload (`manifestJson`, `sourceRangeValues`)

The existing CLI approval secret and CLI route remain independent and unchanged. `NOV_TALENT_OUTCOME1_WRITES_ENABLED` must remain `false` until the Population is complete.

The code deployment keeps both write flags false and does not provision the sealed payload. Provisioning those three one-shot settings requires a separate DB guardian data gate and Owner execution approval.

## Browser safety

- The control initializes only at `https://ideanow-shift.github.io` in the Staging runtime and only for the existing full HR administration access profile. While the Executor is locked, the fixed aggregate summary remains visible and its confirmation button is disabled.
- The Edge Function independently allows only `super_admin`, `backoffice`, and `hr.admin`.
- The browser never accepts or renders an actor UUID, actor role, approval token, Manifest, hash, Candidate ID, or Fair ID.
- The UI disables the action before the first POST. It never retries. Database locks and the existing-state gate remain the authoritative duplicate-execution protection after refresh or response loss.
- A successful run hides the control. Operational closure must immediately restore both Population flags to `false` and remove or rotate the sealed payload secret.

## Deployment boundary for this change

- Edge deploy: allowed with the new settings absent/default false.
- Pages deploy: allowed; the control remains hidden while server readiness is locked.
- Migration: not required.
- Population: not authorized by the deployment itself.
- Production database: not referenced or changed.
