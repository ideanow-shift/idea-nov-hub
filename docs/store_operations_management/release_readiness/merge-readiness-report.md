# Merge Readiness Report

## Decision

PASS: merge preparation is complete. No merge or deployment was performed.

## Dependency and conflict result

- `5a4ab99` is an ancestor of `c953c63`.
- Dashboard V1.1 is fully retained by the HUB branch.
- Sequential merging has no Git ancestry or file conflict because the branches form a strict stack.
- Opening both branches against `main` at the same time creates 32 duplicate commits and 269 duplicate files in review.
- Merging the HUB branch first would make the V1.1 PR obsolete and should not be done.

## Shared NOV HUB impact

The HUB commit changes shared files `portal/apps.json`, `portal/js/apps.js`, `portal/js/employees.js`, `portal/js/main.js`, and `portal/js/nov-navi-dashboard.js`. Changes are limited to Store Operations registration, demo AM identity, launch routing, and an allowed-role-aware NOV Navi card.

- NOV Talent: no Talent implementation or authentication file changed. Its card and session flow remain intact.
- IDEA LINK, Finance, Attendance: no app-specific implementation changed.
- Existing NOV Navi visibility: the new `allowedTags` branch is exercised only by the new Store Operations system entry; existing system cards do not gain new restrictions.
- App Registry: canonical ID is `store-sales-management`; `store-sales-preview` remains a compatibility alias. Before Staging registration, ensure the registry contains one active card, not separate old and new records.

## Security and permission result

- representative: all stores
- sales manager: 13 direct stores
- area manager: assigned stores
- store manager: own store
- general employee: card hidden; direct access forbidden
- missing session and expired session remain distinct
- Preview Mock Identity requires both a HUB launch context and an available canonical HUB session
- integration/staging reject Mock Identity by feature-flag boundary
- production remains fail-closed with `PRODUCTION_NOT_APPROVED`

No DB, Supabase, JWT, RLS, Runtime, Permission Model, UUID, migration, Production, or deployment change is included.

## Dashboard retention

The HUB branch retains Dashboard V1.1's six executive signals, shared current/prior trend, sales budget ratio, profit/customer/product details, and assigned AM column. Store Operations targeted tests pass on both commits.

## Test evidence

| Commit | Targeted Store Operations | Full suite | Known failures |
|---|---:|---:|---:|
| `5a4ab99` | 230/230 PASS | 460/475 PASS | 15 |
| `c953c63` | 236/236 PASS | 466/481 PASS | 15 |

The normalized failure-name set is identical between the two commits. New failures: 0. The 15 failures are outside the HUB integration delta and cover GAS retirement, Management data intake/workforce evidence, and NOV Talent freshness/workspace assertions.
