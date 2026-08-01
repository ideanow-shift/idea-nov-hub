# IDEA NOV OS Production Read-only Audit Runner

## Status

Architecture and contract only. This document authorizes no production connection, credential creation, privilege change, query execution, migration, deployment, or data mutation.

## Objective

Provide one sealed OS-common runner that lets an approved operator execute a small, pre-reviewed set of production audit queries while making a mutation technically unavailable at every layer.

The runner is not a SQL console. It accepts an approved audit-pack identifier and fixed query identifiers only.

## Safety Model

Production read-only access is allowed only when all five independent boundaries pass:

1. **Project identity**: the selected production project matches a private approved identity profile.
2. **Read-only database identity**: the database login is a dedicated least-privilege audit role, never a service role.
3. **Sealed runner**: the executable, audit manifest, and query templates match their reviewed SHA-256 identities.
4. **Query allowlist**: every submitted query is selected by fixed identifier from the sealed manifest; free-form SQL is impossible.
5. **Read-only transaction**: the session starts a `BEGIN READ ONLY` transaction with restrictive timeouts and no write privileges.

Failure of any boundary is `SAFE_STOP`; zero queries run and no automatic retry occurs.

## Architecture

```text
Approved operator
  -> sealed Production Audit Runner
  -> private identity comparison
  -> private credential broker
  -> dedicated production audit login
  -> BEGIN READ ONLY + restrictive session settings
  -> fixed allowlist query template
  -> sanitizer / aggregate-only result writer
  -> signed sanitized audit result
```

The private identity profile and credential broker are outside source control. The runner records only pass/fail booleans and non-secret category values.

## 1. Production Project Identity

The operator may not select a project interactively inside the runner. Before opening a database connection, the runner compares the target against a private approved production identity profile containing:

- expected project-ref match boolean;
- expected database host match boolean;
- TLS server identity match boolean;
- environment label exactly `production`;
- production denylist comparison for all known nonproduction hosts/refs.

The profile values, project ref, host, URL, account identifier, certificate material, and connection string are never written to Git, logs, terminal output, screenshots, or audit results.

Required decision:

```yaml
project_identity_pass:
  project_ref_match: true
  host_match: true
  tls_identity_match: true
  environment_label_match: true
  nonproduction_denylist_match: false
```

Any unknown value is failure, not a warning.

## 2. Dedicated Read-only Identity

Create this only in a separate production identity/privilege gate. The intended role has these properties:

```yaml
role_class: dedicated_production_audit_login
service_role: false
superuser: false
bypass_rls: false
create_db: false
create_role: false
replication: false
inherit: false
write_privileges: none
allowed_connection: production_database_only
credential_source: approved_private_broker_only
```

The role receives only:

- `CONNECT` to the approved production database;
- schema visibility required for `information_schema` and `pg_catalog` metadata;
- explicit `SELECT` only where an approved aggregate query requires a business relation.

It receives no `EXECUTE` on application RPCs or functions, no table write privilege, no ownership, no `BYPASSRLS`, and no service-role credential. Default privileges must also exclude it from future write/execute grants.

RLS is not bypassed. If required audit metadata cannot be read through this identity, the run stops and requests a distinct access-policy review; it must not substitute a stronger role.

## 3. Read-only Session Contract

The runner opens one TLS connection, then issues exactly this session preamble before any allowlist query:

```sql
BEGIN READ ONLY;
SET LOCAL statement_timeout = '5s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '10s';
SET LOCAL transaction_read_only = on;
```

The runner verifies `transaction_read_only=on` through a fixed metadata check before query execution. If it cannot verify the value, it rolls back and stops.

At the end of a successful or failed run it issues `ROLLBACK`, closes the connection, and removes the in-memory credential handle. It never issues `COMMIT`, even for a read-only transaction.

## 4. Sealed Runner Contract

The runner package contains:

- executable identity and SHA-256;
- allowlist manifest identity and SHA-256;
- query-template file identity and SHA-256;
- audit-pack ID and version;
- maximum query count;
- result schema and sanitizer version.

The runner takes only:

```yaml
input:
  audit_pack_id: fixed_allowlist_identifier
  operator_approval_reference: non-secret_change_ticket_or_gate_id
```

It does not accept database URL, project selector, SQL text, table name, schema name, query parameters, credentials, or arbitrary output path from the caller.

Any source/manifest/template hash mismatch is `SEALED_RUNNER_MISMATCH` and stops before connecting.

## 5. Query Allowlist

Only manifest entries with all fields below may execute:

```yaml
query_id: immutable_identifier
purpose: fixed_audit_purpose
source_class: information_schema | pg_catalog | catalog | approved_aggregate_select
max_rows: 1000
max_result_bytes: 262144
timeout_ms: 5000
result_contract: aggregate_only | metadata_shape_only
template_sha256: required
```

Permitted SQL grammar is deliberately narrow:

- `BEGIN READ ONLY` only as the session opener;
- a single top-level `SELECT`, optionally with a non-recursive `WITH` clause;
- reads from `information_schema`, `pg_catalog`, and a manifest-enumerated business relation only;
- joins only between manifest-enumerated catalog/metadata relations;
- constants and fixed query-template parameters only.

The runner rejects:

- semicolons in templates except the runner-owned preamble;
- `INSERT`, `UPDATE`, `DELETE`, `MERGE`, `COPY`, `CALL`, `DO`, `EXECUTE`, `CREATE`, `ALTER`, `DROP`, `GRANT`, `REVOKE`, `TRUNCATE`, `VACUUM`, `ANALYZE`, `SET ROLE`;
- RPC/function calls, including user-defined functions in a `SELECT`;
- `SELECT *`, data-export syntax, unbounded result sets, dynamic SQL, temp objects, and transaction-control statements other than the runner-owned opener/rollback;
- direct access to credentials, secrets, auth tables, storage metadata, or notification payload tables unless a later allowlist review explicitly defines an aggregate-only exception.

## 6. Initial Catalog Query Families

Initial production audit packs may include only aggregate or metadata-shape queries for:

1. schema/relation/view/materialized-view counts by approved schema category;
2. column name/type/nullability counts for a named approved relation shape;
3. primary key, foreign key, index, trigger, RLS-enabled, policy, and grant presence/counts;
4. function signature counts, excluding function body/definition;
5. privilege matrix counts for the dedicated audit identity;
6. duplicate/coverage/status aggregate counts where a separate query template has been approved.

No result may include row data, employee/store identifiers, names, emails, raw timestamps, token values, Secret values, function bodies, policy expressions, connection values, or raw errors.

## 7. Limits and Timeout Policy

```yaml
per_query_statement_timeout: 5_seconds
per_query_lock_timeout: 1_second
idle_transaction_timeout: 10_seconds
run_wall_clock_limit: 60_seconds
maximum_queries_per_run: 12
maximum_executions_per_query_id: 1
maximum_rows_per_query: 1000
maximum_sanitized_result_bytes: 256_KiB
retry: disabled
```

If a limit is exceeded, the runner rolls back, records a fixed failure category, and stops. It does not shorten a query and retry automatically.

## 8. Secret and Sensitive Data Policy

- Credentials are acquired only in process memory from the approved private broker after project identity passes.
- Runner logs use a structured allowlist of fields; no generic exception serialization.
- Redaction occurs before writing any result. Patterns for connection strings, bearer values, JWT-like strings, key labels, and secret-like values are replaced with `[REDACTED]`.
- The runner never emits query text with literal values, connection metadata, headers, environment variables, or raw database responses.
- Clipboard, screenshots, shell history, Git, Obsidian, and notification channels receive no secret or raw result.

## 9. Sanitized Audit Result

The result uses this fixed shape:

```yaml
audit_pack_id: fixed_identifier
runner_version: version_only
runner_integrity: pass | fail
project_identity: pass | fail
read_only_session: pass | fail
query_count: nonnegative_integer
query_results:
  - query_id: fixed_identifier
    status: pass | fail | skipped
    result_category: aggregate_only | metadata_shape_only | safe_stop
    sanitized_metrics: fixed_count_or_boolean_keys_only
run_status: complete | safe_stop
mutation_executed: false
secret_exposure_detected: false
```

`safe_stop` reports a fixed category such as `PROJECT_IDENTITY_MISMATCH`, `AUDIT_ROLE_UNAVAILABLE`, `SEALED_RUNNER_MISMATCH`, `READ_ONLY_SESSION_UNVERIFIED`, `QUERY_POLICY_REJECTED`, or `QUERY_LIMIT_EXCEEDED`. It does not expose raw driver/database error text.

## 10. Read-only Flow

1. Operator selects a pre-approved audit-pack ID, not a project or SQL statement.
2. Runner validates its own manifest and template hashes.
3. Runner compares the private production identity profile; mismatch stops before connecting.
4. Runner obtains the dedicated audit credential from the private broker.
5. Runner opens one TLS connection and starts the read-only session contract.
6. Runner validates `transaction_read_only=on`.
7. Runner executes each allowlisted query once, within count/time/result limits.
8. Runner sanitizes each result to fixed metrics only.
9. Runner rolls back, closes the connection, clears in-memory credentials, and writes the sanitized result.

## Required Future Gates

1. Production identity profile and independent operator verification procedure.
2. Dedicated audit role DDL/GRANT/RLS current-state review and limited execution.
3. Credential-broker integration and secret-handling review.
4. Sealed runner implementation with hash verification and query parser/manifest tests.
5. Per-audit-pack query review with exact templates and result schemas.
6. One controlled production read-only smoke with a catalog-only query, followed by sanitized post-check.

Until all relevant gates pass, the correct behavior is the current one: do not connect and do not execute any `SELECT`.
