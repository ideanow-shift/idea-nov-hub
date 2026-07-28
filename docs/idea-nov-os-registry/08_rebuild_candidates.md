# Rebuild Candidates

| candidate | recommendation | reason | preserve |
| --- | --- | --- | --- |
| 店舗営業管理 | Redesign | 売上、予算、店舗運営、経営画面の境界が曖昧 | CSV adapters、既存指標、UI知見 |
| 現職者管理 | Redesign | Core Master、人財投資、Talent、勤怠との責任重複 | employee ledger、履歴、既存API |
| THANKS旧カード | Freeze/Legacy | IDEA LINKと重複、旧GAS | 過去データとread-only参照 |
| 営業部Web | Assess before build | 実体不明 | 確認できた既存資産 |
| EC/商品/棚卸し | Assess/consolidate | 商品・在庫・棚卸しが分離/重複候補 | 商品コード、在庫履歴 |
| 1on1 | Assess before build | HUB定義のみ | 既存面談データ |
| Instagram自動投稿 | Assess/security review | token/Meta連携実体不明 | 投稿履歴、承認フロー |

## 再構築しない対象

NOV HUB、IDEA LINK、Expense Hubは維持改善。Core Platformは置換せず、正本決定と境界強化。Talent、Management、Educationは既存実装を段階完成させる。

