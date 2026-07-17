# HUB portal_apps 表示整理 limited execution pack 2026-07-17

## 目的

HUB / NOV NAVIのカード表示について、次の2点だけを本番 `public.portal_apps` に反映する候補を固定する。

1. 教育カード `EDU` のURLを現行GAS deploymentへ更新する。
2. 現行 `idea-link` と重複する旧GASカード `THANKS` を非表示にする。

## SELECT-onlyで確認済みの事実

- `EDU` は1件、active / featuredで存在し、URLは旧GAS deployment。
- `idea-link` は1件、activeで存在し、URLは `./idea-link-app/`。
- `THANKS` は1件、active / featuredで存在し、旧GAS deploymentを参照。
- `core-master-admin` / `master-admin` のDB行は存在しない。

個人情報、社員ID、token、Secretは確認・記録していない。

## 実行候補

- `supabase/portal-apps-display-fix-candidate-20260717.sql`
- SHA-256: `6767D7641D47BD79E28DC9781330B217CCC43938C32E9DEA89F1B85D7AF916E1`

更新対象:

- `public.portal_apps` の `app_id='EDU'` 1行
- `public.portal_apps` の `app_id='THANKS'` 1行

期待結果:

- `edu_url_updated_count = 1`
- `thanks_disabled_count = 1`
- `idea-link` の更新件数 = 0
- `portal_apps` 以外の更新件数 = 0

## 直前precheck

実行直前に次をSELECT-onlyで再確認する。

- `EDU`, `THANKS`, `idea-link` が各1件で重複なし。
- `EDU.url` が監査時点の旧URLと一致。
- `THANKS.is_active=true` かつ `THANKS.is_featured=true`。
- `idea-link.is_active=true` かつ `idea-link.url='./idea-link-app/'`。
- remote stateに差異がある場合はDMLを実行せずSAFE STOP。

precheck source:

- `supabase/portal-apps-display-select-only-precheck-20260717.sql`
- SHA-256: `32F327C38A927C33D596B394861A525D7F386B2F1AC349C7413B237B6A9E1F68`

## 即時停止条件

- 対象app_idが0件、重複、または想定外の値。
- `idea-link` がinactive、URL drift、または重複。
- UPDATE対象が2行を超える。
- `EDU`または`THANKS`の期待更新件数が1以外。
- `portal_apps`以外の更新が必要。
- role / employee_roles、Edge、Secret、通知、認証契約の変更が必要。

## post-check

更新直後にSELECT-onlyで次を確認する。

- `EDU.url` が現行教育GAS URL。
- `EDU.is_active=true` と `EDU.is_featured=true` を維持。
- `THANKS.is_active=false` と `THANKS.is_featured=false`。
- `idea-link.is_active=true`、URLとpriorityは変更なし。
- app_id重複なし。

その後の公開画面確認はread-onlyで行う。

- 教育カードが新URLを指す。
- サンクス系カードは現行「サンクスコイン」だけ表示。
- マスタ管理、IDEA LINK handoff、他アプリURLに回帰なし。

## rollback候補

- `supabase/portal-apps-display-fix-rollback-candidate-20260717.sql`
- SHA-256: `BC62DBDA4753F20DA4009A8D0B6D6B8B0450E5BEFDCD54268F1F0D056A49ACDD`

rollbackは障害時も自動実行せず、別の明示判断を必要とする。

## 不変境界

- INSERT / DELETEなし。
- DDL / RLS / GRANT / RPC変更なし。
- role / employee_roles変更なし。
- Secret / service_role変更なし。
- Edge deployなし。
- 通知enqueue / LINE WORKS送信なし。
- `idea-link` row変更なし。
- `core-master-admin` / `master-admin` row追加なし。

## CoreOS判定依頼

```yaml
portal_apps_display_fix_dml: approve | hold
execution_count_max: 1
target_table: public.portal_apps
target_app_ids:
  - EDU
  - THANKS
expected_updated_rows: 2
rollback_execution: separate_gate_required
```

