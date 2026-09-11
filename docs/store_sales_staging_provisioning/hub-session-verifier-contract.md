# HUB Session Verifier Contract

## Status

**Contract boundary defined; runtime binding not approved.**

Repository evidence shows the existing HUB server implementation verifies a HUB session using a server-side signing-secret environment value and a fixed HUB audience. That implementation also has unrelated privileged capabilities, so it must not be copied wholesale into the Store Sales Sandbox.

## Required request boundary

| Item | Contract |
| --- | --- |
| Input | HTTPS `Authorization: Bearer <token>` only |
| Browser authority | prohibited: browser cannot supply employee, role, Store Scope, or actor identity |
| Verification | signature, issuer, audience, expiry, active/login-enabled state, and token type checked server-side |
| Actor result | internal sanitized actor capability only: allowed role keys, assigned store scope, own store where approved, FC operator scope where approved |
| Mock rejection | test/demo/mock issuer, missing issuer, and malformed token return 401 |
| Expiry | expired or not-yet-valid token returns 401 |
| AM | absent effective-dated approved assignment returns 403 `AM_SCOPE_UNASSIGNED` |
| General employee | returns 403 `STORE_SCOPE_DENIED` |
| Output | no token, signing material, employee identifier, or raw policy result is returned |

## Role / scope enforcement

| Actor category | Result |
| --- | --- |
| Representative / Executive | current 20-store projection |
| Sales Director | Direct 13 only |
| Area Manager | only explicit effective-dated assignment; otherwise 403 |
| Store Manager | own active approved store only |
| FC Owner | only approved FC operator scope |
| General employee / unknown | 403 |

## Runtime decision pending

The exact Staging issuer and signing method are not proven. A Sandbox-specific verifier must use one of these owner-approved approaches:

- a Staging-only asymmetric issuer/JWKS verifier; or
- a Staging-only symmetric issuer that consumes a newly generated Sandbox-only signing secret.

The existing HUB signing secret must not be copied from another environment. Until the method is approved and implemented as a dedicated minimal verifier, the required Secret count for this contract is zero.

