# Store Corporation Effective Operator Production Postflight

- Date: 2026-09-13 (Asia/Tokyo)
- Project: `idea-nov-core`
- Project ref: `nkmxevmioczcmnldreyo`
- Portfolio lock: `CTO-PORTFOLIO-EXECUTION-ORDER-2026-08-22-V4`
- Current phase: `PHASE_3_STORE_OPERATIONS_MANAGEMENT_V1`
- Approved DDL: `store-corporation-effective-operator-rpc-v1.review-only.sql`
- Approved and executed SHA-256: `855143AFD0FD63AFC7583BED0385901086D84D2FBD5B193FCF75A2E5F15C5908`
- Migration: `20260912224211_store_corporation_effective_operator_rpc_v1_20260913`

## Result

PASS. The approved DDL was applied once as one Production migration.

Created objects:

- Private resolver: `identity_access.store_corporation_effective_operator_range_read_internal_v1(date,date,uuid[])`
- Public invoker RPC: `public.store_corporation_effective_operator_range_read_v1(date,date,uuid[])`

The private resolver is `SECURITY DEFINER`; the public wrapper is `SECURITY INVOKER`.
Both functions are owned by `postgres`, have an empty `search_path`, and have comments.

## Privileges and runtime checks

- `service_role` schema `USAGE`: PASS
- `service_role` private resolver `EXECUTE`: PASS
- `service_role` public RPC `EXECUTE`: PASS
- `service_role` runtime call using a non-existent synthetic UUID: PASS (0 rows)
- `anon` public RPC call: denied with SQLSTATE `42501`
- `authenticated` public RPC call: denied with SQLSTATE `42501`
- `service_role` direct `SELECT` on history set table: denied
- `service_role` direct `SELECT` on history row table: denied
- `service_role` direct `SELECT` on publication table: denied
- `service_role` direct `SELECT` on private history view: denied
- Function ACLs: only `postgres` and `service_role` have `EXECUTE`

An effective-date transition check returned two consecutive monthly rows for one store with two different corporations. No current operator was backcast into the prior month.

## Data and public-table invariants

Canonical history remained unchanged:

- History sets: 1 -> 1
- History rows: 29 -> 29
- Active publication rows: 1 -> 1
- Active private view rows: 29 -> 29

`public` regular/partitioned table manifest remained unchanged:

- Table count: 112 -> 112
- Definition manifest: `108a0c01e50ad4ec8a389e3c06698709` -> same
- Exact-count manifest: `3ed4046e2b2b97d82c2a108ad6c84423` -> same
- Total rows: 58,683 -> 58,683

Production DML: 0. No table `SELECT` grant, Edge Function deployment, application publication, or public-table change was performed.

## Advisor

Supabase Security and Performance Advisors were checked after the migration. There are no new WARNING or ERROR findings for either resolver function. Existing project-wide findings and informational findings on the pre-existing private history tables remain outside this migration's approved scope.

## Remaining gates

- Edge Function deployment: BLOCKED pending separate Owner approval
- Application publication: BLOCKED pending separate Owner approval
