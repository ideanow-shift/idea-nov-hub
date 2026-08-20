# Production Database Preflight

Read-back date: 2026-08-20. Target: `idea-nov-core` (`nkmxevmioczcmnldreyo`). All checks were read-only.

| Migration | Result | Evidence |
|---|---|---|
| `20260814140109_dbf_business_data_phase1_foundation.sql` | REQUIRED | `dbf_ingest` and all five DBF fact tables are absent. No same-name conflict or partial object was found. |
| `20260814204346_dbf_business_data_phase1_service_role_acl_corrective.sql` | REQUIRED | Foundation tables are absent; the service-role-only ACL corrective must follow foundation. |
| `20260819002309_dbf_store_monthly_actual_backend_contract_v1.sql` | REQUIRED | `dbf_store_monthly_actual_read_v1(date,uuid,uuid[])` is absent. |
| `20260819123648_dbf_store_monthly_comparison_read_v1.sql` | REQUIRED | Both range RPC signatures are absent. |

Schema drift classification: **MISSING, COMPATIBLE PRECONDITION**. The relevant namespace, tables and functions do not exist, so there is no conflicting definition to overwrite. This does not authorize applying the files.

## Frozen order

1. Re-run this catalog preflight and record the exact Production schema snapshot.
2. Foundation.
3. Service-role ACL corrective.
4. Actual read RPC.
5. Actual/budget comparison read RPCs.
6. Verify tables, constraints, indexes, RLS/FORCE RLS, direct ACLs, function signatures, `security invoker`, fixed `search_path`, and service-role-only execution.
7. Verify confirmed/active filtering and `preparing-not-zero` behavior before API deployment.

The foundation is intentionally additive but refuses partial or duplicate application. Any newly discovered same-name object changes the result to `CONFLICT`; stop instead of editing Production in place.
