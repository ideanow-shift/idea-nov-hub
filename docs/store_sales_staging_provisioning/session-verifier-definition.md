# HUB Session Verifier Definition

## Server-side only contract

1. Accept a Bearer token only over the Staging HTTPS endpoint.
2. Verify issuer, audience, signature, expiry, and active session server-side.
3. Resolve employee identity, role, and store scope on the server; never trust browser role, employee, or store values.
4. Apply the approved current rules: representative/executive = 20, sales director = Direct 13, store manager = own active store, employee = 403.
5. AM without an approved effective-dated assignment source = 403 `AM_SCOPE_UNASSIGNED`.
6. Reject Production issuer/audience, mock identity, expired token, and missing app context.

## State

The client-side HUB session contract exists, but no approved Staging server verifier binding exists. No real session is accepted in this sprint.
