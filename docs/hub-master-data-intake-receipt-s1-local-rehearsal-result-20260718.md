# HUB Master Data Intake receipt S1 local rehearsal result 2026-07-18

## Result

```yaml
classification: LOCAL_REHEARSAL_PASS
case_id: hub-data-intake-receipt-s1
precheck: pass
forward: pass
verify: pass
rollback: pass
clean: pass
production_access_count: 0
host_port_count: 0
remote_action_count: 0
secret_access_count: 0
```

## Verified boundaries

- The receipt table can be created from an empty synthetic foundation.
- The exact target and digest constraints are present.
- Both idempotency unique constraints are present.
- RLS is enabled.
- PUBLIC, anon, and authenticated have no direct table privileges.
- Rollback removes only the S1 receipt table.
- Clean verification confirms no receipt table, policy, or residual fixture row remains.

## Scope

This was an isolated disposable PostgreSQL rehearsal. It did not connect to production, apply remote schema changes, read business rows, configure Secrets, deploy Edge Functions, or import CSV data.

## Gate status

S1 source is locally rehearsed. Production schema apply, service-role grant, transactional RPC creation, frontend save enablement, and production CSV import remain separate approval gates.
