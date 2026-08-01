# Store Operations Monthly Data Foundation Summary

## Decision

**CONDITIONAL PASS.** The V1 source, publication, and AM-assignment specifications
are now fixed. This documentation does not authorize an import implementation, a
database change, or a runtime connection.

## Defined V1 boundary

- Supabase is the formal Corporation, Store, and Employee Master source.
- Yayoi Accounting CSV is the formal source for monthly sales, profit, EC sales,
  and product sales. Each type is one all-20-store CSV per month.
- Accounting uploads, reviews, and normally publishes. Rollback requires Accounting
  plus Representative approval; routine publication does not require Representative
  approval.
- Employee Master is the formal AM source, with multiple effective-dated assigned
  stores. AMs without an effective assignment remain deny-by-default.
- Daily and weekly analysis is V2 after POS bulk export is available, using one
  store file at a time.
- Canonical store, corporation, and employee identifiers are mandatory; names are
  never inferred.
- Published records alone are visible to Store Operations, filtered server-side by
  common role and Store Scope rules.
- 20 stores, 13 direct stores, 7 FC stores, Tokorozawa legacy crosswalk, confirmed
  profit, FC-profit exclusion, and AM deny-by-default are validation gates.

## Remaining human decisions

1. Approve the physical Employee Master representation for effective-dated multiple
   store assignments.
2. Approve retention, correction, and audit-evidence duration.
3. Approve the physical schema, API contract, and staging implementation in a later
   sprint.

## No operational change

This sprint made documentation only. No database, migration, RLS, RPC, deployment,
GitHub Environment, production connection, current CSV, master data, or permission
model was changed.
