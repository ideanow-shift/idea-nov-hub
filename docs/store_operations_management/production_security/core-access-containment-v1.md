# Production Core Access Containment V1

## Authority and boundary

- Portfolio Lock: `CTO-PORTFOLIO-EXECUTION-ORDER-2026-08-22-V4`
- Phase: `PHASE_3_STORE_OPERATIONS_MANAGEMENT_V1`
- Production project: `idea-nov-core` (`nkmxevmioczcmnldreyo`)
- Production application: prohibited by this PR
- Business-data mutation: none

## Production read-back

All nine legacy `core` tables have RLS disabled, no policies, and direct `SELECT` for `authenticated`.
`employees` and `stores` additionally have explicit `service_role` `SELECT`. The remaining seven do not.

| Table | Classification | Browser source evidence | Server dependencies |
| --- | --- | --- | --- |
| `account_titles` | SERVER_ONLY | canonical repository 0; API logs 24h 0 | finance export RPC |
| `corporations` | SERVER_ONLY | canonical repository 0; API logs 24h 0 | Core admin/profile helpers; finance view/RPC |
| `departments` | SERVER_ONLY | canonical repository 0; API logs 24h 0 | Core admin/profile helpers; finance views/RPCs |
| `employee_roles` | SERVER_ONLY | canonical repository 0; API logs 24h 0 | authorization helpers; finance notification RPCs |
| `employees` | SERVER_ONLY | canonical repository 0; API logs 24h 0 | scoped profile/admin helpers; Finance/OS views and RPCs |
| `positions` | SERVER_ONLY | canonical repository 0; API logs 24h 0 | Core profile/admin helpers |
| `roles` | SERVER_ONLY | canonical repository 0; API logs 24h 0 | authorization/admin helpers; finance notification RPCs |
| `stores` | SERVER_ONLY | canonical repository 0; API logs 24h 0 | scoped profile/admin helpers; finance views/RPCs |
| `vendors` | SERVER_ONLY | canonical repository 0; API logs 24h 0 | finance export RPC |

The approved model removes browser table privileges entirely. Existing browser-required identity and admin reads remain
through explicitly scoped functions; raw-table access is not part of the supported contract. Finance/OS dependencies
are server views or privileged RPCs and retain a service path.

## Function audit and decision

All listed functions are owned by `postgres`. The six original `SECURITY DEFINER` functions were callable by both
`anon` and `authenticated` through inherited/default `PUBLIC` execution.

| Function | Write capable | Authorization in audited body | Decision |
| --- | --- | --- | --- |
| `dev_seed_employee(text,text,text,text)` | yes: inserts/updates master and role rows | none | SERVICE_ONLY |
| `link_employee_to_auth_user(text)` | yes: updates employee Firebase subject by email | none | SERVICE_ONLY |
| `employee_admin_options()` | no | `can_manage_permissions()` | AUTHENTICATED_SCOPED |
| `permission_admin_options()` | no | `can_manage_permissions()` | AUTHENTICATED_SCOPED |
| `current_employee_id()` | no | resolves current Auth subject; legacy email fallbacks remain legacy debt | AUTHENTICATED_SCOPED |
| `current_employee_has_any_role(text[])` | no | current employee plus role lookup | AUTHENTICATED_SCOPED |
| `has_role`, `has_global_role`, `has_scoped_role`, `can_manage_permissions` | no | current employee/role/scope | AUTHENTICATED_SCOPED |
| `current_employee_profile()` | no | current employee only | AUTHENTICATED_SCOPED |

The migration revokes `PUBLIC` and `anon` execution for every browser helper, keeps only the scoped authenticated
functions, converts helpers that need protected-table reads to narrowly returning `SECURITY DEFINER`, and fixes all
target search paths to `pg_catalog`. The two critical write functions are executable only by `service_role`.

## Preconditions and rollback

The migration aborts if any target table is missing, RLS/policies differ from the audited state, authenticated direct
read is absent, a required function signature is missing, or either critical function ACL has already drifted.
Rollback is explicit and restores the audited pre-corrective state; because that state reopens the vulnerability it is
an emergency recovery action only and requires Owner approval.

## Verification evidence

- PostgreSQL 17 disposable fixture applies the exact migration.
- `anon` and unauthorized authenticated table read privileges are absent.
- critical function execution is absent for both browser roles.
- authenticated scoped profile/admin helpers still execute.
- `service_role` table reads and critical function execution remain available.
- rollback restores the exact audited table/function access state.
- canonical NOV HUB, Store Operations, AUTH-01 and Role/Scope regressions run in CI.

## Production gate

`Store Operations Owner Pilot = BLOCKED_BY_PRODUCTION_CORE_SECURITY` until this migration receives Owner review,
Production preflight is repeated, a separately approved Production migration is applied, and post-apply read-back and
application smoke pass. This document and PR do not authorize Production application.
