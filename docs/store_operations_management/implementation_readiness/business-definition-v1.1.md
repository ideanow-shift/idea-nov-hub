# Store Operations Business Definition v1.1

## Tax Policy Freeze

Store Operations V1で正式値として扱う売上、利益、単価、客数、KPIの金額基準は税抜で統一する。PreviewはSynthetic Fixtureだけを使用し、実績値、Business Fact、Accounting Factへ接続しない。

| 項目 | V1.1定義 |
| --- | --- |
| 総売上 | 税抜。店舗売上と承認済みEC配賦の合計 |
| 営業利益 | 税抜売上を分母・基礎とする店舗営業利益。未確定は`null` |
| 営業利益率 | 営業利益 ÷ 税抜売上 |
| 総単価 | 税抜売上 ÷ 総客数 |
| 技術単価 | 税抜技術売上 ÷ 対象客数 |
| 客数 | 人数。税区分非該当だが、同一period／scopeの売上KPIと組み合わせる |
| 売上系KPI | 金額要素はすべて税抜。予算比・前年比も同じbasis同士で比較 |

UIは「総売上（税抜）」とデータ情報の「税区分: 税抜」を表示する。`tax_basis`が`net`以外または欠落したProjectionは`validation_error`とし、推測変換、一律1.1除算、税込fallback、0円化を禁止する。

## Business Fact保留境界

本実装はFixture Projectionを唯一の値入力とする。DB、Supabase、Migration、Business Fact、Accounting Fact、Production endpointへ接続しない。正式接続時は同じProjection Contract v1.1を満たすread-only responseへData Sourceだけを交換する。
