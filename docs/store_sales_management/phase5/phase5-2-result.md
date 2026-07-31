# Phase 5-2 実装結果

## 判定

**Conditional Go** — mockと隔離synthetic integrationのレビューへ進める。本番接続はNo-Go。

## 実装

- UIとデータ取得をadapter境界で分離
- localhost-only mock、read-only integration、blocked production
- 単一Projection responseの契約検証とsafe error mapping
- executive、department manager、store manager、franchise owner、employee deniedのsynthetic fixture
- actor scope、値状態、provenance、priority orderの防御
- キャッシュ無効、401時session破棄
- UI改善（対象月分離、mobile card、自店舗home、5状態、empty、320px、keyboard/ARIA）を維持

## 検証結果

2026-07-29に次を実行し、合計106件が合格した。

- adapter/UI Node tests: 41/41
- Store Sales Projection Deno tests: 4/4
- Accounting Core: 28/28
- Accounting KPI: 33/33
- Deno/Node syntax and type checks: 合格
- `git diff --check`: errorなし（Windows改行変換warningのみ）

security negative testは12分類すべて合格した。320px、keyboard、ARIAはUI改善コミット前のbrowser確認と今回のUI回帰テストで維持を確認した。実会計データ、本番API、本番Supabase/DB/Storage/NOV HUB/IDEA LINKは使用していない。

## 残存Blocking

- server-side aggregate Projectionの実装とreview
- sessionからactor scopeを解決する認可試験
- entity mapping/account group/税込rule/published versionの承認
- production endpoint、RLS、監査ログ、運用監視の承認
- staging E2E/負荷/障害復旧試験

## 次に必要な人間確認

API契約、公開可能項目、scope model、version conflict方針、会計確定月の意味、運用runbookを各ownerが承認し、別フェーズでproduction enableを明示承認する。
