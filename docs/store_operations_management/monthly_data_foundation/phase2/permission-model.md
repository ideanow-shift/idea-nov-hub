# Permission Model

## Server-Side Resolution

All role, organization, and store-scope decisions are resolved server-side from the canonical HUB session and approved employee/store assignment source. Browser-supplied roles, store IDs, scopes, publication flags, or approval claims are ignored.

| Actor | Import Center permissions | Published monthly projection |
|---|---|---|
| Accounting | Upload, dry-run, validate, import, review, publish | Read when business role permits. |
| Representative | No implicit import permission | Read all 20 stores; provides second rollback approval. |
| Sales Director | None | Read published direct-store 13 only. |
| AM | None | Read only effective employee-master assignments; no assignment is deny-by-default. |
| Store Manager | None | Read own approved store scope only. |
| General Employee | None | `403` for monthly Store Operations data. |

## Rollback Separation

`workbookRollback` requires Accounting approval and Representative approval from separate approval records. A single client action, shared browser session, or inferred role cannot satisfy both.

## Open Gate

The repository contains HUB session verification logic, but a reusable canonical server-side verifier module and its supported claims have not been confirmed for this new boundary. No alternate issuer, token format, or client-side fallback may be created. This is a blocking ownership decision before implementation.

## Data Rules

- Published-only facts are readable.
- FC operating profit is unavailable in V1.
- HQ and EC facts are not allocated to stores.
- Missing scope, expired assignment, invalid session, or failed resolver returns deny-by-default.
