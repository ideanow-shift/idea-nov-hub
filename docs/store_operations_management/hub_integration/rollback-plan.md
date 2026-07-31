# Rollback Plan

## Trigger

Rollback when the card is visible to an unapproved role, scope differs from the authenticated actor, Store Operations requests another login, session values leak, or Console errors block launch.

## Procedure

1. Disable or remove the Store Operations entry from the non-production App Registry.
2. Revert the Sprint 4 integration commit; keep the V1.1 Dashboard branch intact.
3. Clear the Preview actor context on logout and ask reviewers to sign in to HUB again.
4. Verify direct Store Operations URL is unauthorized/forbidden and the Production adapter remains blocked.
5. Record the affected environment, role, session state, and rollback commit without recording tokens.

The rollback does not modify DB, JWT, RLS, Runtime, Supabase, UUID, migration, or Production data.
