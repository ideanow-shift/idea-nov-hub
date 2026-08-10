# Store Operations Sealed Snapshot v1.3.1 Auth Boundary Corrective

## Decision

Package `store-operations-consumer-enablement-sealed-snapshot-v1` version
`1.3.1` is an additive Query Corrective. Versions 1.2.0 and 1.3.0 remain
byte-immutable. The corrective removes direct `auth.users` access from Target
Pre-State without weakening the v1.3.0 execution-path Security Contract.

## QP06 boundary

`SOCE-QP06-TARGET-PRESTATE` previously counted `auth.users`. That aggregate did
not provide Canonical identity, binding or onboarding evidence; it was used
only as a zero-count pre-state gate. v1.3.1 removes the relation, output field,
private/public registry binding, runner gate and allowlist entry.

Target Pre-State now checks only Canonical Master, consumer-anchor and
consumer-access-contract partial population. The exact result shape is
fail-closed, so a legacy `auth_subject_count` field is rejected.

## AUTH-01 responsibility

Auth subject existence, one-to-one Canonical Employee mapping and onboarding
state move to AUTH-01's separately authorized server-side boundary. The
Snapshot neither reads Supabase Auth internals nor creates an Auth subject.

## Security and database impact

The Query-ID-only Broker, AST/allowlist, session identity, read-only transaction,
runtime no-write evidence, mandatory rollback/close and retry-zero controls are
unchanged. This corrective changes zero Production or Staging database objects,
roles, ACLs, grants, RLS policies or credentials. Global PUBLIC hardening
required: NO.
