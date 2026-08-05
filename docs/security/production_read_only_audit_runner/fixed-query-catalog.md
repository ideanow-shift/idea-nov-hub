# Core Master Fixed Query Catalog

The immutable SQL text is in [query-registry.mjs](../../../review/production-read-only-audit-runner/query-registry.mjs). The runner accepts Query IDs only; SQL, identifiers, filters, and parameters cannot be supplied by the requester. Each query has a 5-second statement timeout, returns no more than 1,000 metadata or aggregate rows, and has no parameters.

| ID | Purpose | Safe output | Stop condition |
| --- | --- | --- | --- |
| C01_TARGET_RELATIONS | Confirm the five approved relations exist | schema, relation, kind | missing relation or query failure |
| C02_COLUMN_SHAPE | Read column names, types, and nullability | metadata only | query failure |
| C03_CONSTRAINTS | Read PK, FK, and unique constraint shape | kind and key-column count | query failure |
| C04_INDEXES | Read index and unique-index counts | aggregate metadata | query failure |
| C05_RLS_POLICIES | Read RLS enabled state and policy count | boolean and count | query failure |
| C06_GRANT_SUMMARY | Read granted privilege counts without grantee names | relation, privilege type, count | query failure |
| C07_ROW_COUNTS | Count five relations without returning rows | relation and count | query failure |
| C08_STATUS_COLUMN_CANDIDATES | Identify candidate status/effective-date columns | metadata only | query failure |
| C09_RELATION_DEPENDENCIES | Count dependent views/functions without bodies | relation and counts | query failure |
| C10_READONLY_GUARD_VERIFICATION | Verify the read-only transaction guard | boolean-equivalent setting | `READ_ONLY_SESSION_UNVERIFIED` |

The first attestation intentionally does **not** count active/inactive records or list the 21 store records. C08 establishes the actual status columns without guessing. A second, separately approved fixed pack may then aggregate those confirmed non-personal store fields. Employee rows and assignment rows are never returned.

No template contains dynamic SQL, a user-controlled identifier, RPC, write CTE, `SELECT INTO`, `COPY`, `EXPLAIN`, lock, advisory lock, or user-defined function. C10 uses a reviewed built-in setting accessor only to verify the transaction guard.
