# DBF Cloud Run readiness corrective

This is the active Phase A corrective contract for the DBF Hosted Staging
Cloud Run service. Historical deployment records remain unchanged.

## Target and endpoint

- Project: `idea-nov-dbf-staging` (`787968950888`)
- Region: `asia-northeast1`
- Service: `idea-nov-dbf-staging-ui`
- Readiness: `GET /ready` on port `8080`
- Response: HTTP 200, `text/plain`, `Cache-Control: no-store`, body `ready\n`

The readiness route is registered before static-file fallback and performs no
database, Edge, handoff, session, authorization, or secret access. The former
`/healthz` route is retired from active Cloud Run runtime, probe, workflow, and
smoke contracts.

## Controlled rollout

1. Merge the clean corrective PR after required CI passes.
2. Dispatch the manual image workflow with the exact current `main` full SHA
   and the confirmation bound to that full SHA.
3. Read back the one immutable image tag and digest. Do not create `latest` or
   any additional tag.
4. Re-read the Cloud Run baseline, Direct IAP, runtime service account, public
   IAM, ingress, traffic, and Production Edge v123.
5. Create one revision from the new digest with startup probe `/ready:8080`,
   preserving all other approved service settings.
6. After the revision is READY, move traffic to it and immediately run hosted
   readiness, routing, static asset, IAP, console, and runtime smoke checks.
7. Only after those checks pass, perform one positive NOV HUB handoff and
   verify `business_data_admin`, the Staging session, and the empty dashboard.

## Fail-close rollback

If any required check fails, route 100% traffic back to
`idea-nov-dbf-staging-ui-00001-h74`. Do not add public IAM, change IAP/IAM,
change Production Edge, write business facts, run imports, or begin Phase B.
