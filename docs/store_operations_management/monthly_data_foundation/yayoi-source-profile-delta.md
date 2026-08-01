# Yayoi Source Profile Delta

## Approved direction change

| Topic | Superseded design | Current candidate design | Required control |
| --- | --- | --- | --- |
| Physical transaction input | four monthly Yayoi CSV files | one Yayoi `残高試算表（年間推移）` workbook | workbook profile and SHA-256 |
| Logical values | one file per metric | four logical metrics extracted from P/L account mappings | account-map version and context validation |
| Store identity | CSV rows expected canonical IDs | sheet label maps through an approved fixed sheet mapping | sheet name is never a Store ID |
| Period | per-file target period | workbook month headers plus fiscal-period metadata | reject ambiguous or cumulative columns |
| Re-import | version per file/type | immutable version per workbook | only latest compatible published version projects |
| Errors | per-file validation | workbook-level fail-closed quarantine | no partial publication |

The monthly V1 remains monthly-only, tax-excluded, server-projected, and limited to
the current 20-store validation gate. This change does not authorize a production
workbook intake and does not change publication authority: Accounting imports,
reviews, and normally publishes; rollback remains Accounting plus Representative.

## Impact on implementation planning

The future Import Center changes from four upload/type selectors to one controlled
Workbook Profile selector. It must still display four logical metric readiness
states. Accounting lifecycle persistence needs an `import_profile` and mapping
version references instead of a physical `csv_type` requirement. No new ledger is
created by this direction change.

## No operational change

No database, migration, RLS, RPC, UI, deployment, Production connection, workbook
receipt, import, or published projection was changed.
