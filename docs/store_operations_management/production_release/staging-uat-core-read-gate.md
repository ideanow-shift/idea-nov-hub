# Staging UAT Core Read Gate

Read-back date: 2026-08-20. Target: `idea-nov-staging` (`zgkoofphhivesclehrom`).

## Result

The Store Operations management path cannot yet move from the legacy `public` master reads to a formal Core authorization read contract. The existing Core definitions are not sufficient to authorize a Hosted UAT identity:

- `projection.corporation_master_v1`, `projection.store_master_v1`, and `projection.employee_assignment_v1` exist but each returns 0 rows in Staging.
- `core.employees`, `core.employee_identities`, and `core.employee_store_assignments` each contain 0 rows in Staging.
- No Core/Projection RPC exists that binds an authenticated HUB subject to one active canonical employee, effective roles, and effective Store Scope.
- `projection.employee_assignment_v1` alone is not an identity or Role authority and must not be used to infer authorization.

The current management runtime therefore remains fail-closed. No fake identity, role, assignment, legacy table restoration, or browser-supplied employee/role/scope/Store UUID is accepted.

## Minimum Core read adapter contract required

Core ownership must provide one server-only, read-only contract whose input is the verified HUB/Auth subject and an as-of date. Its output must contain only server-resolved authorization data:

- canonical employee identity and active state;
- canonical Role keys needed by the frozen Store Operations permission model;
- scope mode (`all`, `assigned`, or `own`);
- active canonical Store identities in scope;
- a stable public Store key for response projection, never a raw UUID;
- contract/evidence version for audit.

The contract must fail closed for no match, multiple employees, inactive identities, expired assignments, unknown roles, and conflicting scope. Executive or `super_admin` may resolve all 20 official stores; Area Manager resolves only active effective assignments; Store Manager resolves only the canonical own-store assignment. Client request fields may only narrow the server result and can never expand it.

## Release gate

Hosted UAT remains blocked until Core owners populate the approved Staging canonical master and publish the subject-to-employee/Role/Scope read adapter. After that, `handleManagementFromDeployedBaseline(...)` may consume that single contract and the legacy `public` reads can be removed from the Store Operations path. This document does not authorize a migration, population, permission expansion, Production change, or business write.
