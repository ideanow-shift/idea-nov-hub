# HUB表示定義のみ確認できたシステム群

## 1on1 MTG

- 目的: 面談記録/feedback。対象: 社員/manager。
- 判定: **Unknown / 20% / 本番未確認**
- 根拠: `portal/apps.json`, `portal/js/apps.js` のdemo URLのみ。
- repo/URL/技術/認証/DB/table/owner/完成機能: 未確認。
- 依存候補: employees、manager relationship、HUB。
- リスク: 要配慮個人情報。推奨: 実体確認まで新規再構築しない。

## 営業部Webアプリ

- 目的: 店舗実績と目標進捗。対象: 営業/経営。
- 判定: **Unknown / 30% / 本番未確認**
- 根拠: static demo cardのみ。repo/URL/DB未確認。
- 依存候補: stores/sales。店舗営業管理と重複。
- セキュリティ: 売上scope/export。推奨: ownerと正本確認。

## 営業部⇔教育部DB

- 目的: 部門連携データ。
- 判定: **Planned / 25% / 本番未確認**
- 根拠: HUB static cardのみ。DBかアプリかも未確定。
- 推奨: data contractを先に定義。

## キャンペーン管理

- 判定: **Unknown / 20% / 本番未確認**
- 目的: 販促campaign進捗。repo/URL/DB/owner未確認。
- 依存候補: stores/products/sales。推奨: 実体確認。

## EC・商品管理

- 判定: **Unknown / 25% / 本番未確認**
- 目的: 商品、在庫、発注。repo/URL/DB/owner未確認。
- 依存候補: product/store。棚卸しと重複。
- セキュリティ: 価格、仕入、取引先。推奨: inventory boundaryを統合評価。

## 棚卸し

- 判定: **Unknown / 25% / 本番未確認**
- 目的: 棚卸し/在庫差異。static cardのみ。
- 推奨: 商品管理の機能として統合可否を確認。

## Instagram自動投稿

- 判定: **Unknown / 20% / 本番未確認**
- 目的: 投稿素材/配信。static cardのみ。
- 外部候補: Meta/Instagram API。
- セキュリティ: long-lived token、誤投稿、承認、個人情報。推奨: Secret/owner確認まで凍結扱い。

