# Permission Boundary

## Principle

Schema separation is not authorization. Each shared-Staging domain must use server-side authorization, least-privilege runtime credentials, RLS where applicable, and explicit grants. Browser clients never receive database-admin or service credentials.

## Boundary Matrix

| Subject | Permitted access | Explicit denial |
| --- | --- | --- |
| Domain runtime | only its approved schema, storage, and server-side contracts | other-domain raw tables, unmanaged functions, Production resources |
| Developer | local fixtures and approved Staging role for assigned domain | Production credentials, broad shared admin by default |
| Release approver | deployment approval and sanitized evidence | secret values and live data export |
| Browser | published API response under server-side scope | direct DB access, RLS bypass, role/scope assertion |
| Audit role | approved fixed metadata/read-only queries only | writes, DDL, RPC execution, BYPASSRLS, arbitrary SQL |

## Shared Project Controls

Use separate least-privilege service principals where the platform supports them, function-specific secret manifests, schema/data classification, per-domain audit trails, and quarterly access review. If project-level secret administrators cannot be separated to the required standard, that domain is a candidate for a separate project.
