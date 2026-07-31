# Rollback Plan

## Staging rollback order

1. Disable the Store Operations App Registry card first.
2. Roll back the HUB integration deployment to the V1.1 artifact.
3. Clear non-production Store Operations preview/session context and require a fresh HUB login.
4. Verify the direct URL is unauthorized or forbidden.
5. If the UI itself is affected, roll back V1.1 to the prior Store Operations artifact.
6. Record environment, role, scope, failing check, deployed commit, and rollback commit without recording tokens.

## Git rollback

- Revert the HUB merge commit first.
- Revert the V1.1 merge only if its Dashboard changes are also implicated.
- Do not delete branches or rewrite shared history.

Rollback triggers include unauthorized card visibility, scope expansion, Mock Identity outside preview, duplicate App Registry cards, session leakage, blocked HUB return, or new test/Console failures.
