# Production Rollback Plan

Rollback preserves all Canonical Facts. No business row may be deleted or rewritten.

- Database: capture any pre-existing function definition before release. These three RPCs are currently absent, so rollback is `REVOKE EXECUTE` followed by dropping only the exact newly introduced signatures. Foundation tables remain in place and inaccessible; table/data deletion is prohibited.
- API: redeploy the captured `nov-hub-api v126` source/hash. Verify Store Operations actions fail closed after rollback.
- Frontend: redeploy the captured previous Pages artifact or commit. The prior `runtime-config.js` remains Preview and Production-blocked.
- NOV HUB launch: keep the existing card and route. If the consumer is unavailable, use the existing unavailable/permission state; do not create a replacement route.
- Trigger: authorization/scope leakage, raw UUID response, synthetic Production data, missing-to-zero conversion, write activity, incorrect target, or unrecoverable hosted failure.

Database object removal occurs only after API and frontend rollback, and only with separate Owner approval. Facts are never a rollback target.
