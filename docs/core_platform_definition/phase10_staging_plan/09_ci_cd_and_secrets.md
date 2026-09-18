# CI/CD and Secrets

## Current

`main` pushで`portal/`をGitHub Pagesへdeployするworkflowのみ確認しました。staging、Edge deploy、migration workflowはありません。

## Proposed

- PR: lint/unit/security/source regression。Secretなし。
- `staging-canary` branchまたはmanual dispatch: build + dry-run。
- GitHub Environment `staging-canary`: required reviewer、self-review禁止、branch restriction。
- deploy: commit SHA固定、concurrency 1、manual approval後のみ。
- migration: target project ref denylist、synthetic count precheck、separate approval。
- production workflowとSecret名を共有しない。

## Secret names

`STG_SUPABASE_PROJECT_REF`, `STG_SUPABASE_ACCESS_TOKEN`, `STG_SUPABASE_SERVICE_ROLE_KEY`, `STG_FIREBASE_PROJECT_ID`, `STG_FIREBASE_API_KEY`, `STG_HANDOFF_PRIVATE_KEY`, `STG_HANDOFF_ACTIVE_KID`。

GitHub environment secretsはapproval通過後にjobへ渡せます。[GitHub deployment environments](https://docs.github.com/en/actions/concepts/workflows-and-actions/deployment-environments) 値はlog、artifact、PR、fixtureへ出しません。90日以内またはincident時にrotationします。
