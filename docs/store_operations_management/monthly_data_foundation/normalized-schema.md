# Normalized Schema Design

## Logical import record

The future normalized record is defined as a contract only:

| Field | Rule |
| --- | --- |
| `target_period` | required `YYYY-MM` |
| `source_profile` | required `yayoi_annual_trial_balance_workbook` |
| `corporation_id` | verified Master reference |
| `store_id` | verified Store Master reference |
| `source_sheet_name` / `source_row_no` | traceable workbook location; sheet name is not an identifier |
| `assigned_store_ids` | Employee Master-owned, multiple approved store IDs for AM scope |
| `assignment_effective_from` / `assignment_effective_to` | inclusive assignment validity boundary; outside period is excluded |
| `metric_code` / `amount` | approved metric and numeric value |
| `source_file_name` / `workbook_hash` | immutable source identity |
| `sheet_mapping_version` / `account_mapping_version` | approved mapping identities |
| `import_version` / `import_batch_id` | immutable import identity |
| `publication_status` | lifecycle-controlled state |

`assigned_store_ids` and its effective period are formal Employee Master attributes for
future implementation. No separate AM Master is introduced. No DDL is proposed here.
Any future schema must add uniqueness, source mapping, validation, history, and
access controls in a separately approved migration review.

Employee number is not a required P/L record field. Only
`imported_by_employee_no` identifies the Accounting actor in the future audit
record.
