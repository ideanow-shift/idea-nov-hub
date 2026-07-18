# HUB Master Data Intake write-shape result 2026-07-18

## Sanitized production evidence

```yaml
status: PASS_WITH_WRITE_BOUNDARY_GAP
table_count: 6
column_count: 103
constraint_count: 36
index_count: 21
privilege_count: 33
rls_count: 6
mutation_executed: false
business_rows_read: false
raw_output_printed: false
project_identity_printed: false
```

Evidence SHA-256:

`7648D10B9C2219FC12FEAE709BA8099535EEFD7428A328D499BF8FA5A7A4F0BF`

## Confirmed table boundary

All six reviewed tables have RLS enabled. No browser-role write privilege was present in the reviewed result.

Current service-role capability is not sufficient for direct Phase 1 CSV commit:

| Target | Current direct capability relevant to intake | Result |
| --- | --- | --- |
| employees | SELECT / UPDATE, no INSERT | create blocked |
| stores | SELECT / UPDATE, no INSERT | create blocked |
| corporations | SELECT only, no INSERT / UPDATE | create and update blocked |
| store business profile | SELECT / INSERT / UPDATE | profile write technically available but must remain transactional |
| corporation business profile | SELECT / INSERT / UPDATE | profile write technically available but must remain transactional |
| master change logs | SELECT / INSERT / UPDATE / DELETE | audit table reachable by backend only |

The browser must not write these tables directly, and widening direct grants is not the selected design.

## Phase 1 natural keys

- employee: `employee_id`
- store: `store_id`, with `store_no` also unique
- corporation: `corporation_no`, with `corporation_code` also unique

Foreign labels from CSV must be resolved server-side to canonical IDs. Ambiguous or missing corporation, store, department, position, job type, or business unit references fail the complete batch.

## Decision

```yaml
frontend_save_enable: HOLD
direct_rest_write: PROHIBITED
transactional_security_definer_rpc: REQUIRED
idempotency_receipt: REQUIRED
atomic_audit: REQUIRED
production_csv_import: NOT_APPROVED
```

No DDL, RPC, GRANT, DML, Edge deploy, Pages publish, or CSV import was executed.

