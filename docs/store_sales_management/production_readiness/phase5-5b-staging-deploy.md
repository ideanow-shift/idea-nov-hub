# Phase 5-5B Staging Deploy

## Local Start

`start-staging.bat`をダブルクリックする。候補URLは`http://127.0.0.1:4175/portal/store-sales/staging.html`。localhost Synthetic専用で、正式Staging URLではない。

## Staging Candidate

`.github/workflows/store-sales-staging-check.yml`はtest/type/security/fixture/production block/RLS/build候補を実行する。deploy candidateはmanual `workflow_dispatch`＋environment approval＋dry-runだけで、実deployしない。

## Secrets Registration Plan

承認済みStaging environmentへ、`.env.staging.example`のkeyをGitHub Environment/Supabase secretsから登録する。値をrepository、log、artifact、issueへ貼らない。登録者・reviewer・rotation日時をauditする。

## Migration Plan

review-only SQL→DB/Security review→ephemeral validation→Staging backup→manual approval→Staging apply→negative test→rollback rehearsal。Phase 5-5BではROLLBACK付きcandidateのまま。

## Health

`GET /health`はstatus/environment/contract/synthetic/production-blockedだけを返し、DB URLやsecretを返さない。

## Production Safety

既存Pagesはmain自動deployを停止し、manual `production_approved=true`が必要。Production artifactではstaging HTML/config/session/fixtureを除外する。
