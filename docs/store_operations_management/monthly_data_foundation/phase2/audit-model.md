# Audit Model

## Required Append-Only Evidence

For each future command, the audit model records only the minimum operational metadata:

| Field | Purpose |
|---|---|
| importer employee number | Identifies the authenticated importer; not sourced from workbook rows. |
| occurred at | Orders lifecycle decisions. |
| logical source filename | Identifies the submitted Workbook without retaining contents. |
| SHA-256 hash | Binds dry-run, validation, and import to one input. |
| target period and source profile | Defines the intended monthly scope. |
| version reference | Identifies the immutable lifecycle version. |
| accepted and quarantine counts | Supports review without raw values. |
| publication status and publisher | Records the publication decision. |
| rollback reason and two approvals | Records exceptional restoration. |

## Excluded Data

The audit trail must not retain raw Workbook bytes, row values, customer data, employee personal data beyond the authorized operator reference, secrets, tokens, connection details, arbitrary UUID inventories, or raw accounting amounts.

Quarantine retains only Phase 1 safe metadata: `issue_type`, `sheet_name`, `row_no`, `column_name`, `current_value_category`, `reason`, and `suggested_action`.

## Retention and Access

Retention length, storage location, legal hold, and audit-reader roles require Accounting, Security, and Representative approval. The prior design proposal of seven years is not a binding decision. Audit reads must be server-mediated and purpose-limited.

## Integrity

Audit events are append-only. A correction creates a subsequent event that references the original event; it never edits the historical event.
