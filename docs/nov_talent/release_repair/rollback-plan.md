# Rollback plan

Rollback uses GitHub revert commits; it does not rewrite history.

1. If HUB integration is faulty, revert PR B merge first. This removes the card/session/guard integration while leaving the standalone Talent body available for diagnosis.
2. If the Talent body is faulty, revert PR A merge after PR B has been reverted.
3. Let the existing Pages workflow publish the reverted main once.
4. Verify HUB, Store Operations and other app cards after each revert.

Never force-push main, delete data, change DB/Supabase configuration, or reuse old PR #11/#12 as rollback payloads.
