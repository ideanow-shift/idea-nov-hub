# Shared Staging Migration Policy

## Ownership

Each migration belongs to exactly one domain owner: Core/HUB, Store Operations, Talent, or Accounting/Finance. Cross-domain changes require a named primary owner and written dependent-owner approval.

## Required Sequence

1. Read-only catalog attestation and target identity verification.
2. Migration design review: exact objects, keys, indexes, RLS/grant effect, data classification, forward path, and rollback path.
3. Local or fixture rehearsal, including negative authorization tests.
4. Human-approved, protected Staging application in one change window.
5. Post-apply catalog verification and affected domain smoke tests.
6. Record the manifest, applied version, outcome, and rollback evidence without secrets or live business values.

## Isolation Rules

- A migration may not alter another domain's schema, policy, grant, function, or dataset without that owner’s approval.
- Shared migrations are ordered by dependencies, not by product urgency.
- Rollback is forward-safe: restore the prior approved behavior without deleting audit evidence. A failed Staging migration blocks its dependent releases.

## Production

Production-first migration or architecture design is prohibited. This policy does not authorize Production migration. A single final cutover process may be designed only after Staging acceptance is complete and a separate Owner gate has been opened.
