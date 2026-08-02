# Accounting Lifecycle Mapping

## Purpose

This document prepares the Phase 1 fixture-only Yayoi Workbook parser for a future Accounting lifecycle integration. It does not create a database object, execute a migration, or connect to any environment.

## Evidence Boundary

The repository schema currently defines the following logical lifecycle objects: `accounting_import_batches`, `accounting_import_files`, `accounting_versions`, `accounting_facts`, `accounting_validation_results`, `accounting_approvals`, `accounting_publications`, and `accounting_audit_logs`. Supporting mapping and consumer objects are `accounting_entity_mappings`, `accounting_account_mappings`, and `accounting_consumer_facts`.

These are **reuse candidates only**. A production or staging catalog attestation must confirm object identity, columns, constraints, RLS, grants, and ownership before any implementation relies on them.

## Lifecycle Mapping

| Import Center stage | Future lifecycle record | Required invariant |
|---|---|---|
| Workbook upload | import batch and file record | Hash and logical filename recorded; raw Workbook storage is separately approved. |
| Dry-run | validation record | Phase 1 output is summary-only; no facts are visible. |
| Validate | validation record | Any blocking issue prevents import and publication. |
| Import | immutable version and facts | One newly created version; no overwrite of an existing period. |
| Review | approval record | Accounting reviewer confirms the validation result. |
| Publish | publication record | Only one compatible published version is selected for a period/profile. |
| Rollback | append-only approval/audit/publication event | A historical version is restored through a new event, never by deleting facts. |

## Source Constraints

- One Yayoi `残高試算表（年間推移）` Workbook is the V1 input.
- The selection is direct-store P/L 13, FC-store P/L 7, and required-only HQ/EC P/L values.
- B/S, cumulative, half-year, closing, comparison/reference, unselected P/L, daily, weekly, POS, and customer-level data remain outside V1.
- The fixed effective sheet mapping resolves `yayoi_sheet_name` to `store_id`; sheet names are never canonical store identifiers.
- FC operating profit is unavailable in V1. HQ and EC values are never allocated to stores.

## Readiness Gates

1. Catalog attestation confirms the reuse candidates.
2. The approved Workbook profile and effective sheet mapping are owned by Accounting and Core Master.
3. The canonical HUB server-side session verifier is confirmed reusable by its owning team.
4. Security approves the command and published-projection access boundary.

Until every gate is approved, this is architecture only and no lifecycle record may be written.
