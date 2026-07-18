# HUB employee LINE WORKS destination save enable source candidate 2026-07-18

## Decision basis

Production SELECT-only catalog evidence passed:

```yaml
employee_target_supported: true
unique_index_present: true
rls_enabled: true
browser_privilege_count: 0
browser_execute_count: 0
required_function_count: 3
security_definer_count: 3
fixed_search_path_count: 3
```

## Source candidate

Only the Master Admin frontend write switch and its pending labels change. The existing backend action and RPC contract remain unchanged.

- input name: `lineWorksRecipientId`
- target: `public.employees.id`
- destination: employee / primary
- current value: masked status only
- actor: backend-authenticated employee only
- direct browser table/RPC access: prohibited
- shared channel/default fallback: prohibited

## Required verification before publish

1. Employee without edit permission remains read-only.
2. Empty or invalid User ID cannot enable Save.
3. A valid value enables exactly one save action.
4. The raw User ID is absent from the returned JSON, console, toast, and change-history display.
5. A failed save leaves the previous configured destination unchanged.
6. No notification enqueue or LINE WORKS send occurs during save.

Static candidate verification:

```yaml
node_parse: PASS
save_boundary_fixture: 10/10 PASS
inventory_fixture: 8/8 PASS
mutation_executed: false
raw_recipient_id_printed: false
```

## Gate separation

This candidate does not approve or execute:

- production destination DML or live save smoke
- notification enqueue or LINE WORKS send
- Edge deploy
- GitHub Pages publish
- DB / RLS / RPC / GRANT / Secret changes

The next gate is a clean frontend candidate review and mocked save fixture. Production publish and a one-employee live save are separate approvals.
