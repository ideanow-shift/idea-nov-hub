# Phase 6B.6 Core Master Audit Report

## 判定

**BLOCKED**

`public.stores`には承認済み20店舗と一致する現行店舗実レコードが存在し、UUID・店舗コード・運営法人FK・active状態を保持している。しかし、同じSupabase内に`core.stores`が別UUID体系で存在し、所沢店1件だけが重複登録されている。正式なSingle Source of TruthがDB構造上明確ではない。

さらに、`public.stores`にはofficial/display名称の分離、明示的なDirect/FC列、店舗運営主体履歴、effective periodがなく、RLSは有効だがpolicyが0件である。現在スナップショットの参照元候補としては利用できるが、Production用正式Masterとしては未準備と判定する。

本監査ではSELECTとsystem catalog参照のみを実行した。migration、deploy、schema・seed・UUID・データの変更、生成、削除は行っていない。

## 調査対象

- Supabase project: `idea-nov-core`
- Project status: ACTIVE_HEALTHY
- PostgreSQL: 17
- 調査日: 2026-07-30
- 調査方法: Supabase Management API経由のread-only SQL

確認対象:

- `stores`
- `store_master`
- `store_entities`
- `entities`
- `organizations`
- `legal_entities`
- `store_history`
- `store_operating_history`
- store名称を持つTable / View / Materialized View
- effective periodとstore UUIDを併せ持つ履歴候補

## 存在テーブル・候補

|Relation|種別|件数|PK|UUID|店舗コード|名称|運営法人|Direct/FC|履歴・期間|RLS|
|---|---|---:|---|---|---|---|---|---|---|---|
|`public.stores`|Table|22|`id`|UUID default|`store_id`・`store_no`、各UNIQUE|`store_name`|`corporation_id` FK|列なし。法人から推定可能|なし|有効、policy 0、FORCEなし|
|`core.stores`|Table|1|`id`|UUID default|`code` UNIQUE nullable|`name`|`corporation_id` FK|列なし。法人`is_fc`から推定|`opened_on`・`closed_on`のみ|無効|
|`public.store_business_profiles`|Table|補助|店舗FK候補|店舗参照|なし|なし|なし|なし|履歴Masterではない|有効|
|`public.employee_store_assignments`|Table|435推定|別用途|`store_id` FK|なし|なし|なし|なし|従業員所属期間|有効|
|`public.employee_assignment_histories`|Table|別用途|別用途|`store_id` FK|なし|なし|なし|なし|従業員所属履歴|対象外|
|`finance.expense_by_store_month`|View|会計集計|なし|store参照|なし|表示用|なし|なし|会計月次View|無効|
|`finance.monthly_expense_executive_report`|View|会計集計|なし|store参照|なし|表示用|なし|なし|会計月次View|無効|

次のRelationは存在を確認できなかった:

- `store_master`
- `store_entities`
- `entities`
- `organizations`
- `legal_entities`
- `store_history`
- `store_operating_history`
- 店舗Master用途のMaterialized View

## `public.stores`データ品質

|項目|結果|
|---|---:|
|総レコード|22|
|UUID distinct|22|
|store_id distinct|22|
|store_no distinct|22|
|store_name distinct|22|
|現行店舗（本部除外）|20|
|Direct|13|
|FC|7|
|本部|1|
|inactive / 撤退店舗|1|
|corporation欠損|0|
|created_at欠損|0|
|updated_at欠損|0|

## 店舗実レコード

UUIDは先頭8文字のみ表示する。

|UUID|store_code|店舗名|状態|区分|運営法人|
|---|---|---|---|---|---|
|3ba5e54d...|kumegawa|BASSA久米川店|active|FC|UNO|
|acc91785...|shintokorozawa|BASSA新所沢店|active|FC|ALBERO|
|1285ac70...|tokorozawa|BASSA所沢店|active|DIRECT|IDEA NOV|
|71551fcf...|kokubunnji|BASSA国分寺店|active|FC|BIOEL|
|887da14c...|takadanobaba|BASSA高田馬場店|active|DIRECT|IDEA NOV|
|1bcba30a...|kamishakujii|BASSA上石神井店|active|DIRECT|IDEA NOV|
|73ee82b5...|hoya|BASSA保谷店|active|DIRECT|IDEA NOV|
|e7bab6a5...|higashiyamato|BASSA東大和店|active|DIRECT|IDEA NOV|
|fec1e181...|shimoigusa|BASSA下井草店|active|DIRECT|IDEA NOV|
|02d29285...|higashikurume|BASSA東久留米店|active|FC|LUA|
|ad931406...|shakujiikoen|BASSA石神井公園店|active|DIRECT|IDEA NOV|
|4e5526cc...|ekoda|BASSA江古田店|active|DIRECT|IDEA NOV|
|e7ecb022...|hanakoganei|BASSA花小金井店|active|FC|FILM|
|b5a206dc...|saginomiya|BASSA鷺ノ宮店|active|FC|ALBERO|
|2980442d...|annex|BASSAANNEX店|active|DIRECT|IDEA NOV|
|36c222de...|ikebukuro|BASSA池袋店|active|DIRECT|IDEA NOV|
|b898c63f...|nogata|BASSA野方店|active|DIRECT|IDEA NOV|
|ac20934d...|kyarahalf|KYARA HALF池袋|active|DIRECT|IDEA NOV|
|5f66193f...|tachikawa|BASSA立川店|active|DIRECT|IDEA NOV|
|62070a3c...|roane|Roane by BASSA店|active|FC|ALBERO|
|335e5aa3...|honbu|本部|active|管理用|IDEA NOV|
|a1997308...|legacy-store-0013|KYARA1/2高田馬場|inactive|旧DIRECT|IDEA NOV|

## 承認済20店舗との差分

- 承認済店舗: 20
- `public.stores`現行店舗（本部除外）: 20
- 不足店舗: なし
- 余剰現行店舗: なし
- 管理・履歴レコード: 本部1、撤退店舗1

名称はブランド接頭辞・display表記を含むが、store codeと人間承認済み名称を照合すると20/20で対応した。

## UUID管理方法

- `public.stores.id`: `gen_random_uuid()`、PK、22/22 unique。
- `core.stores.id`: 別の`gen_random_uuid()`体系。
- 所沢店は両テーブルでcode=`tokorozawa`だがUUIDが異なる。
  - public: `1285ac70...`
  - core: `ccfe77c1...`

この二重UUIDはSSoT判定のBlockingである。どちらかへ自動統合・変更していない。

## Store Code管理方法

- `public.stores.store_id`: NOT NULL、UNIQUE。実質的なアプリ用store code。
- `public.stores.store_no`: NOT NULL、UNIQUE。4桁番号。
- `core.stores.code`: UNIQUEだがnullable。
- publicの22件はcode欠損・重複なし。

新規採番は行っていない。

## 名称・状態・Direct/FC

- `public.stores`は`store_name`のみで、official/display/brand/alias分離なし。
- 状態は`is_active` booleanのみ。
- Direct/FC列はなく、`corporation_id`→`public.corporations.corporation_code`から推定。
- `core.stores`も名称は`name`のみ、状態は`active` boolean。
- `core.corporations.is_fc`は存在するが、core店舗は1件のみ。

## 履歴・有効期間

- 店舗運営主体履歴テーブルは存在しない。
- `public.stores`にはopen_date、effective_from/toがない。
- `core.stores`には`opened_on`・`closed_on`があるが、所沢店1件のみで値はNULL。
- 従業員所属履歴テーブルは店舗運営法人履歴の代用にできない。

立川店やFC化履歴を正式Masterとして表現できないためBlocking。

## RLS・アクセス

### `public.stores`

- RLS: enabled
- FORCE RLS: false
- Policy: 0件
- `service_role`: SELECT等の権限あり
- `authenticated` / `anon`: table grantなし

通常クライアントからの直接参照を閉じる構成だが、正式なread-only Projection/API経路とpolicy方針の承認が必要。

### `core.stores`

- RLS: disabled
- `authenticated`: SELECT grant
- `service_role`: SELECT grant

RLSなしのauthenticated SELECTは、core schemaのAPI公開設定と合わせたSecurityレビューが必要。

## 本番利用可能判定

`public.stores`は現行店舗スナップショットとしては完全性が高い。しかし以下が未解決:

1. `public.stores`と`core.stores`のSSoT二重化
2. 所沢店の二重UUID
3. 運営主体履歴・effective period欠如
4. official/display/alias分離欠如
5. Direct/FCの明示列欠如
6. RLS / APIアクセス設計の未承認

したがってProduction用正式MasterとしてはBLOCKED。

## 検証結果

- Core Master Audit専用テスト: 8/8 PASS
- Phase 6B.5 Master Verification回帰: 8/8 PASS
- Store Sales Staging回帰: 66/66 PASS
- Store Sales Adapter / Preview / Runtime / UI回帰: 84/84 PASS
- Store Sales Projection回帰: 4/4 PASS
- Accounting Core回帰: 28/28 PASS
- Accounting KPI回帰: 33/33 PASS
- NOV NAVI境界回帰: 1/1 PASS
- 合計: 232/232 PASS
- `git diff --check`: PASS

## Git情報

- Branch: `chore/core-master-audit`
- Base branch: `chore/store-sales-master-verification`
- Base commit: `9ce5889d5c3f0c7b04065d14893071f38c2d2ac7`
