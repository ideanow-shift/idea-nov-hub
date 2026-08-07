# PR002 / M013 Account Master & Statement Mapping Release Gate

| Item | Contract |
|---|---|
| Program allocation | ACF-02 = M013 |
| Depends on | M001-M011, M061, M012 |
| Scope | Canonical Account identity, immutable Account versions, typed P/L and B/S mappings |
| Excluded | M014+ lifecycle, Facts, data load, Cash Flow Fact, Publication, Projection, Consumer API |
| Staging Apply | Prohibited until separate Owner authorization |

## Physical boundary

M013 creates only `accounting.account_identities`, `accounting.accounts`, and
`accounting.account_statement_mappings`. Stable `account_id` values are Staging-issued
Canonical UUIDs. No Production internal ID or raw source identifier is stored.

`accounts` is append-only history. Business time is the half-open interval
`[effective_from, effective_to)`. The one current-row rule is: `status='active'` and the
requested as-of date is contained by `effective_period`; there is no mutable “latest” row.
Overlapping versions for one identity and overlapping reuse of an account code are rejected.
Every correction is a new version row with optional `supersedes_account_version_id`.

## Statement contract

- P/L Accounts use `statement_type='pl'` and `measure_type='period_flow'`.
- B/S Accounts use `statement_type='bs'` and `measure_type='ending_balance'`.
- Frozen P/L categories: revenue, cost of sales, gross profit, personnel cost,
  operating expense, operating profit.
- Frozen B/S categories: current/noncurrent asset, current/noncurrent liability, equity.
- Mapping rows accept only P/L or B/S. Cash Flow remains a later derived Projection concern.
- Mapping/account statement mismatch, duplicate effective mapping, invalid display order,
  and inconsistent aggregation sign fail at registration.

## Security and immutability

All three tables have enabled and forced RLS. PUBLIC, anon, authenticated, and service_role
receive no direct table/function access. All trigger functions are SECURITY INVOKER with an
empty search path. No raw Account Master view or Consumer API is created before M018.
Identity, Account version, and mapping rows reject UPDATE and DELETE unconditionally.

## Artifacts

- Forward: `supabase/migrations/20260807122604_m013_bdf_account_master_statement_mapping.sql`
- Rollback: `supabase/rollback/pr002/m013_bdf_account_master_statement_mapping.rollback.sql`
- Validation: `supabase/validation/pr002/validate_m013.sql`
- DB negative test: `supabase/validation/pr002/test_m013_account_mapping.sql`
- Static test: `tests/bdf-pr002-m013-contract.test.mjs`

## Release gates

1. Static contract and `git diff --check` pass with M001-M012 unchanged.
2. Disposable PostgreSQL 17 applies M001-M011, M061, M012, then M013.
3. Validation and synthetic negative tests pass with fixture residue zero.
4. M013-only rollback leaves the M012 baseline intact.
5. Full reverse rollback leaves BDF objects zero; clean reapply has identical catalog.
6. Commit requires the Owner's post-rehearsal decision. Staging Apply and M014 remain blocked.

## Local Fresh DB evidence

| Check | Result |
|---|---|
| Runtime | PostgreSQL 17.10 / UTF8 / disposable Windows cluster |
| Forward | M001-M011, M061, M012, M013: 14/14 PASS |
| M013 Validation | PASS |
| Synthetic negative test | PASS; transaction rollback; fixture residue 0 |
| M013-only rollback | PASS; M012 three-table boundary remained |
| Full rollback | 14/14 PASS; Core/Governance/Projection/Accounting schema residue 0 |
| Reapply | 14/14 PASS |
| Catalog equality | SHA-256 `188ecb1f2ffc73f616c9c5c703968d26fd9294777fa03ef2d9402814fa2ab345` on both runs |
| Static/regression | 57/57 PASS, including M013 9/9 |
| Existing M001-M012/M061 changes | 0 |
| Cloud/Production/Staging connection | 0 |
| Cleanup | PostgreSQL stopped; database/runtime/archive removed; rehearsal listener 0 |

Current decision: **AUTHORING AND LOCAL FRESH DB PASS — COMMIT REVIEW MAY BEGIN**.
Staging Apply and M014 authoring remain prohibited.
