# Phase 1 Parser Contract

`review/store-operations-monthly-import/phase1-import.mjs` accepts an XLSX Buffer
only. It enumerates sheets, reads P/L anchors, monthly headers, account labels, and
cell categories. It never saves a Workbook, opens a database connection, calls a
network endpoint, or reads Production credentials.

P/L requires the annual-trial-balance report anchor, `勘定科目`, a tax-excluded
profile, and one fiscal-year marker. It accepts `YYYY年9月`, `令和N年9月`, and
`RN年9月`, normalizes the latter two to Gregorian year, and verifies that year against
the requested target period. 元年, missing month, unknown eras, duplicate markers,
and an inconsistent future year fail closed. Cell values are classified as `blank`, `string`,
`number`, or `invalid`; only finite numbers form normalized facts.
