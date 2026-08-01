# Monthly Import Versioning Policy

Each accepted file is immutable and receives one `import_version` and one
`import_batch_id`. A replacement is a new version; it never overwrites a published
file or silently changes a historical projection.

## States

`uploaded` -> `validating` -> `imported` -> `reviewing` -> `published`

Failure exits are `validation_failed` and `rolled_back`. A newer approved version
marks its predecessor `superseded`. Store Operations reads only the latest
compatible `published` version for each period and CSV type.

## Controls

- A version carries its source filename, source-file hash, row count, actor
  identifier, timestamps, validation result, and approval reference.
- Publication requires an authorized accounting approver; upload does not publish.
- A historical correction is visible as a newer version and must state its reason.
- Replaying an identical hash for the same type and period is rejected unless an
  approved exception is recorded.
