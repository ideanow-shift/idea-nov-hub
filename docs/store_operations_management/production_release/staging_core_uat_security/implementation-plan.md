# Staging Core UAT Security Implementation Plan

## Release units

1. Implement and test the deterministic artifact validator, dry-run receipt, transactional population executor, and sealed rollback executor.
2. Add a Staging-only private AUTH-01 binding and append-only HUB Role attestation contract. Keep the schemas outside browser-exposed Data API access.
3. Add the server-only Supabase Admin onboarding command and native PKCE/token-hash callback with encrypted server session storage and opaque cookies.
4. Connect `handleManagementFromDeployedBaseline` to one AUTH-01 resolver that rechecks canonical Employee, attestation, M019 assignment/access, and official Store Scope.
5. Run local contract/regression tests, database tests, advisors, and `git diff --check`.
6. In a separately approved execution, apply only the Staging migration, deploy the Staging runtime, dry-run and apply the sealed artifact, onboard the three users, and execute Hosted Role Smoke.

## Expected implementation changes

- One generated migration for private binding/attestation tables, constraints, RLS/ACL, append-only guards, server resolver, audit, and rollback.
- One Staging-only population/onboarding runner with no embedded people, UUIDs, emails, tokens, or service keys.
- Minimal `nov-hub-api` AUTH-01 adapter wiring and tests.
- No frontend authorization source, no legacy `public` master fallback, and no Store Operations write endpoint.

## Gates

Implementation may start after Security Owner approves this contract and confirms the server session store/TTL, OTP delivery configuration and redirect allowlist, the sealed artifact signer/keeper, and the one-time Staging execution window. Data population, Auth creation, migration apply, deployment, and Hosted Smoke remain separate explicitly approved operations.

Production migration, deploy, Auth change, Business write, and data copy remain zero.
