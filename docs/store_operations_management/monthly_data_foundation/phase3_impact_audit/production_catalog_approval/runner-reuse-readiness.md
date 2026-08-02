# Catalog Attestation Runner Reuse Readiness

## Decision

**CONDITIONAL PASS: source-only reuse pack ready; Production execution not approved.** The existing `production-read-only-audit-runner` framework was reused unchanged for its identity gate, dedicated audit-login requirement, read-only transaction lifecycle, timeout contract, twelve-query execution ceiling, rollback/close behavior, and sanitizer/result-schema boundaries.

The fixed registry is extended only with C01 through C04 for this catalog scope. The runner still accepts query IDs only, refuses arbitrary SQL, rejects writable or service identities before opening a connection, and has no connection profile or credential value in this repository.

## Query Extension

| ID | Fixed metadata-only purpose | Output boundary |
| --- | --- | --- |
| C01 | Accounting lifecycle relation, column, key, index, and RLS inventory | catalog names, types, booleans, bounded counts |
| C02 | Store Master, employee assignment, and crosswalk-candidate structure | catalog names, types, booleans, bounded counts |
| C03 | relation grants, sanitized role category, BYPASSRLS boolean, and policy command | role categories only; no role names or credentials |
| C04 | function/RPC metadata | schema/function names, security-definer boolean, argument and return types; no body or invocation |

## Execution Gate

Production execution remains disabled until all six conditions are approved: production identity profile match; least-privilege audit role; C01-C04 SQL and result schemas; sealed source hash; approved execution window; and approved evidence-retention location. The canonical HUB Session verifier is explicitly outside this database catalog pack.

## Safe Result

This sprint executed no Production connection and no SQL. It does not create or alter database objects, roles, grants, policies, functions, migrations, or deployments.
