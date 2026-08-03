# Role別初期表示

## 正式認可前提

UIはServerが認可済みとして返した店舗とKPIだけを表示する。認可はRole名単独ではなく、canonical Role、Store Operationsアプリ利用Permission、非利益KPI Data Scope、確定利益・利益率Data Scope、Store Scope、必要なAction Scopeの組み合わせで解決する。

正式Permission Key名とBundle名は未確定である。仮名を作らず、Core DB/Auth契約確定後に置換する。UI上の表示・状態・閲覧範囲契約は本資料で確定する。

`representative`と`sales_manager`はPreview／表示用aliasであり、backend認可の正式Roleとして使用しない。`stores.view`単独もアプリ利用、非利益KPI、利益閲覧の根拠にしない。

## Role別契約

| 利用者 | canonical Role第一候補／追加条件 | Store Scope | 初期表示 | 利益 |
| --- | --- | --- | --- | --- |
| 代表取締役・副社長 | executive相当＋必要Permission | 全アクティブ店舗 | 全店Summary、全店／直営／FC Filter、非利益KPI | 権限範囲内の確定利益・利益率。全店時は直営店利益と対象店舗数 |
| 営業部長 | `department_manager`＋営業部属性＋専用Permission Bundle | 全アクティブ店舗 | 全店Summary、要対応、優先Action最大3件、店舗比較 | 権限範囲内の確定利益・利益率。canonical department relationは実装契約待ち |
| エリアマネージャー | `area_manager`＋有効assignment | `employee_store_assignments`の有効店舗のみ | 担当範囲Summary、要対応、担当店舗Action | 担当直営店のみ確定利益・利益率。担当FC利益はV1対象外 |
| 店長 | `store_manager`＋有効assignment | primary／secondary／兼任assignmentの店舗のみ | 対象店舗の詳細Summary、最優先課題、次に確認 | 直営店のみ確定利益・利益率。FC店利益はV1対象外 |
| 一般社員 | 対象外 | なし | HUBカード非表示 | 直接URLは403 |

営業部長を`executive`へ安易に対応させない。営業部長のcanonical department relationは未確定であり、確定するまでUI実装がRole表示名からScopeを推測してはならない。

## Assignmentの期間

AM、店長、primary／secondary／兼任店舗の唯一のStore Scope正本は`employee_store_assignments`とする。対象日時点で次を満たすassignmentだけを使用する。

```text
effective_from <= 対象日 < effective_to
```

`effective_to=null`は継続中とする。employee側のprimary storeは認可上の第二正本にしない。assignment未解決時は店舗を推測せず403とする。

応援勤務は売上、生産性、稼働スタッフ数の集計に使えるが、閲覧Scopeを拡張しない。

## Filterと直接URL

全店／直営／FCはPermission Scopeではなく、Serverが返した許可済み店舗ID集合を狭める表示Filterである。Filter、URL、frontend claimで店舗を追加できない。scope外店舗URLは403「対象店舗の閲覧権限なし」とする。

## 5分判定

- 代表・副社長: 全体状態、最優先店舗、主要因を回答できる
- 営業部長: 店舗、担当者、確認テーマを決められる
- AM: assignment内の店舗、質問、支援区分を決められる
- 店長: assignment内の対象店舗について今日の重点を決められる
