# Phase 3 Owner UAT Profit-State Evidence

Date: 2026-09-21
Portfolio lock: `CTO-PORTFOLIO-EXECUTION-ORDER-2026-08-22-V4`
Phase: `PHASE_3_STORE_OPERATIONS_MANAGEMENT_V1`
Environment: Production read-only Store Operations application
Evidence status: `OWNER_PASS_UAT_P3_09_ONLY`

## Scope

This record captures Owner acceptance evidence for only the profit-state portion of
`UAT-P3-09`. It does not record Sales Department acceptance, close the complete
13-item UAT, authorize a Phase transition, or authorize any database or application
change.

## Released source

| Item | Fixed value |
| --- | --- |
| Pull request | `#212` |
| Approved feature head | `98ee233d4291236dce5025141b27555f90cceb3a` |
| Production main SHA | `fd0b59609d3a2e1f1485333438f96cdce5696712` |
| FC profit-signal UI bundle SHA-256 | `6EED773C5E1A78ADB00F32556EB068188D09D73257D43FFEB92A8B6F567CFD40` |
| GitHub Pages workflow run | `35553185835` |
| Workflow result | `SUCCESS` |

The Production release changed the GitHub Pages UI only. Production Edge deploy,
database DDL, database DML, and business-data mutation were all zero.

## Owner screen evidence

The evidence files remain outside the repository. Only non-PII observations and
their SHA-256 fingerprints are recorded here.

| View | Observed result | Evidence SHA-256 |
| --- | --- | --- |
| 2026-06, all stores | Profit confirmation month is 2026-06 and profit state is confirmed | `3FD356A30A25EC6C62BEA0215BDBEA97691382E8E04D302EEABAB80F2532FC14` |
| 2026-07, all stores | Profit confirmation month remains 2026-06 and the selected-month profit state is preparing | `7B30ED0FAB58922BFD1CC5C7C2D3B6C84B08BEF9F0ACD8408E4B70A98321B5DC` |
| 2026-06, FC scope | Both the executive profit signal and the FC summary display `V1対象外`; seven FC stores are represented | `EB266502D5FB42BBAD0C360E94D9FE596255F6CFC6DD1DA59C17898D9BB16CC4` |

No screen displayed unavailable profit as zero, and the three distinct states were
not collapsed into one another.

## Read-only postflight

| Check | Result |
| --- | --- |
| Production Pages root | HTTP 200 |
| Production Store Operations route | HTTP 200 |
| Published `app.js` | HTTP 200; contains the released `V1対象外` branch |
| Production Edge liveness | HTTP 200 / `LIVE` / `dataAccessed:false` |
| CORS preflight | HTTP 204 |
| Unauthenticated Store Operations read | HTTP 401 |

## UAT disposition

| UAT case | Owner result | Sales Department result | Final case status |
| --- | --- | --- | --- |
| `UAT-P3-09` Profit state | `PASS` | `NOT_RUN` | `PENDING_SALES_ACCEPTANCE` |

The overall Phase 3 Owner / Sales UAT remains `PENDING`. The remaining 12 business
cases and Sales Department acceptance must be recorded separately. Repeat rate and
retail purchase rate remain `準備中` until their formal sources are approved.
