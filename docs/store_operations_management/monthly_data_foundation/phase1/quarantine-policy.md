# Quarantine Policy

Each bounded quarantine entry contains `issue_type`, `sheet_name`, `row_no`,
`column_name`, `current_value_category`, `reason`, and `suggested_action`. It never
contains personal information, a raw Workbook, raw cell values, credentials, or
database identifiers. Unknown sheets, missing/duplicate mappings, invalid month
columns, unknown accounts, invalid numeric values, duplicate rows, and missing
requirements are fail-closed issues.
