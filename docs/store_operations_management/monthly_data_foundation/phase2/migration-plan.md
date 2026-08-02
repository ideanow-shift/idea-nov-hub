# Migration Candidate Plan

## Status

No migration is created, approved, or executable. This plan identifies three candidate migration domains after catalog attestation.

| Candidate | Purpose | Reuse-first decision | Potential physical change |
|---|---|---|---|
| M1: workbook lifecycle alignment | Bind Workbook hash, source profile, target period, dry-run summary, and quarantine count to import/version lifecycle. | Reuse `accounting_import_batches`, `accounting_import_files`, `accounting_versions`, validation, publication, and audit objects if their constraints support it. | Add minimal columns only when catalog evidence proves a gap. |
| M2: Core Master assignment / crosswalk alignment | Core Master owns employee-master store assignments and the Tokorozawa legacy crosswalk. Assignments support multiple stores, `effective_from`, and `effective_to`; they resolve AM and Store Manager scope with deny-by-default when unassigned. The employee master is the formal source and no separate AM master is created. The crosswalk relates the legacy UUID to the canonical `public.stores` `store_id`; the legacy UUID is not changed and remains a restricted Core Master relation, not a Store Operations table. Its reference source, effective period, and audit history must be retained. Accounting Core owns monthly actuals; Store Operations only reads the server-side projection and never updates assignments or crosswalks from the UI. | Reuse approved Core Master assignment and crosswalk structures only when catalog evidence confirms ownership, effective-date semantics, and auditability. | Only if the existing structure is insufficient, evaluate the minimum Core Master change. Before catalog confirmation, this is not a decided migration. PK, FK, index, RLS, and grant effects are follow-up audit scope. |
| M3: published projection boundary | Select latest compatible published facts and restrict access to approved scope. | Reuse facts, publications, consumer view, and existing projection pattern where validated. | Minimal view/port support only after Security approves the target boundary. |

## Index and Constraint Candidates

- A target-period/source-profile/version uniqueness rule that permits immutable re-import versions.
- Lookup support for latest published version by profile and period.
- Effective-date lookup for approved sheet mapping.
- Fact lookup by version, store, metric, and period.
- Append-only audit and approval references.

Exact keys, indexes, grants, table names, and rollback SQL are deferred until a read-only catalog attestation establishes actual database facts. The repository schema is not evidence that the target database has the same objects.

## Rollback Principle

Use expand, verify, switch, and retained rollback compatibility. Migration rollback must never delete imported accounting evidence or silently alter a published version.
