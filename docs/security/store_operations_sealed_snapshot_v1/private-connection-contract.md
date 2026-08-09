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
| Profile fingerprint | Required | Required | Exact SHA-256-like opaque value only. |
| Broker reference | Required | Required | Opaque reference only. |
| Expiry | Required | Required | Safe expiry status only. |
| Not-before | Required | Required | Safe UTC status only. |
| PostgreSQL version policy | Required | Required | Major version and approved exact/min/max numeric range only. |
| Operator/reviewer binding | Required | Required | Role and approval reference only. |

The following must never enter Git, chat evidence, logs, a manifest, a local
file, or a response: DSN, host, port, password, API key, service-role key,
certificate, token, raw project ref, or raw Auth credential.

## Identity Gate

Before the broker opens a database connection, the runner asks the broker to
resolve each expected profile against its broker-held actual metadata:
`profileReference`, `profileFingerprint`, `environment`,
`projectIdentityReference`, `brokerReference`, `notBefore`, and `expiresAt`.
It separately verifies the broker reference/fingerprint. Time comes from the
private broker's trusted UTC clock, never from a caller-controlled request value.
Any mismatch, Source/Target profile reuse, unavailable broker, expired window,
or ambiguity stops with query count zero. The broker returns status booleans
only; it does not return identity values to the runner or artifact.
The trusted-clock, profile resolution, and broker-metadata control-plane calls
must not open a Source or Target database connection. Their attempt counters
must distinguish profile resolution, broker connection, Source connection, and
Target connection.

## PostgreSQL Version Gate

`SOCE-QP01` returns the safe metadata fields `server_version` and
`server_version_num` for both sides. The baseline policy requires PostgreSQL
major version `17`. A private profile can additionally set an exact,
minimum, or maximum `server_version_num`; the runner enforces all configured
limits before `SOCE-QP02` or any Stage 1 query. Patch versions are never
hard-coded in Git or a public artifact.

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
