# PR001-A — Migration Authoring Release Gate

## Status

`AUTHORING COMPLETE / NOT APPLIED`

This package contains Staging-only Canonical Core Master SQL for M001–M010. It has no Production schema dependency and does not authorize a database connection, Migration apply, deploy, Snapshot load, or Production cutover.

## Artifacts

- Forward Migration SQL: `supabase/migrations/*_m001_bdf_*` through `*_m010_bdf_*`.
- Reverse-order Rollback SQL: `supabase/rollback/pr001a/`.
- Read-only validation: `supabase/validation/pr001a/validate_pr001a.sql`.
- Static contract test: `tests/bdf-pr001a-migration-contract.test.mjs`.
- Design source: `docs/architecture/14_pr001_core_master_migration_design_package.md`.

## Release gates

### A1 — Authoring completeness

- M001–M010 exist exactly once and in order.
- Canonical IDs are Staging-issued UUIDs.
- Source keys exist only in the private crosswalk.
- Crosswalk identity and Version Member references are type-safe composite FKs through Canonical registries.
- Production physical table/column/PK/FK references are absent.
- Every FK and scope/as-of lookup has a supporting index.
- Effective intervals reject invalid bounds and overlap.
- Immutable strategy B uses `source_snapshot_id` as the system-version axis; Core history and audit rows reject UPDATE/DELETE.
- Successive publications append immutable `master_publication_releases`; Projection reads only the highest release sequence.
- Snapshot source version/content idempotency is enforced.
- Population supports pending review, excluded, non-operational, and unresolved isolation.
- Publication transition enforces item count, official=20, direct=13, franchise=7, pending=0, unresolved=0, and rejected-official=0.
- Views are private `security_invoker` read models.
- Core/Governance objects are RLS-enabled and default-deny.
- Rollback files exist in reverse order and contain no `CASCADE`.
- M010 fixes the exact five-View contract and runs rollback-only synthetic negative fixtures.
- M010's deterministic Population fixture creates one Corporation version, 20 Store versions, and 20 typed Corporation/Store relationships; Store rows reference the single Corporation through the relationship FK instead of duplicating it.
- The overlap negative test uses distinct fixed `effective_from` values with intersecting periods, so it reaches the exclusion constraint without violating `corporations_identity_start_unique` first.
- Fixed fixture UUIDs, date, timestamp, source version, Snapshot version, and source keys are safe to rerun because the enclosing exception subtransaction always rolls back all fixture rows.

### A2 — Review readiness

- SQL review by Core DB Architect.
- Privacy review of employee/crosswalk fields.
- Security review of schema exposure, grants, RLS, and View behavior.
- Store Operations review of Store Scope and required projection fields.
- Finance review of corporation/store relationship semantics.
- `git diff --check` and static test PASS.
- M010 diagnostics report `expected_view_count`, `actual_view_count`, `missing_view_names`, `unexpected_view_names`, and `insecure_view_names`.

### A3 — Fresh Staging-equivalent verification

Separate authorization required. Not executed in this Sprint.

- Apply M001–M010 to a fresh non-Production database; M010 must execute all synthetic fixtures without persisting them.
- Run Supabase/Postgres advisors and catalog validation.
- Run synthetic positive/negative fixtures inside rollback transactions.
- Confirm the normalized fixture produces Corporation=1, Store=20, relationship=20, official/direct/franchise=20/13/7, pending=0, unresolved=0, and rejected-official=0 before Publication.
- Verify invalid interval, overlap, orphan FK, PII, unauthorized grant, and unpublished population failures.
- Execute reverse-order rollback rehearsal on an unpublished empty/candidate dataset.

### A4 — Staging apply

`BLOCKED`. Requires A1–A3 PASS, approved Staging identity, change window, backup/restore plan, and explicit apply authorization.

### A5 — Snapshot data load

`BLOCKED`. Requires approved source Mapping/Masking contract, crosswalk rules, idempotency plan, PII validation, 21st-store Human Review, and population approval. P0-C is not a normal authoring prerequisite.

## Rollback policy

Rollback SQL is only for an unpublished PR001-A Staging deployment. Run M010→M001. Revoke access before dropping Views or tables. M001 uses non-`CASCADE` schema drops so unexpected dependencies fail closed. The shared `btree_gist` extension is retained. Once a master version is published, do not use destructive rollback; revoke access, restore the prior version pointer, and issue a forward fix.

## Current decision

| Target | Decision |
|---|---|
| Migration authoring | PASS after static verification |
| Migration review | READY after hardening static verification |
| Migration apply | BLOCKED |
| Snapshot load | BLOCKED |
| Store Operations/Finance connection | BLOCKED until Phase 1 G1 |
| Production connection/change | PROHIBITED |
