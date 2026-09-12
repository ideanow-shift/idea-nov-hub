# Store/Corporation Effective Operator Gate 5 — Staging result

Date: 2026-09-13
Environment: `idea-nov-staging` (`zgkoofphhivesclehrom`)
Production connection/write: 0

## Result

- Local contract and runtime tests: 35/35 PASS
- Staging validation checks: 24/24 PASS
- Fresh forward: PASS
- Guarded cleanup/rollback: PASS
- Cleanup-after-reapply: PASS
- Reapply: PASS
- `anon` execute: denied (`SQLSTATE 42501`)
- `authenticated` execute: denied (`SQLSTATE 42501`)
- `service_role` RPC execute: allowed
- public RPC: `SECURITY INVOKER`
- private resolver: `SECURITY DEFINER`, empty `search_path`, owner `postgres`
- `service_role` direct private-view/table SELECT: denied (`SQLSTATE 42501`)
- RLS/FORCE RLS: 3/3 fixture tables
- Unresolved store-period: omitted from resolver output
- Duplicate store scope: rejected (`SQLSTATE 22023`)
- Advisor: new RPC-related WARNING 0 / ERROR 0
- Existing unrelated Advisor WARNING: leaked-password protection disabled

## Period switch fixture

The synthetic store resolves to Corporation `0001` in 2024-12 and Corporation
`0002` from 2025-01. A three-month query returned exactly three rows and preserved
the switch at the effective-period boundary. No real Store, Corporation, POS, or
employee data was used.

## Public-table invariant

Before and after validation:

- regular/partitioned `public` tables: 35
- definition manifest hash: `0eb80bf3514d820e08b9af49380c7f99`
- exact-count manifest hash: `17861de0c5d42968576e14b40606b1e1`
- total rows: 8,663
- DBF monthly facts: 5,656
- DBF budget facts: 0

Final cleanup confirmed that the temporary `identity_access` schema, private
resolver, and public candidate RPC no longer exist in Staging.

## Gate status

- Staging database validation: PASS
- Backend/UI local integration validation: PASS
- Production RPC migration: BLOCKED pending separate Owner approval
- Production Edge Function deployment: BLOCKED pending separate Owner approval
- Static application publication: BLOCKED pending separate Owner approval
- Historical inactive-store discovery: BLOCKED pending contract decision
