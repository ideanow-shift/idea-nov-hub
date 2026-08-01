# HUB Authentication Inventory

## Existing contract

- NOV HUB authentication remains Firebase or PIN through the existing HUB login screen.
- The canonical application session is `ideaNov.hub.session.v1` in `sessionStorage`, with `sessionToken`, `audience=nov_hub`, and `expiresAt`.
- Store Operations does not add a login screen. It restores the canonical session through `nov-hub-session-candidate.js`.
- Role keys come from the HUB employee context. Organization and store scope are resolved by the server in integration/staging. Preview uses an explicitly synthetic Mock Identity.
- Session expiry is distinct from missing login. A 401 clears the client session; a 403 blocks the application without presenting empty data.

## Environment boundary

| Environment | Identity source | Data source | Policy |
|---|---|---|---|
| preview/mock | HUB-issued preview context + Mock Identity | Synthetic fixture | localhost/review only |
| integration | Local HUB session | Local Projection endpoint | no Mock Identity |
| staging | Staging HUB session | Staging Projection endpoint | staging origin only |
| production | Production HUB session | Not enabled in this sprint | fail closed |

No JWT, RLS, DB, Runtime contract, Supabase, or Production configuration was changed.
