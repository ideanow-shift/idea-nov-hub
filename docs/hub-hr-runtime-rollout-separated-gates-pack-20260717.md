# HUB HR runtime rollout separated gates pack 2026-07-17

## Purpose

Allow employees with the existing `hr.staff` or `hr.admin` role to see the released HR applications and to view/edit Master Admin, while preserving the existing `super_admin`, `executive`, and `backoffice` behavior.

This pack does not grant roles. Department name, employee name, and frontend tags are not authorization sources.

## Reviewed source candidate

The candidate is rebased on `origin/main` commit `dce3bd0` and contains three runtime source files:

| File | Candidate SHA-256 |
| --- | --- |
| `portal/index.html` | `EEF2B55926DFD5562F6FDAB10E51C4BC8A73233EB3EB6537B8E4173D8DAF7566` |
| `portal/js/main.js` | `1F5E5F4C3356B38D5D3232EE86ABA9158D0279929D0A2D7AC59720566E59A5A9` |
| `supabase/functions/nov-hub-api/index.ts` | `26297CF8BA3DCA9966143C6BACDCD1AF6FA73F1D62AE31AD7999EF82D6BFCB00` |

Exact runtime behavior changes:

1. Portal display policy adds `hr.staff` and `hr.admin` to the existing released-HR-app viewer role set.
2. Edge Master Admin view policy adds `hr.staff` and `hr.admin`.
3. Edge Master Admin edit policy adds `hr.staff` and `hr.admin`.
4. Portal module release query changes to `hub-hr-access-20260717-1`.

## Required rollout order

### Gate 1: production SELECT-only role evidence

Confirm counts only:

- intended active HR operators with `hr.staff` or `hr.admin`
- active/login-enabled coverage
- duplicate active role assignment count
- no personal names, email addresses, employee IDs, or role assignment rows in the result

No role DML is included. Missing role assignments require a separate Core DB DML gate.

### Gate 2: clean Edge limited deploy

1. Fetch the currently deployed `nov-hub-api` source and metadata.
2. Apply only the two `canViewMasterAdmin` / `canEditMasterAdmin` role-list changes.
3. Confirm all non-Master-Admin routes have diff 0.
4. Run Deno check, auth-boundary fixtures, missing-auth/invalid-auth checks, and Master Admin role fixtures.
5. Deploy `nov-hub-api` exactly once.
6. Confirm ACTIVE/version and safe auth responses without exposing raw tokens, employee values, or Secrets.

The repository candidate must not be deployed directly if its full source differs from the fresh deployed baseline.

### Gate 3: normal Git push / Pages publish

Only after Gate 2 passes:

1. Fetch and confirm no overlapping remote drift in `portal/index.html` or `portal/js/main.js`.
2. Re-run the 9 static HR runtime checks and portal syntax checks.
3. Use a normal fast-forward push; force push is prohibited.
4. Verify public HTML/main.js 200 and the `hub-hr-access-20260717-1` release query.
5. Perform read-only role display smoke. Do not edit employee data during this gate.

## Stop conditions

- production role evidence is missing or ambiguous
- deployed Edge baseline differs in the reviewed symbols
- remote drift overlaps the two portal files
- any non-Master-Admin Edge route changes
- role DML, DB schema changes, Secret changes, or notification execution becomes necessary

## Current status

- source/static candidate: ready
- fixtures: pass
- Edge deploy: not executed
- Pages publish: not executed
- production role DML: not executed
