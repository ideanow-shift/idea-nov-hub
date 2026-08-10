# Schema and Column Contract v1.3.1 Corrective

## Target boundary

The v1.3.1 private approved Schema/Column Contract limits Target Snapshot
evidence to Canonical Master objects, future consumer-anchor/access-contract
pre-state and M019 presence. The Query Pack does not require `auth` schema
`USAGE`, `auth.users` `SELECT`, or any other Auth-system grant.

The exact QP06 result schema removes `auth_subject_count`. The runner accepts
only the fixed remaining fields and requires every pre-state count to be zero.
The private Query Registry, public catalog, Schema Contract hash, Security
Allowlist hash and Package Lock bind that exact shape.

## AUTH-01 handoff

The Snapshot does not prove Auth subject existence and does not determine or
create an Auth identity. The following evidence belongs to AUTH-01 under a
separate Owner authorization and server-side execution boundary:

- Auth subject existence;
- one-to-one Auth subject to Canonical Employee binding;
- onboarding, environment, audience, expiry and revocation state.

No Production or Staging database object, ACL, role, grant, RLS policy or
credential is changed by this corrective.

## Security invariants

v1.3.1 retains the v1.3.0 Query-ID-only Broker, AST and exact allowlists,
runtime identity evidence, `REPEATABLE READ READ ONLY`, no-write evidence,
mandatory `ROLLBACK` and close, and retry zero. Generic, interactive or
caller-supplied SQL remains forbidden.
