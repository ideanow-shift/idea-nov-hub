# Sandbox Cleanup Plan (Inventory Only)

## Purpose

This plan identifies items that would need a future human-approved action before `idea-nov-shift-status-sandbox` is used exclusively for Store Operations staging. It authorizes no cleanup action.

## Current cleanup findings

| Area | Verified current state | Cleanup target today | Future action only after approval |
| --- | --- | --- | --- |
| Deployed Functions | 0 | none | deploy only the separately reviewed Store Sales API when the environment is approved |
| Registered Secrets | 0 names | none | register a new, Sandbox-only secret set through a protected environment |
| Tables / views | unverified | unknown | catalog-only audit, then classify retain / archive / remove in a separate change request |
| RLS / policies | unverified | unknown | catalog-only audit, then propose deny-by-default policies without changing them |
| Database functions / RPCs | unverified | unknown | catalog-only audit, then classify callable surface before any endpoint is enabled |
| GitHub environment | existing but unprotected | protection configuration required | add reviewer and deployment branch protection in a separate approval |
| Repository synthetic runtime | source-only candidate | do not deploy | preserve as test-only material or retire through a separate source change |

## Mandatory pre-deployment inventory

Before any Store Sales deployment, the Platform Owner and Security Owner must approve one catalog-only audit that records metadata shapes and counts only:

1. schemas, tables, views, materialized views, and database functions;
2. table owner, RLS enabled state, policy names, and policy command scope;
3. role grants and default privileges affecting Store Sales objects;
4. extensions, triggers, and scheduled jobs that could affect a read path;
5. a zero-row proof that no existing endpoint or credential is being reused by accident.

The audit may not expose row data, connection data, or secret values. It may not perform DDL, DML, RPC writes, grants, revocations, or deletes.

## Cleanup sequencing after a separate approval

1. Reactivate the Sandbox only after project ownership and rollback owner are recorded.
2. Run the catalog-only inventory and publish a sanitized result.
3. Obtain a distinct decision for each confirmed obsolete Function, secret name, table, policy, or role.
4. Apply approved cleanup in a separate maintenance window; never combine it with the first Store Sales deployment.
5. Re-run the catalog-only inventory and then consider the Store Sales deploy gate.

## Explicit non-actions in this sprint

- no Function deletion;
- no Table deletion;
- no Secret deletion or rotation;
- no project reactivation;
- no schema, RLS, role, migration, or deploy change.

