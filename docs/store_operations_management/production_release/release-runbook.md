# Production Release Runbook

This is an approval-gated runbook. It is not authorization to deploy.

1. Owner freezes the release main SHA and approves the four migration filenames, API source and frontend artifact.
2. Operator verifies Supabase target name and ref are exactly `idea-nov-core` / `nkmxevmioczcmnldreyo`.
3. Operator captures current schema/function definitions, migration ledger, API version/hash and Pages release identifier.
4. Apply only the four approved migrations in `database-preflight.md`; stop on drift or partial failure.
5. Run post-migration catalog, ACL and read-only RPC checks. Do not insert facts.
6. Deploy `nov-hub-api` from the approved main SHA. Confirm the Store Monthly action, both contracts and management-only `assignedScopeEnabled=true`; DBF admin handoff remains false.
7. Invoke `.github/workflows/deploy-pages.yml` from the approved main SHA with `production_approved=true`, `store_operations_release_approved=true`, and `store_operations_main_sha=<approved SHA>`.
8. Read back the HUB card/route and execute the hosted smoke plan using Owner-selected existing identities.
9. Record results. Do not begin DBF Production input until the separate business-data approval.

No new role, permission, identity, data copy or write path is part of this release.
