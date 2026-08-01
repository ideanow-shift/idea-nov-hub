# Monthly CSV Type Contract

## Supported V1 CSV types

1. `monthly_sales`
2. `monthly_profit`
3. `monthly_ec_sales`
4. `monthly_workforce_sales`

Every file must declare a single CSV type, target period in `YYYY-MM`, source file name, source version, file hash, and import version. A file that combines types, periods, or unapproved headers is rejected.

## Common normalized input fields

`target_period`, `csv_type`, `corporation_id`, `store_id`, `employee_no` when applicable, `metric_code`, `amount`, `source_file_name`, `source_row_no`, `import_version`, `import_batch_id`, `imported_by_employee_no`, `imported_at`, and `publication_status`.

V1 accepts only files that can map to this contract without guessing. Source-only fields outside the approved mapping are rejected, not retained as hidden payload.
