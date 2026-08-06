# Business Definition v1.1 / Tax Policy Freeze

## Freeze status

Store Operations V1のUI仕様では、金額KPIの正式な税基準を税抜に固定する。売上、利益、単価はすべて税抜値を表示し、税を含む値への換算、推計、丸め直しをUIで行わない。

## Contract

| 項目 | V1正式契約 |
| --- | --- |
| 税基準 | `tax_basis=net` |
| 売上 | `sales_net`。表示名は「総売上（税抜）」 |
| 利益 | 税抜売上と同じ正式Projection期間・基準の値 |
| 利益率 | 営業利益 ÷ 税抜売上 |
| 単価 | 税抜売上を基礎とする税抜単価 |
| 客数 | 人数。金額ではないため税基準の適用外 |
| 金額KPI | 税抜で統一し、税を含む値を併記しない |

Projectionは`tax_basis`と税抜売上フィールド`sales_net`を返す。`tax_basis`が`net`以外、または欠落しているProjectionを正式値として表示してはならない。

## NULL and zero

- `null`は未取得、未確定、集計中、準備中、権限対象外のいずれかであり、理由を状態契約で区別する。
- `0`は正式Sourceが確定値ゼロを返した場合だけ表示する。
- 未確定利益、未取得売上、未接続KPIを0円または0%へ変換しない。
- UIで税抜値から税を含む値を算出しない。旧税基準の売上表記は使用しない。

この契約はUI仕様・Projection ContractのFreezeであり、Business Fact、Accounting Fact、DB、API接続を追加するものではない。
