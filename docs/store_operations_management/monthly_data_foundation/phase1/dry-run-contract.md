# Dry-run Contract

The immutable receipt reports Workbook name/hash, target period, total/selected/
excluded sheet counts, 20-store mapping counts, target-account count, normalized
record count, error/warning counts, monthly amount total, and per-store record
counts. It also fixes `db_connection_count=0`, `production_connection_count=0`,
and `file_write_count=0`. Any error clears normalized records and amount totals.
