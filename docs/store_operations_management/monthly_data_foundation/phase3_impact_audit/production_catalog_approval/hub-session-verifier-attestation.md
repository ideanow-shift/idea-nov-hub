# HUB Session Verifier Attestation

## Result

**NOT APPROVED FOR REUSE.** Repository source identifies an internal server-side HUB session path in `nov-hub-api`, but it does not establish an approved shared verifier boundary for Store Operations. No token, session, employee, role, scope, or Production endpoint was read.

## Required Capability Evidence

The Platform and Security owners must attest that the selected server-side boundary verifies Bearer credentials, resolves employee and role server-side, obtains current Store Scope from approved Core Master relations, rejects expired and mock identities, returns `403` for ordinary employees, and denies unassigned AM access by default.

## Prohibited Substitutes

Do not copy signing material, allow the browser to assert role or Store Scope, reuse synthetic staging tokens, or infer AM assignments. A missing approved verifier blocks both Import Center commands and monthly projection access.
