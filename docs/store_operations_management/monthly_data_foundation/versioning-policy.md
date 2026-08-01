# Monthly Import Versioning Policy

Each accepted workbook is immutable and receives one `import_version` and one
`import_batch_id`. A replacement is a new version; it never overwrites a published
workbook or silently changes a historical projection.

## States

`uploaded` -> `validating` -> `imported` -> `reviewing` -> `published`

Failure exits are `validation_failed` and `rolled_back`. A newer approved version
marks its predecessor `superseded`. Store Operations reads only the latest
compatible `published` workbook version for each period and logical metric set.

## Controls

- A version carries its source filename, source-file hash, sheet/account mapping
  versions, row count, actor identifier, timestamps, validation result, and
  approval reference.
- Accounting performs upload, review, and normal publication; upload does not
  publish by itself.
- Representative approval is required only for exception handling or rollback.
- A historical correction is visible as a newer version and must state its reason.
- Replaying an identical hash for the same type and period is rejected unless an
  approved exception is recorded.
