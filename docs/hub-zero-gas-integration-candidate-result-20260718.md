# HUB zero-GAS integration candidate result

- Date: 2026-07-18
- Authoritative GitHub baseline: `e8182fec871456391e0097256179b527bb69c4a2`
- Preserved HUB Core integration tip: `e7bd6b748ff25b04b408e315ab4dc2528039ab44`
- Zero-GAS integration source commit: `530c5684d70b3c3dacf7dcad5815f12d5be4e3cd`
- Classification: `PRODUCTION_EVIDENCE_REQUIRED`
- Push/publish/production mutation: 0

## Integrated ownership

The isolated integration candidate preserves the nine unpushed HUB Core commits
on top of the fresh remote baseline. The HR role release change and the
Education local route coexist in `portal/js/main.js`; no shared worktree was
edited.

## Zero-GAS source result

- Education runtime route: `./education-app/`.
- Tracked `gas-backend/` files: 0.
- Active portal/Edge source legacy endpoints: 0.
- Old display-fix SQL, rollback SQL, execution runner, validator, and synthetic
  SQL fixture: retired from the candidate.
- Replacement rollback disables `EDU` and never restores an external legacy URL.
- Historical Markdown remains audit evidence and is explicitly marked superseded
  where it described execution.

## Verification

```text
HUB strict GAS exit source check: PASS (7 files / 10 forbidden patterns)
portal_apps zero-GAS static validator: PASS (11/11)
Education static fixture: PASS (12/12)
Education domain + HTTP fixtures: PASS (17/17)
HUB zero-GAS runtime/source fixture: PASS
HR runtime access validator: PASS (9/9)
LINE WORKS inventory validator: PASS (8/8)
Core SELECT-only runner validator: PASS (10/10)
Master data catalog precheck validator: PASS (8/8)
Management financial tests: PASS (24/24)
Management store CSV tests: PASS (10/10)
```

## Local SQL rehearsal

The separated PostgreSQL lane was checked again. Podman cannot initialize
because `C:\Users\bassa\.config` is a file, Docker is unavailable, and `psql` is
unavailable. No SQL process started and production access remained zero.

The SQL candidate received source-level repair for PostgreSQL data-modifying CTE
visibility: postconditions use `RETURNING` plus the locked pre-state instead of
re-reading the target table in the same statement.

## Remaining gates

1. CoreOS review of the integrated source and retirement of the old executable
   contract.
2. Fresh production SELECT-only precheck for `EDU`, `THANKS`, and `idea-link`.
3. New sealed SQL hashes and an executor only after exact production evidence.
4. Normal push/publish approval preserving the shared HUB Core commit chain.
5. Education public HTTP 200 check before `portal_apps` activation.
6. Separate operator approval to disable/archive Apps Script deployments.

No production DDL, DML, RPC, RLS, GRANT, Secret, notification, Storage, Apps
Script, push, publish, or deploy operation was performed.
