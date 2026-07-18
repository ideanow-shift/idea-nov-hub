# GAS remaining inventory

- Date: 2026-07-18
- Classification: SOURCE_PUBLIC_ZERO_GAS_PASS / PRODUCTION_DEPLOYMENT_RETIREMENT_EVIDENCE_REQUIRED
- Audit mode: read-only; no DML, Apps Script action, Secret access, trigger
  change, or credential inspection

## Current result

The current source and public Pages route no longer contain executable HUB GAS
runtime dependencies.

```text
Tracked gas-backend directory: absent
Tracked .gs / appsscript.json / .clasp.json files: 0
Public Education route: HTTP 200
Public HUB top script.google.com / google.script.run hits: 0
hub-zero-gas-source-fixture: PASS runtime=0 source=0
strict GAS exit source check: PASS (7 files / 10 forbidden patterns)
```

This closes the source/public runtime side of the GAS migration. It does not
disable, delete, or archive any Apps Script deployment.

## Remaining production-only inventory

Only production retirement evidence remains:

1. Confirm no current production consumer invokes the retired Apps Script
   deployment during the approved observation window.
2. Confirm Apps Script trigger/deployment inventory without recording request
   bodies, Script Properties, credentials, or business values.
3. Disable/archive the Apps Script deployment only through a separately approved
   operator action after the new routes remain verified.
4. Rotate or retire any legacy GAS-specific secret material only through a
   separate credential gate.

Until those operator/production gates complete, the correct status is:
`SOURCE_PUBLIC_ZERO_GAS_PASS`, not full deployment retirement.

## Historical fresh remote evidence

Observed at the original audit: `origin/main`
`0ee2e04c9f3727be8d4bfb73af8d947d07e60ff5`.

This section is retained as historical evidence. The current integrated
candidate was rebuilt on authoritative GitHub baseline
`e8182fec871456391e0097256179b527bb69c4a2`, preserves the HUB Core integration
through `e7bd6b748ff25b04b408e315ab4dc2528039ab44`, and contains the zero-GAS
source integration at `530c5684d70b3c3dacf7dcad5815f12d5be4e3cd`.

At that historical point, the fresh remote still contained these GAS
dependencies:

1. Four tracked GAS backend files under `gas-backend/`.
2. Education GAS URL in `portal/js/apps.js`.
3. Education GAS fallback URL in `portal/js/main.js`.
4. `supabase/portal-apps-display-fix-candidate-20260717.sql` updates `EDU` to a
   GAS URL.
5. `supabase/portal-apps-display-fix-rollback-candidate-20260717.sql` restores
   another GAS URL.

## Shared ownership evidence

The shared HUB Core worktree `work/hub-core-safe-rebaseline-20260717` was
observed ahead 9 and behind 6. It has an unpushed HR access change in
`portal/js/main.js`, the same file that must lose the Education GAS fallback.
The HR change and Education change are logically non-conflicting, but the file
ownership overlaps and must be integrated from a fresh baseline.

## Isolated replacement candidate

The isolated Education branch contains local commits that:

- add `portal/education-app/`;
- route Education to `./education-app/`;
- remove the tracked GAS backend files;
- add strict zero-GAS runtime/source fixtures;
- add source-only Education read domain and HTTP boundary candidates.

Fresh-rebased implementation commits at this audit stage:

- `4acb9bb`: Education static zero-GAS source.
- `60911d0`: tracked HUB GAS source retirement.
- `a1783e3`: Education read-only domain boundary.
- `f9d24fb`: Education read-only HTTP boundary.

Baseline at the final local rebase: `origin/main`
`0ee2e04c9f3727be8d4bfb73af8d947d07e60ff5`.

Those historical candidates were not pushed. Their behavior was rebuilt in the
current isolated integration candidate; no production push, publish, database
mutation, or Apps Script action has been performed.

## Historical required cutover gates

1. Rebuild the zero-GAS runtime/source changes on the authoritative HUB
   integration baseline while preserving the HR access change.
2. Supersede both GAS portal_apps SQL candidates with the no-GAS proposal.
3. Execute production `portal_apps` DML only after Core approval and SELECT-only
   precheck.
4. Confirm the Education Pages URL is HTTP 200 before enabling the card.
5. Disable/archive remaining Apps Script deployments through the approved
   operator path and record only non-secret deployment status evidence.

The source/public portions above are now complete on current main. The remaining
gates are limited to production evidence and Apps Script deployment retirement.
