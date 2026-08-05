# Fixed Query Catalog

The complete immutable SQL text is in [query-registry.mjs](../../../review/production-read-only-audit-runner/query-registry.mjs). Query IDs are the only executable input. Each has a 5-second timeout, 1,000-row maximum, metadata/aggregate-only result contract, and no parameters.

| ID | Purpose | Result shape | Failure |
| --- | --- | --- | --- |
| Q01_SCHEMA_CATALOG | approved schema presence | schema names | `AUDIT_QUERY_FAILED` |
| Q02_STORE_TABLE_CANDIDATES | store relation catalog | schema, relation, kind | `AUDIT_QUERY_FAILED` |
| Q03_PUBLIC_STORES_COUNT | `public.stores` count | count | `AUDIT_QUERY_FAILED` |
| Q04_CORE_STORES_COUNT | `core.stores` count | count | `AUDIT_QUERY_FAILED` |
| Q05_CURRENT_STORE_IDENTITY | column shape | schema/table/column/type/nullability | `AUDIT_QUERY_FAILED` |
| Q06_TOKOROZAWA_CANDIDATES | fixed-name candidate counts | schema/count | `AUDIT_QUERY_FAILED` |
| Q07_STORE_FK_REFERENCE_COUNTS | FK reference counts | source relation/count | `AUDIT_QUERY_FAILED` |
| Q08_STORE_VIEW_REFERENCES | declared view dependency counts | view/count | `AUDIT_QUERY_FAILED` |
| Q09_STORE_FUNCTION_REFERENCES | function dependency counts, no bodies | schema/count | `AUDIT_QUERY_FAILED` |
| Q10_STORE_OPERATION_HISTORY | history relation shape | schema/table/column/type | `AUDIT_QUERY_FAILED` |
| Q11_RLS_AND_POLICIES | RLS/policy presence | relation/boolean/count | `AUDIT_QUERY_FAILED` |
| Q12_READONLY_GUARD_VERIFICATION | runner-owned read-only state check | boolean-equivalent setting | `READ_ONLY_SESSION_UNVERIFIED` |

No template has dynamic SQL, a user-controlled identifier, RPC, write CTE, `SELECT INTO`, `COPY`, `EXPLAIN ANALYZE`, lock, advisory lock, or user-defined function. Q12 uses a reviewed built-in setting accessor solely to verify the transaction guard; it is not an application function or RPC.
