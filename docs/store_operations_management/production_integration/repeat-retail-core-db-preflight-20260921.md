# リピート率・店販購買客数 Core DB read-only preflight

## 実行境界

- Portfolio Lock: `CTO-PORTFOLIO-EXECUTION-ORDER-2026-08-22-V4`
- Current/Requested phase: `PHASE_3_STORE_OPERATIONS_MANAGEMENT_V1`
- Work allowed: `YES`
- Staging project: `zgkoofphhivesclehrom`
- Production project: `nkmxevmioczcmnldreyo`
- 実施: read-only照会、設計、review-only DDL、書込能力のない候補行loader、validator、fixture/static test、dry-run計画
- 未実施: Staging/Production DDL・DML、Migration、deploy、実データwrite

## 固定入力とSHA-256

| 入力 | SHA-256 | 結果 |
|---|---|---|
| リピート率JSON | `EC6446D0FED94CC0494E8AA47320309EE931DE65F52A54157172D3BB8852EB9A` | 一致 |
| 店販購買客数JSON | `EF2C56108BACED3F1999F6903C681B8D7BE963A50707388DC84BEA2BBFA68942` | 一致 |
| リピート率Schema | `AE3C6856286627DFBDF555C663DF8BB6C7AC411F583F968847BAC324398A7BBF` | 一致 |
| 店販購買客数Schema | `5A40BE9C06A399690CC39DD6FFE4FF6F9F3AA3A05E9BD72D3C9003DA4B12095D` | 一致 |
| 検算レポート | `C71EA2FB10772EB71F35AC6DFCA63BB873006EB9C9CC7B2A9F8649002B334B1E` | 一致 |
| SHA manifest | `7D60245FE867271C87B531ACC8462EB385506A3A7E5025D8186F6A7BE4D1488E` | 一致 |
| package root | `94CA104E062E3BCB2CB47910AA47F95F578C1BF9463196A2A4D9304E5A4ABBBA` | 一致 |

## 検証結果

- リピート率: 7,480行／ユニーク7,480、COMPANY_TOTAL 440、STORE 7,040、20店舗、重複0、算出月不一致0、率不一致0。
- 店販購買客数: 2,476行／ユニーク2,476、負数0、総客数超過0、NULL→0変換0。
- SALON promotion候補1,492、営業期間外除外62、COMPANY_TOTAL 92、EC/HQ staging-only 830。
- COMPANY_TOTALとSTOREは別Fact境界とし、合算禁止。会社合計に架空store_idは使用しない。
- `RETURNING`と`SEMI_FIXED`は`customer_segment`で保持する。入力の旧`SECOND_REPEAT_RATE`／`THIRD_REPEAT_RATE`候補は整合確認後に破棄し、canonical metric codeへ変換しない。
- Production STORE repeat 7,040行は固定入力STORE部分とkey/count/full fingerprintが完全一致。再投入・supersede対象外。
- 既存`RETAIL_PURCHASE_RATE v1`は4行。新しい精密候補は表示精度では一致するが定義版が異なるため、今回は既存4行を変更しない。

## mapping

- 店舗: package 20 unit_keyすべて完全一致。昇格候補1,492行は一致1,492、未一致0、複数一致0。
- `SALON:KYARAHALF`は履歴上1件の時系列分割があるが、各対象月では一意。会社有効期間不一致0。
- 法人: company_no `0001`の1件がProduction法人正本の有効1件へ完全一致。対象532行、一致1、未一致0、複数一致0。
- 営業期間外SALON 62行は出典保持のままcanonical昇格対象外。

## 予定件数（まだ実行しない）

### Staging

| 区分 | insert | reject | unchanged |
|---|---:|---:|---:|
| STORE repeat | 6,600 | 0 | 440 |
| COMPANY_TOTAL repeat | 440 | 0 | 0 |
| SALON 店販購買客数 | 1,492 | 62 | 0 |
| COMPANY_TOTAL 店販購買客数 | 92 | 0 | 0 |
| EC/HQ staging-only | 830 | 0 | 0 |
| 合計 | 9,454 | 62 | 440 |

### Production

- insert予定: 2,024（会社repeat 440、SALON数量1,492、会社数量92）
- supersede予定: 0
- unchanged: STORE repeat 7,040、既存retail rate 4
- canonical対象外: 営業期間外62、EC/HQ 830
- このタスクでのProduction write: 0

## review-onlyオブジェクト境界

- 新規テーブル3: 非公開会社repeat staging、公開会社repeat Fact、公開会社retail quantity Fact。
- 新規index 6、既存metric code CHECK制約変更1。予定schema object作成／変更は計10。
- `metric_definitions`参照行1件を追加する案。STORE repeat FactとSTORE汎用metric Factは既存契約を再利用。
- review-only SQLは先頭guardで必ず例外終了し、現状のまま実行不能。

## セキュリティ

- 新規3テーブルはRLS有効＋FORCE RLS、`public/anon/authenticated/service_role`を初期状態で全REVOKE。
- public objectは2テーブルだが、Data API公開0、policy 0、GRANT 0。必要なresolver／policy／service_role権限は別承認で個別設計する。
- viewは未作成。将来作る場合は`security_invoker`とし、`SECURITY DEFINER`を使わない。

## 成果物SHA-256

| 成果物 | SHA-256 |
|---|---|
| review-only DDL | `D478EB6C17ADBEC7C9B302E940FE60834BEA4FFE619830D5B266631A2E30102A` |
| 候補行loader | `1E468135DAB3C7679FA75F32555E20FB3419FAC8B3D4B2F1D89B7A86941F83B4` |
| validator | `42E202DF8A69D8EFB1B7AC3A80A81CD639550D37594FAFB20F2E1528B89F423C` |
| dry-run planner | `5F6A2B5A7DF3B4ED9D812A6794D788E6565342137259B658CD95B91F4A7B608F` |
| package/loader unit test | `B32320A0A7541CE5B564C31FE0A83002350DA7F74D552CF57CA56C73EA1BC0A9` |
| DDL static test | `F066C73A3CB9874F2A68222788900BACB59BA250A9259B2EC279FC13B097669B` |
| read-only baseline | `4CBC07F102D203B657716F103FB93BBDC829F6E88BA13F0C2BA3B39D3A487F65` |
| validation result | `2A5E413385FCD12A334B69567EB65644D280D9E9552F5ECF75BD742CDB0CB288` |
| dry-run result | `8E76301C3269240099F0C93D03DFF39D73311ADAF9005C07129322A6191C56B0` |

Node fixture/static testは13/13 PASS。ローカル環境に`psql`／Dockerがないため、ローカルPostgreSQL実行テストは未実施でありPASS扱いしない。

## 失効手順

誤りが判明した場合はDELETEや値の上書きを行わず、訂正versionを`correction_of_fact_id`付きで先に追加し、先行Factは値を保持したまま`is_active=false`／`superseded_at`の失効metadataだけを更新する。厳密な完全append-onlyが必要なら、実行前に失効event専用表へ変更したv2 DDLを再レビューする。

## 未解決事項と停止条件

1. Productionに適用済みのrepeat migration `20260920213022`、`20260921003615`、`20260921021737`が`origin/main`のmigrationファイルに存在しない。将来のMigration作成前にschema履歴をrepoへ整合する。
2. `RETAIL_PURCHASE_RATE`精密率の新definition versionと既存v1の共存／昇格判断が必要。
3. policy、GRANT、Data API公開、resolverは別レビュー・別承認が必要。
4. ローカルPostgreSQL runtimeがないため、実DB相当testはStaging実行承認後のtransactional dry-runで補完する。
5. Staging／ProductionのDDL・DML、Migration、deploy、writeはOwnerの別承認まで停止する。
