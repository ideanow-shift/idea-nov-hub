# Migration Candidate Plan

## Status

No migration is created, approved, or executable. This plan identifies three candidate migration domains after catalog attestation.

| Candidate | Purpose | Reuse-first decision | Potential physical change |
|---|---|---|---|
| M1: workbook lifecycle alignment | Bind Workbook hash, source profile, target period, dry-run summary, and quarantine count to import/version lifecycle. | Reuse `accounting_import_batches`, `accounting_import_files`, `accounting_versions`, validation, publication, and audit objects if their constraints support it. | Add minimal columns only when catalog evidence proves a gap. |
| M2: effective source mapping | Maintain approved profile and effective sheet-to-entity/store mapping without treating sheet name as a store ID. | Reuse Accounting entity mappings and Core Master sources if ownership and effective dates exist. | Candidate `workbook_profile` / `sheet_mapping` relation only if reuse is impossible. |
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
