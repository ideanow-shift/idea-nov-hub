# Monthly CSV Import Workflow

1. Select one supported CSV type and one target period.
2. Read file metadata and calculate a file hash.
3. Validate headers, type, period, numeric fields, row count, and source identity.
4. Run a dry-run against approved Store, Corporation, and Employee Master mappings.
5. Reject unmapped store/corporation/employee values, duplicates, mixed periods, invalid amount values, and forbidden fields.
6. Produce a validation report with no data write.
7. Request human review of errors and aggregate counts.
8. A future approved import process may create a new version; this document does not authorize it.
9. Only a fully validated and explicitly published version may be projected to Store Operations.

Dry-run must not write to Production, update Master data, or create a visible version.
