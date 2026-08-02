# Edge Function Candidate Plan

## Candidate Endpoints

| Candidate | Responsibility | Authorization | Data boundary |
|---|---|---|---|
| `store-operations-import-center` | Hosts the seven fixed Workbook lifecycle commands and calls the Phase 1 parser. | Canonical HUB session, Accounting role; separate rollback approval path. | Fixed command payloads only; no arbitrary SQL or browser DB credential. |
| `store-operations-monthly-projection` | Returns published monthly Store Operations data for resolved scopes. | Canonical HUB session plus server-side role/store scope. | Latest compatible published version only; no synthetic fallback. |

## Prerequisites

- The canonical reusable HUB session verifier must be identified and approved by its owner.
- Catalog attestation must confirm accounting lifecycle and Core Master objects.
- Security must approve the future RLS/grant plan.
- A sanctioned storage design must exist before accepting Workbook bytes.
- Staging deployment approval is required after implementation and tests.

## Failure Behavior

Missing or invalid session is `401`/`403`; missing scope is deny-by-default; missing snapshot/profile, lifecycle inconsistency, or Store Master 20/13/7 inconsistency is a safe unavailable/`503` result. There is no synthetic data fallback.

## Non-Execution

Neither function exists, is deployed, or has secrets configured under this plan.
