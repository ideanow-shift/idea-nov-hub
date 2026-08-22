# Store Operations Staging Authentication Security Specification

Status: **BLOCKED pending an approved NOV HUB session handoff contract**. Target: Staging only.

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

## Existing-contract review

The repository's deployed secure handoff is DBF-specific. Its database constraints, target origin, audience, exchange action, and capability resolution are fixed to `DBF_STAGING` and Business Data Admin. IDEA LINK is likewise audience/path-specific. Neither contract can authorize Store Operations without a new approved target contract and server-side exchange boundary.

This sprint does not invent or widen either contract. Until an approved Store Operations handoff exists, the cross-origin Cloud Run UI must fail closed and instruct the user to return to NOV HUB. Same-origin NOV HUB launch remains the only implemented session transport.

## UAT gate

- 脇田 Executive browser UAT: blocked until the approved HUB handoff exists; it is not PASS.
- 戸田 Area Manager: server-side Role/scope contract required; real hosted UAT is `DEFERRED_UNTIL_NORMAL_NOV_HUB_LOGIN`.
- 桝本 Store Manager: server-side Role/scope contract required; real hosted UAT is `DEFERRED_UNTIL_NORMAL_NOV_HUB_LOGIN`.

Store Operations, DBF Canonical Fact, and Production writes remain zero.
