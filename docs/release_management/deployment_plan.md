# Deployment Plan

## Status

Planning only. Deployment is prohibited by this document.

## 1.0 deployment design

1. Freeze the approved release branch and record the prior production asset/release identifier.
2. Re-run static, unit, boundary, and desktop/mobile visual checks.
3. Confirm only static/UI/local-only scope is present; no secret, DB migration, Edge function, or production configuration diff is allowed.
4. Obtain release-owner approval.
5. In a separately authorized operation, publish the static assets.
6. Verify only public asset version, navigation, legacy app disclosure, and visibly pending integrations.

## 1.1 deployment design

1. Complete the 1.0 checks.
2. Validate each integration's owner approval, sealed artifact hashes, and service-specific rollback plan.
3. Deploy with integration flags disabled by default where the platform supports this; do not invent flags where none exist.
4. Run the separately approved catalog-only/read-only smoke for exactly its approved run ID.
5. Enable a domain integration only after its smoke receipt and post-check are accepted.
6. Monitor only sanitized health, failure category, and aggregate readiness signals.

## Go/no-go gates

| Gate | Go | No-go |
| --- | --- | --- |
| Source | clean scoped diff and tests pass | untracked/secret/unrelated changes |
| Core DB | approved identity/role/query receipt | identity mismatch or missing approval |
| API | server-side scope applies, no mock fallback | browser direct DB, missing scope, ambiguous source |
| Accounting | confirmed source and period state | missing confirmed period/formula |
| Talent | approved endpoint and run contract | DNS/identity/staging failure |
| Observability | sanitized receipt and rollback target | raw data/secret in logs or missing target |

No deployment proceeds merely because a UI page renders.
