# Store Operations Staging Authentication Security Specification

Status: **Owner-approved Store Operations handoff implemented; deployment and hosted verification gated**. Target: Staging only.

## Canonical authentication

Store Operations has no independent login. The only accepted source identity is an active NOV HUB session. Store Operations must not create Supabase Auth users, send Email OTP or Magic Links, expose a login/callback route, accept a native Supabase access token as a HUB session, or trust browser-supplied employee, Role, scope, Store ID, or Store UUID values.

The formal chain remains:

```text
NOV HUB authenticated session
  -> approved one-time application-session handoff
  -> canonical Employee
  -> active Identity
  -> HUB Role attestation
  -> M019 effective Assignment
  -> server-resolved Store Scope
  -> storeMonthlyActualProjectionV1
```

The handoff must be short-lived, one-time, single-use, destination/origin/audience bound, replay-denied, auditable, and fail-closed. Access tokens, refresh tokens, service credentials, employee identifiers, Role, scope, and raw Store UUIDs must not appear in a URL, HTML, browser log, referrer, or public response.

Any requested scope wider than the server-resolved scope returns `SCOPE_DENIED`; it is never represented as Empty.

## Dedicated handoff contract

The Store Operations contract is separate from DBF and IDEA LINK. It fixes the target to `STORE_OPERATIONS_STAGING`, the destination origin to the approved Store Operations Cloud Run service, the handoff audience to `store_operations_staging_handoff_v1`, and the application-session audience to `store_operations_staging_v1`.

NOV HUB issues a random opaque code with a 60-second maximum lifetime. Only its SHA-256 digest is stored. The Cloud Run BFF exchanges it once over a server-authenticated boundary, stores the resulting short-lived application session in a Secure, HttpOnly, SameSite cookie, and proxies read-only projection requests. The browser never receives the application-session token. Consumption is atomic; target, origin, audience, state, nonce, expiry, and unused status must all match. Replays fail closed.

Issue and exchange both resolve the canonical employee, active identity, Role attestation, M019 effective assignment, and Store Scope on the server. Exchange also rechecks the source HUB session expiry. No browser-provided Role, employee, scope, Store ID, or Store UUID participates in authorization.

## UAT gate

- 脇田 Executive browser UAT: eligible only after migration, secret binding, Edge/Cloud Run deployment, and normal NOV HUB launch smoke pass.
- 戸田 Area Manager: server-side Role/scope contract required; real hosted UAT is `DEFERRED_UNTIL_NORMAL_NOV_HUB_LOGIN`.
- 桝本 Store Manager: server-side Role/scope contract required; real hosted UAT is `DEFERRED_UNTIL_NORMAL_NOV_HUB_LOGIN`.

Store Operations, DBF Canonical Fact, and Production writes remain zero.
