# Store Operations V1 Production Release Manifest

Status: release package only; no Production operation is authorized by this document.

| Field | Frozen value |
|---|---|
| Portfolio lock | `CTO-PORTFOLIO-EXECUTION-ORDER-2026-08-18-V2` |
| Source main SHA | `9ee960946896f79372c170880ba15520a0b55c36` |
| Production project | `idea-nov-core` / `nkmxevmioczcmnldreyo` |
| Current API | `nov-hub-api v126` |
| Target API source tree SHA | `6868342e45c2b63830c86867fb50caedd0366a0c` from source main |
| Frontend target | GitHub Pages `portal`, with `runtime-config.production.js` activated only by the approved workflow input |
| NOV HUB launch | Already deployed; reuse `store-sales-management` and `./store-sales/index.html` |
| Business Data write | 0 |
| Data copy | 0 |
| Approval | Owner approval and exact main SHA are mandatory |

## Required release units

1. Database: four migrations listed in `database-preflight.md`, in the frozen order.
2. API: deploy `nov-hub-api` only after DB verification succeeds.
3. Frontend: invoke the existing Pages workflow with both approval booleans and the exact approved main SHA.
4. Launch: no new registration; read back the existing card, route and role visibility.
5. Hosted smoke: execute `hosted-smoke-plan.md`; rollback immediately on a blocking failure.

Staging facts, including the 鷺ノ宮店 pilot, must never be copied. Production facts enter only through the Production DBF Single Ingestion Entry after separate Owner action.
