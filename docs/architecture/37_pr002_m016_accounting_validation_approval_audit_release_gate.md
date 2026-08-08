# PR002 M016 Accounting Validation / Approval / Audit Release Gate

## Required PASS evidence

- Exactly three M016 tables and no M017+ object.
- Required validation-code matrix: 13 Actual checks; 12 Budget/Forecast checks.
- PASS is derived, not caller supplied; missing or PENDING evidence cannot finalize.
- Blocking FAIL produces rejected, complete PASS produces validated.
- Validation PASS is required before any approval.
- Active Canonical Employee checker differs from creator and validator.
- One approved `accounting_confirmed` decision produces approved.
- Direct published transition remains blocked before M017.
- Validation, Approval and Audit UPDATE/DELETE are rejected.
- Accounting Version content/hash/lineage and M015 ledger remain immutable.
- RLS enabled/forced 3/3; forbidden table and function grants zero.
- SECURITY DEFINER, Consumer View, Production dependency and PII column zero.
- M016-only rollback restores the M015/M063 baseline and exact M014 guard; CASCADE zero.
- Fresh PostgreSQL 17 Forward, validation, negative tests, rollback, reapply and catalog equality PASS.

## Scenario boundary

Actual validates Import, Journal, Fact, tax/rounding and allocation lineage. Budget/Forecast validate planning contract, Version, Fact and allocation lineage. Previous Year is never introduced. Publication approval sets, release membership and Consumer access remain M017/M018.

## Operational trade-off

M016 uses one human checker gate rather than a multi-step approval workflow. Additional frozen business decisions are retained as append-only evidence but do not add a lifecycle stage. This preserves maker/checker safety without turning monthly close into a sequence of artificial database approvals.
