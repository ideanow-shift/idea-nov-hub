# Store Operations Sealed Snapshot v1.3.0 Security Corrective

## Decision

Package `store-operations-consumer-enablement-sealed-snapshot-v1` version
`1.3.0` is an additive corrective. Version 1.2.0 remains byte-immutable. The
corrective avoids global PUBLIC ACL hardening and makes ambient PUBLIC TEMP and
routine EXECUTE capabilities unreachable from the one-time Snapshot execution
path. It does not provision a role, credential, grant or RLS policy and does
not connect to Source or Target.

## Execution-path containment

The Source and Target profiles bind distinct expected Snapshot role names. A
connection must attest `session_user = current_user = expected role`, default
and current transaction read-only, `REPEATABLE READ`, `search_path=pg_catalog`,
an open transaction, no assigned transaction ID, no temporary schema, no DML
counters, no advisory lock, no prepared statement and no LISTEN channel.

The Broker exposes `executeFixedQuery` only. Generic, raw, interactive,
prepared and caller-supplied SQL interfaces are forbidden. Each execution is
bound to Package ID/version, Query ID, pack, ordinal, total count, SQL SHA-256,
security-AST SHA-256 and the security allowlist hash. The runner rechecks the
session immediately before every Query and checks final query order and
no-write evidence before rollback and connection close. Retry remains zero.

## SQL and catalog allowlist

Every Query is parsed into the fail-closed
`SOCE-POSTGRES-SELECT-SECURITY-AST-v1` shape. It allows exactly one SELECT or
WITH-SELECT statement. DML/DDL, modifying CTE, SELECT INTO, row-lock clauses,
CALL/DO/COPY, SET/RESET, role/session authorization changes,
PREPARE/EXECUTE, temporary/unlogged objects, dynamic SQL and transaction
control are rejected.

The generated `security-allowlist-v1.json` fixes each Query's relations,
qualified column references, identifiers digest, functions, operators and AST
hash. Function and operator catalogs contain explicit `pg_catalog` signatures;
the namespace as a whole is never allowed. Catalog attestation requires every
signature to resolve, rejects application/extension/SECURITY DEFINER routines
and is hash-bound into the Owner execution authorization and Package Lock.

## PUBLIC capability boundary

QP01 continues to record effective TEMP and application routine EXECUTE.
Their mere PUBLIC-derived presence no longer fails the role contract. Direct
application routine EXECUTE, direct write/sequence/schema/database CREATE,
ownership, membership-admin, SET ROLE reachability, superuser, replication,
CREATEDB, CREATEROLE, BYPASSRLS and service-role reachability remain blocking.
Containment requires the Broker to attest that TEMP/routine invocation,
generic SQL, interactive SQL and dynamic SQL are unavailable.

## Runtime termination

Successful and failed paths both issue ROLLBACK before connection close. A
cleanup failure fails the run and revokes or quarantines any output. No COMMIT
is available to the Snapshot connection path. Query count/order/hash mismatch,
identity drift, read-only drift, catalog drift, XID assignment, temporary
schema creation, DML counter change, lock/prepared/listener residue or cleanup
failure is fail-closed.

## Database boundary

This corrective changes zero Production or Staging database objects and zero
PUBLIC ACLs. Later provisioning is separately authorized and limited to two
isolated expiring roles, minimum SELECT/RLS bindings and private credentials.
Snapshot execution, Store Operations binding, AUTH-01 and Staging population
remain outside this change.
