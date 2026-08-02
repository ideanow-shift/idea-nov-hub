# Month Column Detection

The target period is an explicit `YYYY-MM` input. The parser converts a real monthly
header using the stated fiscal year and accepts exactly one matching activity column.
Half-year, cumulative, closing-adjustment, closing-balance, and comparison columns
are ignored. Missing or multiple target columns quarantine the selected sheet and
return `FAIL_CLOSED`.
