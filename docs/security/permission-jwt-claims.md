# Permission JWT Claims Architecture

## Purpose

JWT claims are optional signed session hints, not the authorization source of
truth. API and RLS enforcement must revalidate server-side facts that can be
revoked, expired, or changed after token issue.

## Candidate claim envelope

| claim | candidate meaning | restriction |
| --- | --- | --- |
| `sub` | Authentication subject reference | Standard identity binding only |
| `employee_ref` | Opaque employee reference | No personal profile data |
| `permission_version` | Version of the common model | Reject unsupported versions |
| `authz_revision` | Server-issued revocation or refresh marker | Server controls freshness |
| `role_refs` | Opaque active role references | No role-to-permission expansion in client |
| `organization_refs` | Opaque approved organization references | No department name or authority inferred by browser |
| `store_scope_refs` | Opaque approved scope references | Never literal all-store roster or client-selected scope |
| `issued_at` | Token issue time | Standard expiration validation |
| `expires_at` | Token expiry time | Short-lived and server validated |

## Explicit exclusions

The JWT must not contain raw employee records, personal data, finance values,
store lists, unrestricted role flags, service credentials, policy expressions,
SQL, approval secrets, or a client-controlled `is_admin` equivalent.

Claims do not replace effective-date checks, data classification checks, action
checks, separation of duties, or direct server-side permission resolution. A
future JWT implementation requires a separate security review and must define
refresh, revocation, issuer, audience, key rotation, and fallback behavior.
