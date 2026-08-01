# Store Operations Monthly Data Foundation Summary

## Decision

**CONDITIONAL PASS.** The monthly foundation is specified well enough to build after
the remaining authoritative-source and governance approvals. It does not authorize
an import implementation, a database change, or a runtime connection.

## Defined V1 boundary

- Monthly approved CSV is the V1 transaction input; real-time, daily, and weekly
  sources are out of scope.
- Four CSV types are normalized through a controlled import workflow.
- Canonical store, corporation, and employee identifiers are mandatory; names are
  never inferred.
- Published records alone are visible to Store Operations, filtered server-side by
  common role and Store Scope rules.
- 20 stores, 13 direct stores, 7 FC stores, Tokorozawa legacy crosswalk, confirmed
  profit, FC-profit exclusion, and AM deny-by-default are validation gates.

## Remaining human decisions

1. Approve the exact authoritative sources and owners for each CSV type.
2. Confirm corporation and employee master sources and effective-period semantics.
3. Approve the AM assignment source before AM scope can be granted.
4. Approve publisher separation, retention, correction, and rollback authorities.
5. Approve the physical schema, API contract, and staging implementation in a later
   sprint.

## No operational change

This sprint made documentation only. No database, migration, RLS, RPC, deployment,
GitHub Environment, production connection, current CSV, master data, or permission
model was changed.
