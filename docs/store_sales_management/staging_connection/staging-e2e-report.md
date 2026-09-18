# Store Sales API Staging E2E Report

## Actual environment execution

No live Staging E2E was executed. A real Staging URL, verified server session verifier, and both read-only ports are unavailable. The run count is zero.

## Local server-boundary E2E results

| Case | Expected result | Result |
| --- | --- | --- |
| Representative | exact current 20 stores | PASS |
| Sales director | Direct 13 only | PASS |
| Area manager without approved assignment | 403 `AM_SCOPE_UNASSIGNED` | PASS |
| Store manager | own store only | PASS |
| Employee | 403 `STORE_SCOPE_DENIED` | PASS |
| Legacy Tokorozawa reference | server access-port resolution only | PASS |
| FC profit V1 | `null` / `unavailable` | PASS |
| Missing Accounting projection | `null` / `preparing`, no fallback | PASS |
| Store Master not exactly 20 | 503 `STORE_MASTER_UNAVAILABLE` | PASS |

`deno test tests/store-sales-staging-api.test.ts`: **9/9 PASS**.

## Deferred live E2E checks

- authenticated representative, sales director, store manager, and employee requests against the Staging HTTPS URL;
- server-side scope receipt without actor identifiers in reports;
- exact active 20-store result from `public.stores`;
- unconfirmed profit and FC profit result states;
- browser console errors and warnings equal zero after a separate runtime deployment;
- proof that the browser has no database credential and that the handler has no fallback path.
