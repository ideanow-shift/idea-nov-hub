# Phase 8 Core DB Remediation Sprint

This package is source-only. It contains design evidence, unexecuted SQL,
and static SQL tests. It does not connect to a database, deploy, seed, alter
production data, or execute a migration.

## Scope

- Canonical store master recommendation: `public.stores`.
- Store UUID remediation through an immutable canonical UUID and an approved
  crosswalk; no UUID update is included.
- Additive `store_operation_history` DDL.
- Fail-closed RLS policy candidate for the history table.
- Store Runtime to Core DB contract and production runbook.

## Deliberate holds

The repository does not contain a committed `core.stores` definition, a
Tokorozawa UUID pair, creation timestamps for the pair, or a canonical
department-to-store membership relation. The runbook therefore requires a
read-only staging inventory before switching any runtime contract. The SQL
does not invent missing data or grant department-wide access by inference.

## Contents

1. `01-ssot-analysis.md` - evidence-based SSoT recommendation.
2. `02-uuid-remediation.md` - immutable UUID crosswalk plan.
3. `03-store-history.md` - additive history design.
4. `04-rls-policy.md` - RLS authorization matrix and deployment holds.
5. `05-core-master-contract.md` - JSON Schema and API contract.
6. `06-migration-runbook.md` - backup, expand, verify, switch, rollback.
7. `../../migration/V001__store_history.sql` - unexecuted DDL.
8. `../../migration/V002__rls_policy.sql` - unexecuted policy candidate.
9. `../../tests/store_history_test.sql` and `../../tests/rls_test.sql` -
   source-only SQL assertions, not a production test run.

## Acceptance boundary

Execution requires separate staging approval, backup evidence, schema and
identity prechecks, and role/scope attestation. Production deploy remains out
of scope for this sprint.
