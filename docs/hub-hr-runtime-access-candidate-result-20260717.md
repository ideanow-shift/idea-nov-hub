# HUB HR runtime access candidate result 2026-07-17

## Candidate

```yaml
source_candidate: complete
frontend_published: false
edge_deployed: false
role_dml: false
production_database_changed: false
```

## Exact source changes

- `portal/js/main.js`
  - `hr.staff` / `hr.admin`をHR公開アプリviewerへ追加。
  - 対象はIDEA LINK、master-admin、求人・人財関連の既存公開app IDだけ。
  - 一般社員はIDEA LINKのみの現行境界を維持。
- `supabase/functions/nov-hub-api/index.ts`
  - master-admin閲覧・編集allowlistへ`hr.staff` / `hr.admin`を追加。
  - actorは既存認証済みemployeeからbackendで解決する。
- `portal/index.html`
  - main.jsのrelease queryだけを更新し、公開時の旧module cacheを回避する。

部署名、表示tag、role_levelだけでは編集権限を追加しない。正式role keyが必要である。

## Validation

```yaml
node_main_check: PASS
deno_nov_hub_api_check: PASS
policy_fixture: PASS_16_OF_16
integration_static_checks: PASS_9_OF_9
diff_check: PASS
```

## Required gates before rollout

1. SELECT-onlyで対象者が`hr.staff`または`hr.admin`を持つ件数を確認する。個人値は記録しない。
2. nov-hub-api clean deployed baselineとの差分を確認する。
3. Edge deployとGitHub Pages publishを別々に承認する。
4. 対象者1名でアプリ表示とmaster-admin read/write権限を実機確認する。

role不足時のemployee_roles付与はCore DBの別DML gateであり、このcandidateには含まない。
