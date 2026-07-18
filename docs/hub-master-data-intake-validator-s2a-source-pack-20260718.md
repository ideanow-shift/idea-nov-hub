# HUB Master Data Intake validator S2a source pack 2026-07-18

## Scope

S2a is a source-only request validator for the future transactional Data Intake RPC. It validates the current Phase 1 CSV headers, digest shapes, row-count boundary, expected aggregate counts, required values, and forbidden fields.

It does not reserve a receipt, write a master row, append an audit row, or enable the frontend save button.

## Security boundary

- Security Definer with fixed `pg_catalog, public` search path.
- PUBLIC, anon, and authenticated EXECUTE revoked.
- service_role EXECUTE is the only proposed runtime grant.
- no employee, store, corporation, receipt, or audit row access.
- fixed error categories only; no CSV row values are returned.

## Covered targets

- employees: the exact Japanese headers currently emitted by the Master Admin Data Intake UI
- stores: the exact Japanese headers currently emitted by the Master Admin Data Intake UI
- corporations: the exact Japanese headers currently emitted by the Master Admin Data Intake UI

PIN, Firebase identity, roles, permissions, LINE WORKS destination, channel ID, images, and HR private data are rejected.

## Local fixture

Ten synthetic cases cover three valid targets plus invalid target, digest, empty rows, forbidden field, unsupported field, missing required value, and aggregate-count mismatch.

```yaml
classification: LOCAL_REHEARSAL_PASS
fixture_pass_count: 10
fixture_total_count: 10
forward: pass
verify: pass
rollback: pass
clean: pass
production_access_count: 0
host_port_count: 0
```

## Stop line

- production function creation or grant
- receipt reservation
- master or audit DML
- Edge wiring
- frontend save enablement
- production CSV import

S2b must combine this validation with receipt idempotency, current-state classification, target writes, and safe audit writes in one transaction.
