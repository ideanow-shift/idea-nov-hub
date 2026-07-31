# Phase 6B.5 Master Verification Report

## 判定

**BLOCKED**

Google店舗マスターとEntity Approval Boardの現行20店舗は正規化により対応でき、運営会社ログも承認済みの現行Direct/FC区分と整合する。一方、Supabase Core DBの実レコード、UUID、店舗コード、法人FK、open dateを確認できるread-only exportがリポジトリに存在せず、三者照合を完了できない。

本調査ではデータ更新、Supabase接続変更、migration、deploy、seed置換、UUID生成、rename、統合を行っていない。

## 調査対象

1. Supabase Core DB候補
   - リポジトリ内schema、review文書、SELECT候補、API select定義
   - 実レコードexportは確認できず
2. Google Spreadsheet「店舗設備等情報（AI対応ソース）」
   - `店舗マスター`（sheetId 0）
   - `店舗運営会社ログ`（sheetId 449599264）
3. Entity Approval Board
   - 本指示で人間承認済みとして提示された直営13店、FC7店、運営法人、立川履歴、名称ルール

## アクセス可否

- Google Sheet: read-onlyアクセス成功
- Supabase Core: 外部DBへは接続せず、repository evidenceのみ確認
- Entity Approval Board: 指示本文を承認済み根拠として使用

Google Sheetには認証関連列および金額系列が存在するが、成果物へ出力していない。

## 比較方法

- ブランド接頭辞、全半角、`店` suffix、大小文字を正規化して候補比較
- official_name / display_name / brand_name / search_aliasを分離
- 現行運営会社と履歴期間を分離
- Core UUID・store codeは実値を推測せずTBD
- 三者の一つでも実値が不足する場合はtri-source確定とせず`unknown`

## 全体結果

- 承認対象: 20店舗
- Google現行店舗との候補対応: 20/20
- Core実値を含む三者一致: 0/20
- match_status: unknown 20
- Blocking: 20
- Core UUID確認済み: 0
- Core store code確認済み: 0
- open_date三者一致: 0
- effective period三者確認済み: 0
- Google運営履歴が確認できた現行店舗: 20

## 重要差分

1. Core実レコード不在
   - schema上は`public.stores.id`、`store_no`、`store_id`、`store_name`、`corporation_id`等が存在する。
   - 実UUID・コード・法人FKを確認できないため、missing_in_coreとは断定せずunknownとした。
2. 久米川店のopen date
   - Google値が`197703/12`で、日付として不正または曖昧。
3. 名称分離
   - `BASSAANNEX店`はANNEX店のdisplay/alias候補。
   - `Roane by BASSA店`は`Roane by Bassa`のdisplay/alias候補。
   - `KYARA HALF池袋`はKYARA HALF店のlocation/display候補。
4. 履歴
   - 立川店は2026-06-01からIDEA NOV直営というGoogleログとBoard承認が一致。
   - 新所沢、久米川、国分寺、花小金井、東久留米は同一店舗の直営→FC履歴候補。
   - 野方店はALBERO→IDEA NOV直営化履歴がGoogleログにある。
5. 本部
   - Googleに本部行があるが、store entityへ自動統合しない。head_office / department / accounting_source_entityの人間判断が必要。

## 次の人間判断

1. 安全なread-only Core exportの提供
2. 久米川店open dateの訂正ではなく事実確認
3. official/display/aliasの正式承認
4. 運営主体履歴を保持するCore構造の確認
5. 本部のentity type決定

Entity Mappingの正式承認へは進めない。

## 検証

- 追加Master Verificationテスト: 8 / 8 PASS
- 既存回帰: 216 / 216 PASS
- 合計: 224 / 224 PASS
- CSV: UTF-8、20行、21列
- Markdownリンク: すべて解決
- secret値、実会計金額、Windows絶対パス: 混入なし
- `git diff --check`: PASS

## Git

- Base branch: `chore/store-sales-entity-mapping-approval`
- Base commit: `6b8afe294dd257ae3281236b116f6ad91731a346`
- Head branch: `chore/store-sales-master-verification`
