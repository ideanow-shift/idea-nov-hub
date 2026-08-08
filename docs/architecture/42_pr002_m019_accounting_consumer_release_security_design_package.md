# PR002 / M019 Accounting Consumer Release / Security Finalization

## Decision

M019 closes ACF-08 without adding Accounting calculations. M018 is the single Consumer projection source and remains unchanged. The physical release boundary is one append-only `accounting.consumer_access_contracts` table plus one authenticated read port, `projection.read_accounting_consumer_v1`. No UI, API business logic, KPI, writer or Production binding is created.

## Consumer access model

Every decision pins an Auth subject to a Canonical Employee, an existing Canonical `employee_store_assignments` version, Corporation/Store/Department scope and exactly one formal Scenario. Role names and Employee UUIDs are data, never migration constants. `grant` and `revoke` are immutable sequenced decisions on one `access_key`; UPDATE/DELETE are rejected. Runtime evaluation rechecks active Employee, Assignment and Organization scope for the requested monthly period.

The approved Scenario vocabulary is `actual`, `budget`, `forecast`. Previous Year remains an M017 Comparison Rule. Cash Flow calls the empty M018 fail-closed View.

## Access port

`projection.read_accounting_consumer_v1(projection, corporation, period, scenario)` returns only JSON representations of the six M018 Views. It has a fixed allow-list, no dynamic SQL, no caller-controlled identifier and no raw-table return. Corporation, Store and Department rows are filtered by the latest effective access decision.

The port is the single justified `SECURITY DEFINER`: M018 Views are `security_invoker` and raw Accounting grants must remain zero, so an invoker port could not read them without also giving the caller raw privileges. The port fixes `search_path=''`, schema-qualifies every relation, derives identity from trusted JWT claims, rechecks Canonical authorization and is executable only by `authenticated`. PUBLIC, anon and service_role execute remain revoked. The internal resolver is SECURITY INVOKER and not executable by Consumer roles.

## Least privilege and auditability

All raw Accounting tables and all M018 Views retain zero Consumer grants. Consumer DML and lifecycle writes remain impossible. Ordinary reads create no high-volume audit rows. Access changes are traceable as append-only contract decisions plus migration/catalog history; no new Audit table is created.

## Readiness boundaries

Store Operations and Finance must both traverse an approved server/API boundary into this port and then M018/M017. M019 does not connect either application. Environment-specific access rows remain a separately approved data/binding operation; absence of rows is fail-closed.

Explicit exclusions: Store Operations UI, Finance UI, API business logic, Accounting data, Account Chart, Dashboard, Executive Summary, AI, Production cutover and Consumer-specific KPI.

## Rollback

M019-only rollback revokes authenticated port access, drops the port, resolver, trigger and access table in dependency order, without CASCADE. M018 and every earlier object remain intact.
