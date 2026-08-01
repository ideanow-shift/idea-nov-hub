# Monthly Workbook Profile Contract

## Supported V1 physical input and logical metrics

Physical input: `yayoi_annual_trial_balance_workbook`.

Logical metrics: `monthly_sales`, `monthly_profit`, `monthly_ec_sales`, and
`monthly_product_sales`.

Every workbook must declare its profile, source file name, source version, file
hash, mapping versions, and import version. Its actual monthly headers must map to
approved `YYYY-MM` values. Unapproved report anchors, sheets, periods, or account
mappings are rejected.

Enabled P/L mappings cover all 20 approved stores. V1 does not accept per-store
files or a sheet name as a Store ID. The four logical metrics are sourced from one
Yayoi Accounting annual-trial-balance workbook.

## Common normalized input fields

`target_period`, `source_profile`, `corporation_id`, `store_id`, `metric_code`,
`amount`, `source_file_name`, `source_sheet_name`, `source_row_no`,
`workbook_hash`, `sheet_mapping_version`, `account_mapping_version`,
`import_version`, `import_batch_id`, `imported_by_employee_no`, `imported_at`, and
`publication_status`.

V1 accepts only files that can map to this contract without guessing. Source-only fields outside the approved mapping are rejected, not retained as hidden payload.
