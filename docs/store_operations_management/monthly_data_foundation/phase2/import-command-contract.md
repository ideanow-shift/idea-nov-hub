# Import Center Command Contract

## Boundary

The future Import Center is a server-side command boundary. The browser submits no database credential, SQL, role, store scope, publication state, or approval authority. Every command resolves the actor and scope from the canonical HUB session on the server.

No endpoint is implemented or deployed by this document.

| Command | Intended caller | Preconditions | Safe result | State effect after approval |
|---|---|---|---|---|
| `workbookUpload` | Accounting | Approved storage and actor | Logical file receipt and hash category | Creates batch/file metadata only. |
| `workbookDryRun` | Accounting | Buffer accepted by parser | Phase 1 summary and quarantine metadata | None. |
| `workbookValidate` | Accounting | Dry-run result bound to one hash/profile | Pass/fail and reason categories | Validation evidence only. |
| `workbookImport` | Accounting | Validation passed; target period unique by new version | New immutable version identifier | Writes normalized facts in one future transaction. |
| `workbookReview` | Accounting | Imported version exists | Review attestation | Review evidence only. |
| `workbookPublish` | Accounting | Review passed; all mandatory checks pass | Publication receipt | Publishes exactly one compatible version. |
| `workbookRollback` | Accounting plus Representative | Two independent approvals; prior published version exists | Rollback receipt | Appends a restore/supersede event; never overwrites facts. |

## Common Rules

- Commands accept fixed structured input only. Arbitrary SQL, RPC dispatch, raw table names, and client-selected publication states are rejected.
- `workbookImport`, `workbookPublish`, and `workbookRollback` do not run on a failed or incomplete dry-run.
- The raw Workbook is not stored in a database table. Its approved storage, retention, and deletion model remains a human decision.
- Unconfirmed profit remains `null`, never zero. FC profit is `unavailable`; HQ/EC values are not allocated.
- A missing AM assignment resolves to no access, not a guessed store scope.
- All errors fail closed and expose only safe reason categories to the client.

## Non-Goals

This contract creates no database command, Edge Function, UI control, storage bucket, secret, or permission grant.
