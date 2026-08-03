# V1 Scope Boundary

## 認証・認可の6層

Permission Modelの構造は変更しない。UIが前提とするServer-side境界は次の6層である。

1. HUB Session／employee解決
2. canonical Role
3. Store Operationsアプリ利用Permission
4. 非利益KPI／確定利益・利益率のData Scope
5. `employee_store_assignments`から解決するStore Scope
6. 必要なAction Scope

正式Permission Key名とBundle名はCore DB/Auth契約確定待ちである。仮Keyや仮Bundleを創作しない。UI上の表示・状態・閲覧範囲契約は本資料で確定する。

`representative`と`sales_manager`はPreview／表示用aliasに限定し、backend Roleとして使用しない。一般社員はV1対象外で、カード非表示・直接URL403とする。営業部長のcanonical department relationは未確定である。

## Store Scope正本

AM、店長、primary／secondary／兼任店舗の唯一の正本は`employee_store_assignments`である。有効条件は`effective_from <= 対象日 < effective_to`、`effective_to=null`は継続中とする。employeeのprimary storeを独立した認可正本にしない。

応援勤務は売上、生産性、稼働スタッフ数の集計には含められるが、Store Scopeを拡張しない。assignment未解決は推測せず403。scope外店舗URLも403とする。

全店／直営／FCはPermission Scopeではない。Serverが返した許可済み店舗ID集合を狭める表示Filterだけである。

## V1で扱うもの

- 月次、予算比、前年同月比、年間累計、月別推移
- Executive Summary、優先Action最大3件、業績Driver 4群
- 店舗Portfolio、店舗一覧、店舗詳細4区分
- 総売上、非利益KPI、権限範囲内の直営店確定利益・利益率
- FC利益の「V1対象外」状態
- 確定、集計中、準備中、V1対象外、権限なし、503、Previewの分離
- Role別初期表示と許可済み店舗集合内のFilter

## V1で扱わないもの

- FC店舗利益
- 日別売上、日次進捗、リアルタイム、POS、顧客単位データ
- スタッフ個人分析、スタッフ別売上、個人ランキング
- 単純な売上／利益ランキング、健康スコア表示
- Action履歴、通知、承認、入力、書き込み
- UI側のRole／Permission／Scope判定

## Data Contract Gap

[Monthly Projection Contract](../monthly_data_foundation/monthly-projection-contract.md)では客数・単価が当時のSource Scope外である。今回のV1 UI対象には含めるが、正式Contract未承認時は値を創作せず準備中とする。EC按分も承認Contractがない間は準備中とする。

## 巻き戻し防止

- 未取得を0へ変換しない
- FC利益を集計中／準備中へ置換しない
- 権限なしをデータ状態として見せない
- Support勤務やFilterでStore Scopeを拡張しない
- UIでPermission Key、Bundle名、状態判定式を固定しない
