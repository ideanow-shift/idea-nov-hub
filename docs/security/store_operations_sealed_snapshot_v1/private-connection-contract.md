# Private Connection Contract

## Scope

The Source profile represents `idea-nov-core`; the Target profile represents
`idea-nov-staging`. Both are private references resolved only by the existing
approved private connection mechanism. The Source and Target profiles must be
different, and no browser or Store Operations runtime receives either profile.

## Required Private Profile Fields

| Field | Source | Target | Public artifact rule |
|---|---|---|---|
| Project identity reference | Required | Required | Opaque fingerprint status only. |
| Project label | `idea-nov-core` | `idea-nov-staging` | Label allowed; project ref is not. |
| Region fingerprint | Required | Required | Match/fail only. |
| Environment fingerprint | Production | Staging | Match/fail only. |
| Read-only role profile reference | Required | Required | Opaque reference only. |
| Broker reference | Required | Required | Opaque reference only. |
| Expiry | Required | Required | Safe expiry status only. |
| Operator/reviewer binding | Required | Required | Role and approval reference only. |

The following must never enter Git, chat evidence, logs, a manifest, a local
file, or a response: DSN, host, port, password, API key, service-role key,
certificate, token, raw project ref, or raw Auth credential.

## Identity Gate

Before query 1, the private broker verifies each profile's project identity,
region, environment, TLS/host trust signals, expiry, and profile fingerprint.
Any mismatch, Source/Target profile reuse, or ambiguity stops with query count
zero. The broker returns status booleans only; it does not return identity
values to the runner or artifact.

## Lifecycle

1. Private-profile owner prepares two expiring, least-privilege references.
2. Reviewer checks the opaque fingerprints against the approved identity record.
3. Operator invokes one run inside the approved window through the private
   broker only.
4. The broker closes both connections and the profile owner revokes both
   credentials immediately after the run window.
5. Any incident or expiry causes immediate revocation, evidence preservation,
   and a new approval; there is no retry under the old approval.

This package creates no private store and does not change an existing one.
