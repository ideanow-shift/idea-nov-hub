# Accounting Lifecycle Impact

## Repository Evidence, Not Database Proof

`accounting_core/schema.sql` defines eleven lifecycle candidates: import batches/files, entity/account mappings, versions, raw values, facts, validation results, approvals, publications, audit logs, and `accounting_consumer_facts`. The target database catalog must attest their existence, schema, owner, RLS, grants, triggers, and indexes before reuse.

## Reuse Plan

| Need | Reuse candidate | Phase 3 impact |
|---|---|---|
| upload and dry-run receipt | `accounting_import_batches`, `accounting_import_files` | Bind source profile, logical filename, hash, target period, and bounded dry-run counts. |
| sheet/account mapping | `accounting_entity_mappings`, `accounting_account_mappings` | Approve fixed Workbook sheet and metric mappings with effective periods. |
| immutable re-import | `accounting_versions` | Reuse numeric version, predecessor, supersession, and restore links. |
| normalized monthly data | `accounting_raw_values`, `accounting_facts` | Persist only after validated import; raw Workbook storage is separately approved. |
| validation/quarantine | `accounting_validation_results` | Store safe codes and masked messages, never personal or raw accounting values. |
| review/publish/rollback | `accounting_approvals`, `accounting_publications` | Append decisions; only latest eligible publication is consumable. |
| evidence | `accounting_audit_logs` | Add structured command-transition evidence candidate. |

The fixture state `validation_failed` maps to a batch/file validation outcome. A physical `accounting_versions` row is only created when import becomes eligible; this avoids exposing a pre-import version as business data.
