# Generic NOV HUB session helper integration contract

Date: 2026-07-12

## Contract

```javascript
window.NovHubSession.getSessionToken()
```

The method returns the current valid signed `hub_session` token or `null`.

It does not return employee identity, roles, permissions, or store scope.

## Authority boundary

- Client validation checks only token presence, `audience=nov_hub`, and expiry.
- Client validation is preliminary and never grants authority.
- Each API must verify the bearer signature and expiry.
- Each API must re-resolve the employee from `public.employees`.
- Each API must recheck active/login state, roles, portal access, and store scope as required.
- HUB Context employee/role/scope fields remain display hints only.

## Storage boundary

```yaml
primary: existing_HUB_memory
reload_recovery: same_origin_sessionStorage
canonical_key: ideaNov.hub.session.v1
localStorage: prohibited
url_query_body: prohibited
dom_or_log: prohibited
```

Temporary read compatibility:

- `ideaNov.management.hubSession.v1`
- `ideaNov.decisionHub.readonlySession.v1`

No new app-specific session key should be introduced. Producers should move to the canonical key in a later source-only wiring gate.

## Lifecycle

- Normal login/session issuance: set memory and canonical `sessionStorage` state.
- Page reload: recover from canonical same-origin `sessionStorage`.
- Logout: clear canonical and temporary legacy keys.
- Expiry: return `null` and clear the expired stored session.
- API 401/403: clear session and return the app to its normal HUB-login path.

## Consumer contract

Talent, Decision, and other read-only consumers may:

1. call `window.NovHubSession.getSessionToken()` immediately before an API request
2. stop safely when it returns `null`
3. pass the token only as an HTTPS Bearer credential
4. discard the local reference after the request

Consumers must not:

- copy the token to another storage key
- append it to URLs or JSON/form payloads
- decode it to make authorization decisions
- log it or show it in diagnostics
- use employee ID, role, or scope hints as replacement authentication

## Preserved behavior

- IDEA LINK handoff/session remains separate and unchanged.
- master-admin session restoration remains unchanged.
- PIN and Firebase transports remain unchanged.
- No Secret, service-role key, notification, or LINE WORKS behavior is involved.

## Source-only integration order

1. Review the standalone candidate and fixtures. Completed source-only.
2. Wire HUB `main.js` to set/clear the canonical session without changing login semantics. Completed source-only.
3. Load the helper exactly once through the HUB entry module. Completed source-only.
4. After separate approval, commit/publish the three path-limited frontend files.
5. Migrate Decision read-only launch to read the generic helper in its own gate. Completed source-only in Decision gate.
6. Integrate Talent only after its backend bearer validation/revalidation matrix passes.
7. Remove legacy-key compatibility only after all consumers stop using those keys.

## Stop lines

- No publish, deploy, live smoke, DB, Secret, notification, or LINE WORKS action.
- No IDEA LINK or master-admin source change in this gate.
- No PIN, token, employee value, or raw response recording.
