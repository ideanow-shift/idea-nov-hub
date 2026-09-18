# Staging Deploy Runbook

## Preconditions

- all seven Human Action Board steps are approved;
- Staging identity fingerprint matches the sealed record and differs from Production;
- `store-sales-staging` GitHub Environment has reviewers and restricted branch policy;
- three sensitive secrets and four protected configuration entries are registered without logging values;
- Store Master and Accounting ports pass independent read-only and negative-write evidence.

## One bounded deployment

1. Deploy Owner opens the protected Staging workflow using the reviewed source artifact SHA.
2. Workflow checks environment identity, required configuration names, and Production-route rejection before publishing.
3. Deploy only the Staging function; do not change UI or any Production target.
4. Run one E2E set: representative, sales director, store manager, employee, and unassigned AM.
5. Record only run ID, response categories, store counts, pass/fail, and rollback state.

Any identity mismatch, 20-store mismatch, unauthorized scope expansion, non-null unconfirmed profit, FC profit exposure, synthetic fallback, console error/warning, or unexpected write is an immediate stop.
