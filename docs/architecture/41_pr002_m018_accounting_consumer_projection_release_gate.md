# PR002 M018 Accounting Consumer Projection Release Gate

## Scope gate

- [ ] Exactly six frozen Views and one internal resolver
- [ ] New tables/indexes/triggers/policies: 0 unless separately justified
- [ ] M001-M017 and M061-M063 changes: 0
- [ ] M019 objects: 0
- [ ] Consumer API/UI/Production/data load: 0

## Contract gate

- [ ] Current published Publication only
- [ ] Unpublished, approved-only and superseded excluded
- [ ] M013 P/L `period_flow` and B/S `ending_balance`
- [ ] M013 Statement Mapping is the only classification source
- [ ] Balanced Allocation replaces its source without double counting
- [ ] Store/department/corporation scope preserved
- [ ] Unallocated remains corporation scope
- [ ] NULL is not converted to zero
- [ ] Previous Year remains a Comparison Rule, not a Scenario
- [ ] Cash Flow View is empty/fail closed

## Security gate

- [ ] `security_invoker=true` and `security_barrier=true` 6/6
- [ ] SECURITY DEFINER 0
- [ ] PUBLIC/anon/authenticated/service_role M018 grants 0
- [ ] Raw Accounting grants 0
- [ ] Consumer DML 0
- [ ] PII/raw lineage/Production internal ID columns 0
- [ ] Runtime Consumer binding deferred to M019

## Evidence gate

- [ ] M018 Static PASS
- [ ] Full BDF Static regression PASS
- [ ] PostgreSQL 17 Forward 21/21 PASS
- [ ] `validate_m018.sql` PASS
- [ ] M018 Negative PASS
- [ ] M017/M016/M015/M063 regression PASS
- [ ] M018-only rollback PASS and M017 catalog retained
- [ ] Full rollback 21/21 PASS and BDF object count 0
- [ ] Reapply 21/21 PASS
- [ ] First/reapply catalog identical
- [ ] Fixture residue 0
- [ ] `git diff --check` PASS

M018 adds no lock or writer, so no new Concurrency Gate is required.

Commit, Push, PR, Staging Apply and M019 authoring require separate Owner authorization.
