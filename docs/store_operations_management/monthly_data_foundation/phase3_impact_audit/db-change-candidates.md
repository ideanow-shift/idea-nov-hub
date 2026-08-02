# DB Change Candidates

## Counts

- Conditional new relation candidates: **1**: Core Master store legacy crosswalk, only if catalog attestation proves none exists.
- Migration candidate domains: **4**.
- No DDL is created by this audit.

## Candidate Domains

| ID | Change | Reuse-first requirement | Constraints/indexes to review |
|---|---|---|---|
| M1 | Core Master legacy crosswalk | Use an existing approved relation if present. | Canonical store FK, legacy identity uniqueness per source/period, effective-period lookup, append-only audit link. |
| M2 | Workbook lifecycle alignment | Reuse batches/files/mappings/versions/facts/validation/publication. | Hash/profile receipt, version uniqueness by scope and period, fact lookup by version/store/metric/period. |
| M3 | Approval and structured audit alignment | Reuse append-only approvals/audit records. | Distinct Accounting/Representative rollback approvals; command, actor role, period, version, previous/next state, reason, result, timestamp. |
| M4 | Published projection access alignment | Reuse `accounting_consumer_facts` only if its semantics match V1. | One active publication, confirmed-period lookup, published-only read index. |

## Column Candidates

`accounting_import_batches` may need an approved source-profile and command-lifecycle reference. `accounting_import_files` may need a Workbook profile/mapping version link and safe dry-run/quarantine counts. `accounting_audit_logs` may need structured command-transition columns rather than relying solely on JSON metadata. Version/publication status support for `rolled_back` must be reconciled with the existing publication status model before adding an enum value or parallel event.

Exact PK, FK, unique, enum, index, and schema names remain contingent on target catalog evidence.
