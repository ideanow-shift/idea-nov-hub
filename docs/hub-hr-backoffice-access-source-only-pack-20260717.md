# HUB 総務人事部アプリ表示・社員マスタ編集 source-only pack 2026-07-17

## 目的

総務人事部の担当者が、HUBから求人・人財関連アプリと社員マスタへ到達し、許可された担当者だけが社員・店舗・法人の共通マスタを編集できるようにする。

このpackでは本番source、DB、role付与、公開環境を変更しない。

## source identity

- authoritative remote: `origin/main` `059fd4191aaf7a2f375c0c748821211bb706539e`
- local review base: `359f4d6` (sealed execution contract only; runtime source unchanged)
- `portal/js/main.js`: SHA-256 `773A664A52021BEA64DD25E2482A0EF664CA470D2BBBFB24EDB53137E3D933F1`
- `portal/js/nov-navi-dashboard.js`: SHA-256 `DB41B9B6B4B1C053FD2851D28A53C8B0A1BAF7E18A83BF6EDB4364CAD4708913`
- `supabase/functions/nov-hub-api/index.ts`: SHA-256 `7A97285FA1D0A723F665D41084CBD72CF3FB023B325B607B930CEB1AE45102DB`

local review baseは、未pushのsealed execution contract commitだけをremoteへ加えた状態であり、上記runtime 3ファイルは`origin/main`と同一である。

## 現行事実

- backendは部署名が「総務」または「人事」の社員へ表示用tag `hr` / `backoffice` を付加する。
- HUBの公開アプリ絞り込みは、実role key `backoffice` の場合だけ求人・人財・master-admin候補を残す。
- `hr.staff` / `hr.admin` は現行のHUB絞り込み条件に含まれない。
- master-admin backendの編集許可は `super_admin` / `backoffice` のみで、`hr.staff` / `hr.admin` は含まれない。
- NOV NAVIのシステム管理カードは `super_admin` / `system_admin` のみを管理者として扱う。

## 採用候補

### HUBカード表示

- 全アプリ: `super_admin`, `executive`
- 総務人事向け公開セット: `backoffice`, `hr.staff`, `hr.admin`
- その他: IDEA LINKのみ

総務人事向け公開セット:

- `core-master-admin` / `master-admin`
- `jinnjibu`
- `human-capital-investment`
- IDEA LINK

部署名から生成したtagだけでは公開セットを追加しない。正式role keyを必須とする。

### master-admin backend権限

- 閲覧: 現行roleに `hr.staff`, `hr.admin` を追加
- 編集: 現行roleに `hr.staff`, `hr.admin` を追加
- `department_manager`, `accounting` は閲覧のみを維持
- frontendの表示やHUB Contextは認可根拠にしない
- API actionごとにbackendでactive employee、login状態、role有効性を再確認する

## 統合候補箇所

- `portal/js/main.js`
  - `selectReleasedAppsForEmployee`
  - 表示候補roleへ `hr.staff`, `hr.admin` を追加
- `supabase/functions/nov-hub-api/index.ts`
  - `canViewMasterAdmin`
  - `canEditMasterAdmin`
  - backend role allowlistへ `hr.staff`, `hr.admin` を追加
- `portal/js/nov-navi-dashboard.js`
  - システム管理カード表示は別判断。`hr.staff`全員に権限管理・システム設定まで見せないため、このgateでは変更しない

## 安全境界

- `hr` / `backoffice`表示tagだけでは編集を許可しない
- role_levelだけでは編集を許可しない
- 部署名だけでは編集を許可しない
- `hr.staff`の編集対象はCore共通マスタに限定する
- HR private、給与、マイナンバー等は通常master-adminへ混ぜない
- role付与、employee_roles更新、DDL/RLS/RPC/GRANTは別gate

## fixture結果

対象:

- `review/hub-hr-backoffice-access-source-only-20260717/fixtures.mjs`

確認項目:

- `hr.staff` / `hr.admin` は総務人事向け公開セット
- `staff`や表示tag `hr`だけでは権限を追加しない
- `department_manager` / `accounting` はmaster-admin閲覧のみ
- `super_admin` / `executive`の既存表示を維持
- 一般社員はIDEA LINKのみ

## 次gate

1. 対象者が正式に `hr.staff` または `hr.admin` を持つかSELECT-onlyで件数確認
2. source-only integration candidateをfresh deployed/backend baselineから作成
3. frontend fixtureとbackend permission fixtureを再実行
4. Edge deployとPages publishを別々にレビュー
5. role不足者への付与はCore DB番人の別DML gate

## 停止中

- runtime source変更
- commit / push / publish
- Edge deploy
- role / employee_roles更新
- production DB変更
- Secret変更
- 通知・外部送信
