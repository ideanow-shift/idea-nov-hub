# HUB portal_apps 表示整理 source-only監査 2026-07-17

## 範囲

NOV HUB / NOV NAVI / master-admin のアプリカード表示について、source-onlyで確認した。

実行していないこと:

- `portal_apps` DB更新
- role / employee_roles 更新
- Edge deploy
- Secret変更
- 本番データ変更
- 通知送信

## 正本

HUBのアプリカード正本は `public.portal_apps`。

関連source:

- `supabase/portal-apps.sql`
- `supabase/functions/nov-hub-api/index.ts`
- `portal/js/main.js`
- `portal/master-admin/master-admin.js`
- `portal/apps.json`
- `portal/js/apps.js`
- `portal/js/nov-navi-dashboard.js`

## 表示経路

1. HUBログイン後、`fetchPortalData()` が `nov-hub-api` から `apps` を受け取る。
2. `portal/js/main.js` が `sortPortalApps()` で重複排除と優先度順に整える。
3. `selectReleasedAppsForEmployee()` がroleに応じて表示アプリを絞る。
4. `renderApps()` が既存アプリ一覧を描画する。
5. NOV NAVI画面は `portal/js/nov-navi-dashboard.js` のカテゴリ定義を使い、実アプリは `app_id / app_name` のaliasで照合する。

## role別表示制御

`portal/js/main.js` の現状:

- `super_admin` / `executive`
  - 全アプリ表示
- `backoffice`
  - IDEA LINK
  - `core-master-admin`
  - `master-admin`
  - `jinnjibu`
  - `human-capital-investment`
  - `isCoreMasterAdminApp()` に該当するもの
- 上記以外
  - IDEA LINKのみ

このため、総務人事部スタッフに求人関連や労務/人材系を表示したい場合は、対象者のroleまたは `BACKOFFICE_RELEASED_APP_IDS` 側の設計確認が必要。

## 教育URL

静的source上の教育URLは新URLへ更新済み。

確認箇所:

- `portal/js/apps.js`
- `portal/js/main.js`

ただし、HUBログイン後の実カードはDB `portal_apps` の `url` が優先される。画面で旧URLが出る場合、原因候補はDB側 `portal_apps` の `education-web` / `EDU` レコードが旧URLのまま残っていること。

DB更新は別gate。

## IDEA LINK / サンクスコイン重複

source上は次の定義が併存している。

- `idea-link`
  - 現行IDEA LINK / サンクスコイン
- `THANKS`
  - 旧理念浸透システム / サンクスギフト系

`portal/js/main.js` の `isIdeaLinkApp()` は主に以下をIDEA LINK扱いにする。

- `app_id = idea-link`
- appNameが `IDEA LINK`
- appNameが `サンクスコイン`
- IDEA LINK旧GAS deployment URL
- `/idea-link/` URL

`THANKS` はapp_idだけでは現行IDEA LINK扱いにならない。DB側で `THANKS` がactiveの場合、旧カードとして残る可能性がある。

方針候補:

- `idea-link` を現行正本として維持
- `THANKS` は削除せず、用途確認後に非表示または旧機能扱いへ整理
- 直接上書きはしない

DB更新は別gate。

## マスタ管理カード

HUB起動判定:

- `app_id = core-master-admin`
- `app_id = master-admin`
- appNameが社員・店舗マスタ管理系
- URLに `/master-admin/` を含む

NOV NAVIのシステム管理カードは `core-master-admin` / `master-admin` aliasで照合する。

2026-07-17時点で、NOV NAVIのショートカット表記は `データ入力` へ更新済み。

## master-admin側の管理UI

master-adminには既に以下の管理UI/操作が存在する。

- `masterListPortalApps`
- `masterUpdatePortalApp`
- `masterCreatePortalApp`
- 公開/非公開切替
- よく使う切替
- 優先度上下移動
- URL、カテゴリ、アイコン、必要権限、タグ、対象部署/役職の編集
- 変更履歴への記録

ただし、これらは本番 `portal_apps` 更新を伴うため、実操作はCore DB番人レビュー後。

## リスク

High:

- DB `portal_apps` のURLが古い場合、静的sourceを直しても本番カードは旧URLのままになる。
- `THANKS` と `idea-link` が両方activeだと、サンクス系カードが重複表示される可能性がある。

Medium:

- `backoffice` 以外の総務人事部roleでは、NOV Talentやマスタ管理が表示されない可能性がある。
- NOV NAVI側のカテゴリカードと既存アプリ一覧は別ロジックのため、片方だけ表示される可能性がある。

Low:

- `apps.json` / `apps.js` は主に静的アイコン・デモ・fallback用で、ログイン後の正本ではない。

## 次gate候補

SELECT-only:

- `portal_apps` の `app_id`, `app_name`, `url`, `category`, `is_active`, `is_featured`, `priority` を確認
- 対象候補:
  - `education-web`
  - `EDU`
  - `THANKS`
  - `idea-link`
  - `core-master-admin`
  - `master-admin`
  - `jinnjibu`
  - `human-capital-investment`

確認SQL候補:

- `supabase/portal-apps-display-select-only-precheck-20260717.sql`

このSQLで確認すること:

- 教育系カードが新GAS URLになっているか
- `idea-link` と `THANKS` が同時activeで重複表示になっていないか
- `core-master-admin` / `master-admin` がactiveで、マスタ管理カードの表示対象として残っているか
- `jinnjibu` / `human-capital-investment` が総務人事部向け表示候補としてDB上に存在するか

このSQLで実行しないこと:

- `portal_apps` のUPDATE / INSERT / DELETE
- role / employee_roles更新
- 公開URL切替
- Edge deploy
- Secret変更

## SELECT-only実行結果 2026-07-17

実行元:

- link済みHUB worktreeから `supabase/portal-apps-display-select-only-precheck-20260717.sql` をSELECT-only実行

実行結果:

- `EDU` はactive / featuredで存在
- `EDU` のURLは旧GAS deploymentのまま
- `idea-link` はactiveで存在し、URLは `./idea-link-app/`
- `THANKS` はactive / featuredで存在し、旧GAS URLを指している
- `jinnjibu` はactive / featuredで存在
- `core-master-admin` / `master-admin` のDB行は存在しない

解釈:

- 教育カードが旧URLへ飛ぶ原因はDB `portal_apps.EDU.url` が旧URLのまま残っているため。
- サンクス系は `idea-link` と `THANKS` が同時activeのため、重複または旧GASカード表示のリスクがある。
- マスタ管理カードはDB行ではなく、HUB backend/frontendの固定アプリ補完で表示されている可能性が高い。

実行していないこと:

- DB更新
- role / employee_roles更新
- Edge deploy
- Secret変更
- 本番通知

## DML候補

Core DB番人レビュー後の候補:

- `supabase/portal-apps-display-fix-candidate-20260717.sql`

候補内容:

- `EDU.url` を現行教育GAS URLへ更新
- 旧 `THANKS` GASカードを `is_active=false`, `is_featured=false` にする
- `idea-link` は変更しない
- `core-master-admin` / `master-admin` の新規INSERTは今回含めない

Rollback候補:

- `supabase/portal-apps-display-fix-rollback-candidate-20260717.sql`

DML候補は別gate:

- 教育URLをDB `portal_apps` 側へ反映
- `THANKS` のactive状態整理
- NOV Talent / マスタ管理の表示対象role設計
