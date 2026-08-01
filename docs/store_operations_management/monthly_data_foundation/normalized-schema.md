# Normalized Schema Design

## Logical import record

The future normalized record is defined as a contract only:

| Field | Rule |
| --- | --- |
| `target_period` | required `YYYY-MM` |
| `csv_type` | one approved V1 type |
| `corporation_id` | verified Master reference |
| `store_id` | verified Store Master reference |
| `employee_no` | optional; verified Employee Master reference when required |
| `metric_code` / `amount` | approved metric and numeric value |
| `source_file_name` / `source_row_no` | traceable source location |
| `import_version` / `import_batch_id` | immutable import identity |
| `publication_status` | lifecycle-controlled state |

No DDL is proposed here. Any future schema must add uniqueness, source mapping, validation, history, and access controls in a separately approved migration review.
