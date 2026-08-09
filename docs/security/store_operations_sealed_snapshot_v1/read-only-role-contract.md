# Read-only Role Contract

## Purpose

Source and Target each require a separate, expiring audit login. The role is
not `service_role`, does not bypass RLS, and can execute only the private
broker's sealed fixed `SELECT` artifacts. A transaction-level `BEGIN READ ONLY`
is necessary but is not sufficient proof of a least-privilege login.

## Effective Role Closure

`SOCE-QP01` evaluates the logged-in role and every Role that it can reach by
PostgreSQL 17 membership metadata. The closure follows direct and nested
`pg_auth_members` rows using both `inherit_option` and `set_option`; it records
the membership path and stops cycles. A Role reachable only through
`NOINHERIT` still belongs to the closure when `SET ROLE` is allowed. A
membership carrying `ADMIN OPTION` is rejected because it is a role-membership
write path.

Safe membership is permitted only when every reached Role is safe. The check
does not require a blanket `NOINHERIT` policy.

## Required Runtime Proof

| Gate | Required result |
|---|---|
| Session state | `transaction_read_only=on` and `default_transaction_read_only=on`. |
| Role attributes | Every reachable Role has `rolsuper`, `rolcreatedb`, `rolcreaterole`, `rolreplication`, and `rolbypassrls` set to false. |
| Database ownership | No reachable Role owns `current_database()`. |
| Schema ownership | No reachable Role owns any non-System Application Schema. |
| Object ownership | No reachable Role owns an Application relation, routine, type/domain, or extension. |
| DDL | No reachable Role has effective database or Application Schema `CREATE`; ownership also closes `ALTER`/`DROP` paths. |
| TEMP | No reachable Role has effective `TEMPORARY` privilege, including `PUBLIC` grants. |
| DML / sequences | No reachable Role has effective `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER`, sequence `USAGE`, or sequence `UPDATE`. |
| Application routines | No reachable Role has effective `EXECUTE` for a function, procedure, aggregate, or window function in any Application Schema, including `PUBLIC` grants. |
| Role switching | No inherited, settable, nested, or membership-admin route reaches an unsafe Role. |

The source and target fixed outputs return only a sanitized current-Role
reference, completion flags, an Application Schema set digest, and counters.
Every dangerous counter must be zero. The runner independently verifies every
counter and completion flag; it does not trust only the aggregate
`read_only_role_contract_passed` flag.

## Application Schema Contract

The private approved Schema/Column Contract fixes, per side, the exact count
and MD5 digest of the sorted non-System Application Schema set. `SOCE-QP01`
inspects all non-System schemas, not a `public`/`core` allowlist. A new,
missing, or otherwise mismatched Application Schema stops before Stage 1.
System schemas are limited to the fixed `pg_*` family and
`information_schema` exclusion.

## Failure Rule

A missing field, `NULL`, unexpected type, negative counter, incomplete closure
scan, mismatch of the approved Application Schema set, or any non-zero danger
counter is `READ_ONLY_ROLE_REJECTED`. The runner then executes no Stage 1
Domain Query, creates no Snapshot, Manifest, or final artifact, rolls back any
opened read-only sessions, and closes the broker session.

## Permission Boundary

The future private SQL may read only the object set and logical columns named
in the separately approved Schema/Column Contract. It cannot accept caller
SQL, a function name, an RPC request, or an export request. Any required
privilege, role, or ownership change remains a separate Owner decision; this
package grants nothing.
