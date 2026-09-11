# Canonical HUB Session Verification Evidence

## Identified canonical method

Repository inspection identified the current NOV HUB server-side app-session verifier in `supabase/functions/nov-hub-api/index.ts`.

| Property | Verified behavior |
| --- | --- |
| Token form | three base64url segments |
| Signature | HMAC SHA-256 (`HS256`) using server-only `HUB_APP_SESSION_SIGNING_SECRET` |
| Audience | exact `nov_hub` |
| Subject | UUID-form employee identifier |
| Time checks | rejects expired token and an issued-at time more than 30 seconds in the future; current issue TTL is 15 minutes |
| Active employee | canonical HUB resolves the employee server-side and rejects inactive status |
| Browser input | only the token is accepted; employee, role, and store scope are not trusted from the browser |

## Reuse result

The verification algorithm has been reproduced as a verification-only source module. It cannot issue sessions, create an issuer, or expose signing material.

## Runtime blocker

The Sandbox has no canonical HUB session issuer, no server-side employee/role/Scope resolver, and no approved source for the canonical signing secret. Copying an existing environment's signing secret is prohibited. Calling a canonical runtime in another environment would create an unapproved cross-environment runtime dependency.

Therefore, the algorithm is identified, but **canonical Session verification cannot be bound or deployed in the Sandbox yet**. A HUB owner must approve a non-Production canonical issuer/resolver path or an approved secret-distribution mechanism that does not copy a Production credential.

