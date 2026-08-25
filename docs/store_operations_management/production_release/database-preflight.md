# Production Database Preflight

Read-back: 2026-08-25. Target: `idea-nov-core` (`nkmxevmioczcmnldreyo`). No change was applied.

| Order | Migration | SHA-256 | Classification |
|---:|---|---|---|
| 1 | `20260814140109_dbf_business_data_phase1_foundation.sql` | `B366620D251E01583B3EE8AF0F559C70ED58D969C1CDBF60EB90D08287A88286` | `READY_TO_PROMOTE` |
| 2 | `20260814204346_dbf_business_data_phase1_service_role_acl_corrective.sql` | `108E10BD5998F825874783BAE8DDB2253D5042B1F6D9049A72D52F67FF4CC5D4` | `READY_TO_PROMOTE` |
| 3 | `20260819002309_dbf_store_monthly_actual_backend_contract_v1.sql` | `EC7164E21016898616A83B6BA154AF6D9A5E518A50E400D478193904CB36BC3B` | `READY_TO_PROMOTE` |
| 4 | `20260819123648_dbf_store_monthly_comparison_read_v1.sql` | `1A65CC0B73295EA858033101FD1C34AA8E1734F773423711CAA2A37AD2ACFF37` | `READY_TO_PROMOTE` |

## Catalog result

- `dbf_ingest`, five DBF fact tables and all three Store Monthly read RPCs are absent.
- No same-name conflict or partial application was found.
- The chain is additive/forward-only and contains no Production data population, `TRUNCATE` or business-row deletion.
- Foundation enables RLS and FORCE RLS and removes browser access.
- Read functions use fixed search paths and service-role-only execution; `anon` and `authenticated` execution is revoked.
- PostgreSQL 17 CI applies the exact four-file order and tests read-RPC rollback while preserving Canonical Fact tables.

## Preconditions

Exact target ref, migration ledger and checksums must match. Required roles and `extensions.pgcrypto` must exist. Stop on drift or any partial object.

## Rollback capability

Read RPCs can be revoked and exact signatures removed after API/frontend rollback. Foundation tables and Canonical Facts are deliberately preserved. A destructive full schema rollback is prohibited.
