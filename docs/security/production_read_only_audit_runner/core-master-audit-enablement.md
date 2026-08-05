# Production Core Master Audit Enablement

## Scope and status

This source-only pack prepares a single Production read-only catalog attestation for `public.employees`, `public.stores`, `public.corporations`, `public.departments`, and `public.employee_store_assignments`. It does not open a connection, create a role, store a secret, or execute a query.

Status: `NOT_READY_FOR_EXECUTION`. The dedicated audit login and private broker must be attested by the DB owner outside Git before a human-approved run is possible.

## Preconditions

1. The private identity profile matches the approved Production project and the public HUB `nov-hub-api` target. Any mismatch stops before opening a connection.
2. The connection reports `dedicated_production_audit_login`, is not a service role, and cannot write.
3. The broker exposes only `open`, `beginReadOnly`, `verifyReadOnly`, `executeFixed`, `rollback`, and `close`; it has no arbitrary SQL or commit operation.
4. The request has the immutable pack ID and one to ten unique approved Query IDs.

## Role attestation

The intended login name is `idea_nov_prod_audit`. Its **existence is not confirmed by this sprint**. Before release of a credential to the broker, the DB owner must attest: `NOINHERIT`, `NOBYPASSRLS`, no membership grants, no `EXECUTE`, no DDL/DML/replication/TEMP privilege, connection limit one, and a human-approved expiry. The only relation privileges are SELECT on the five named Core Master tables. The unapplied role template is [audit-role-unapplied-sql.sql](audit-role-unapplied-sql.sql).

## Privacy boundary

Employee names, emails, phones, addresses, identifiers, assignment rows, passwords, connection values, UUID values, policy expressions, function bodies, and raw errors are rejected or never requested. Output allows only schema/object names, column metadata, boolean values, and bounded aggregate counts.

## Deliberate two-stage store treatment

The visible Master Admin count of 21 stores is not enough to classify the extra record. This first pack only identifies the real status and classification columns and returns aggregate store count. A second pack can be authored only after those actual columns are reviewed and approved; it will use fixed non-personal fields and no UUIDs.
