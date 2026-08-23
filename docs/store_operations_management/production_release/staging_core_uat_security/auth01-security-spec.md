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

The Store Operations contract is `STORE_OPERATIONS_STAGING_SESSION_HANDOFF_V1` and is separate from DBF and IDEA LINK. It fixes the target to `STORE_OPERATIONS_STAGING`, callback path to `/auth/callback`, destination origin to the approved Store Operations Cloud Run service, handoff audience to `store_operations_staging_handoff_exchange_v1`, and application-session audience to `store_operations_staging_session_v1`.

`/auth/start` generates a signed HttpOnly state cookie and a PKCE verifier, and sends only the S256 challenge to NOV HUB. NOV HUB issues a random opaque code with a 60-second maximum lifetime. Only the code digest and PKCE challenge are stored; the verifier is never stored in the database. `/auth/callback` receives only the opaque code and state. The Cloud Run BFF exchanges it once with its cookie-held verifier over a Google-signed OIDC service-identity boundary, stores the resulting application session for at most 900 seconds in a Secure, HttpOnly, SameSite cookie, and proxies read-only projection requests. The browser never receives either server token. Consumption is atomic; contract, target, origin, callback, audience, state, nonce, PKCE challenge, expiry, and unused status must all match. Replays fail closed.

The Edge verifies the Google RS256 signature from the Google JWKS, issuer, exact Staging Edge audience, `iat`, `exp`, verified service-account email, and optional subject. The runtime service account is read from the Cloud Run metadata server and must equal the separately configured preflight value. The shared exchange secret is defense in depth only and can never replace Google OIDC.

Issue and exchange both resolve the canonical employee, active identity, Role attestation, M019 effective assignment, and Store Scope on the server. Exchange also rechecks the source HUB session expiry. No browser-provided Role, employee, scope, Store ID, or Store UUID participates in authorization.

## UAT gate

- 脇田 Executive browser UAT: eligible only after migration, secret binding, Edge/Cloud Run deployment, and normal NOV HUB launch smoke pass.
- 戸田 Area Manager: server-side Role/scope contract required; real hosted UAT is `DEFERRED_UNTIL_NORMAL_NOV_HUB_LOGIN`.
- 桝本 Store Manager: server-side Role/scope contract required; real hosted UAT is `DEFERRED_UNTIL_NORMAL_NOV_HUB_LOGIN`.

Store Operations, DBF Canonical Fact, and Production writes remain zero.
