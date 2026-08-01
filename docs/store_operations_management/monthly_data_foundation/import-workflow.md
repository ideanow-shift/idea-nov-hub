# Monthly Workbook Import Workflow

1. Select the approved Yayoi annual-trial-balance Workbook Profile.
2. Read workbook metadata and calculate its file hash.
3. Classify every sheet, accept P/L only, and validate report anchors, tax basis,
   actual month headers, account contexts, and source identity.
4. Run a dry-run against approved sheet-to-Master, Corporation, and Employee
   assignment mappings.
5. Reject unmapped or ineffective sheets, duplicate canonical store IDs, ambiguous
   periods, invalid amounts, forbidden fields, and a non-20/13/7 composition.
6. Produce a validation report with no data write.
7. Accounting performs the content review of aggregate counts and errors.
8. Accounting may publish a fully validated version; representative approval is not
   required during normal operation.
9. A rollback requires Accounting plus Representative approval and is handled by the
   separate rollback policy.
10. Only a fully validated and explicitly published version may be projected to Store Operations.

Dry-run must not write to Production, update Master data, or create a visible
version. It records the importer employee number only in future audit metadata.
