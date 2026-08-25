# Production AUTH-01 and Scope Readiness

Formal authority chain:

`NOV HUB authentication → AUTH-01 → canonical employee → Role → effective M019 Assignment → Scope → Store Operations projection`

## Source readiness

- ACTUAL and COMPARISON adapters: ready in main.
- Executive all scope, Area Manager assigned scope and Store Manager own scope: contract-tested.
- Unauthorized scope escalation and missing-to-zero: denied/tested.
- Production rollout gate: server-only, fail-close and independent of browser claims.

## Production population/configuration blocker

Production read-back does not yet prove the complete canonical Identity, Role attestation, M019 Assignment and consumer-access population required for this chain. No identity, role or assignment is written by this PR. Required population/promotion must be separately approved, deterministic and read back before deployment.

Email fallback, UAT principal, technical assumption, impersonation and client-supplied authority are prohibited.
