# Phase 1 Parser Contract

`review/store-operations-monthly-import/phase1-import.mjs` accepts an XLSX Buffer
only. It enumerates sheets, reads P/L anchors, monthly headers, account labels, and
cell categories. It never saves a Workbook, opens a database connection, calls a
network endpoint, or reads Production credentials.

P/L requires the annual-trial-balance report anchor, `勘定科目`, a tax-excluded
profile, and a fiscal-year marker. Cell values are classified as `blank`, `string`,
`number`, or `invalid`; only finite numbers form normalized facts.
