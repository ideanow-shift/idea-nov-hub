# DBF Secure Session Handoff deployment package

Status: final-review package only. No remote apply or deploy is authorized by
this document.

## Fixed boundaries

| Boundary | Target | Change class | Rollback anchor |
| --- | --- | --- | --- |
| A. Durable store | Production NOV HUB Supabase `idea-nov-core`, ref `nkmxevmioczcmnldreyo` | Production auth-infrastructure migration; no DBF business-data write | Leave the private, inert additive objects in place; disable callers first. Any destructive down migration requires separate approval. |
| B. NOV HUB Edge | Production `nov-hub-api` in `nkmxevmioczcmnldreyo`; current v120; planned v121 | Production backend code | Redeploy the captured v120 bundle and verify issue/exchange actions are absent. |
| C. NOV HUB Pages | `ideanow-shift/idea-nov-hub`, workflow `Deploy NOV HUB to GitHub Pages`, branch `main`, path `/` | Production UI code; adds only the admin Staging launcher | Revert the launcher commit with a new commit and redeploy Pages. The existing management-system route remains unchanged. |
| D. Cloud Run | GCP `idea-nov-dbf-staging` (`787968950888`), service `idea-nov-dbf-staging-ui`, region `asia-northeast1` | Staging hosting revision | Route traffic back to `idea-nov-dbf-staging-ui-00001-h74`. |

The Staging browser and DBF business-data source remain Supabase
`zgkoofphhivesclehrom`. The Production NOV HUB ref is allowed only in the
server-side BFF exchange URL and must not occur in browser assets.

## Formal migration

- File: `supabase/migrations/20260812105304_dbf_secure_session_handoff_store.sql`
- SHA-256: `deadd8bcf032061ea3a0b86b43f4599b2c50fb3c4649f272af933d476b652885`
- Target: Production NOV HUB session authority (`nkmxevmioczcmnldreyo`)
- Transaction: `BEGIN` / `COMMIT`
- Characteristics: additive, forward-only, private schema, hash-only codes,
  60-second TTL, atomic one-time consume, audit, `FORCE RLS`, explicit browser
  revocation, service-role-only security-invoker RPC execution.
- Apply is not part of this package review.

## Edge and Pages contracts

- Edge actions: `dbfStagingHandoffIssueV1` and
  `dbfStagingHandoffExchangeV1`.
- Issue requires a current HUB session and backend-resolved
  `business_data_admin`.
- Exchange requires a valid IAP assertion, atomically consumes the code, and
  rechecks HUB session continuity and canonical authorization.
- Pages launcher transports only `handoff_code` and `state` in a URL fragment.
  It never transports a HUB token, Firebase token, role, email, or credential.

## Cloud Run BFF contract

- Entrypoint: `node /app/main.mjs`
- Container: multi-stage Node build, unprivileged `node` runtime, port 8080.
- Endpoints: `POST /session/handoff/exchange`, `GET /healthz`, static assets.
- Server-only setting:
  `NOV_HUB_HANDOFF_EXCHANGE_URL=https://nkmxevmioczcmnldreyo.supabase.co/functions/v1/nov-hub-api`.
- The value is a credential-free endpoint, not a secret; it is never emitted to
  browser assets. No Secret Manager resource is required.
- Immutable image source: the exact approved PR head commit (`GITHUB_SHA`),
  tagged only with that full SHA. Deploy by digest after push/read-back.

## Authorized future deployment order

1. Gate the Production Supabase project identity and formal migration SHA.
2. Apply the formal migration to `nkmxevmioczcmnldreyo`.
3. Read back migration history, private grants, forced RLS, and browser denial.
4. Capture the current `nov-hub-api` v120 bundle, then deploy planned v121.
5. Run Edge negative tests: missing/expired HUB session, unauthorized actor,
   invalid/expired IAP, origin/audience/state mismatch, replay.
6. Gate the Staging GCP project, build the exact PR-head image, inspect it, push
   one immutable tag, and read back its digest.
7. Deploy one Cloud Run Staging revision by digest with the server-only exchange
   URL; preserve Direct IAP, runtime SA, min/max, port, and public-IAM denial.
8. Verify direct Cloud Run access still requires HUB handoff after IAP.
9. Merge/deploy the Production Pages launcher only after steps 1-8 pass.
10. Run end-to-end issue/exchange, expiry, replay, logout, unauthorized, and
    rollback-readiness smoke tests.

## Partial failure rules

- Migration succeeds, Edge fails: do not deploy Pages or Cloud Run. Leave the
  additive private store inert and redeploy v120 if needed.
- Edge succeeds, Cloud Run fails: redeploy v120; do not deploy Pages. The store
  remains browser-inaccessible.
- Cloud Run succeeds, Pages fails: route Cloud Run traffic back to revision
  `00001-h74`; redeploy v120; launcher remains absent.
- Pages smoke fails: revert the launcher commit, redeploy Pages, route Cloud Run
  back to `00001-h74`, and redeploy Edge v120.
- Never recover by granting `allUsers`, weakening IAP, exposing private schema,
  or enabling `runtimeImport` / `productionWrite`.

## Stop condition

This package stops after commit, push, PR, and CI. Migration Apply, Edge deploy,
Pages deploy, image build/push, Cloud Run deploy, database write, and PR merge
all require a later Owner approval.
