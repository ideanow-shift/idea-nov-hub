# CoreOS review request: HUB Master Data Intake S1 and S2a 2026-07-18

## Decision requested

```yaml
receipt_s1_source_review: approve | revise | hold
validator_s2a_source_review: approve | revise | hold
receipt_s1_production_apply: separate_gate_required
validator_s2a_production_apply: separate_gate_required
atomic_commit_rpc_s2b_source_creation: approve | hold
frontend_save_enable: hold
production_csv_import: hold
```

## Completed source slices

### S1 receipt foundation

- exact targets: employees, stores, corporations
- client-request and target-file idempotency constraints
- lowercase SHA-256 digest constraints
- pending/succeeded completion invariant
- aggregate-only JSON result summary
- actor FK to `public.employees.id`
- RLS enabled
- browser direct privileges zero
- no service-role grant or RPC

Local result: `LOCAL_REHEARSAL_PASS` with forward, verify, rollback, and clean all passing.

Local commit: `d561d94`

### S2a request validator

- exact current Master Admin Data Intake headers for all three targets
- 1 to 1000 row boundary
- digest validation
- aggregate count validation
- required-field validation
- unsupported-field rejection
- explicit rejection of PIN, Firebase identity, roles, permissions, LINE WORKS destination, channel ID, image, and HR private fields
- Security Definer with fixed search path
- browser EXECUTE zero
- proposed service-role EXECUTE only
- no target, receipt, profile, or audit DML

Local result: `LOCAL_REHEARSAL_PASS`, fixtures 10/10, rollback and clean passing.

Local commit: `f8f6bb2`

## Production evidence already confirmed

- six relevant production tables have RLS enabled
- browser write privileges are absent
- direct service-role capabilities are intentionally insufficient for complete Phase 1 create/update
- a transactional Security Definer RPC is required
- direct REST writes and grant widening are prohibited

## Proposed next source slice

S2b should combine, in one transaction:

1. S2a request validation.
2. S1 idempotency receipt handling.
3. active authorized actor revalidation.
4. natural-key locking and preview/current-state CAS.
5. target and profile writes.
6. safe `master_change_logs` inserts.
7. receipt completion.
8. aggregate-only response.

Any validation, target write, audit write, or receipt completion failure must roll back the complete batch.

## Stop line

- no production DDL/RPC/GRANT/DML
- no Edge deploy or frontend publish
- no save-button enablement
- no real CSV import
- no Secret, notification, LINE WORKS, authentication, role, or Storage change
- rollback scripts are rehearsal artifacts and must not run automatically against production
