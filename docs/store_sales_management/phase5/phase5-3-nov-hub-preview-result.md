# Phase 5-3 NOV HUB Preview 結果

## 判定

**Conditional Go** — localhostのsynthetic Preview確認へ進める。本番接続・公開はNo-Go。

## 実装結果

- NOV HUBに「店舗営業管理」カードを追加
- 既存sales SVGを再利用
- 同一タブ相対遷移とnative browser Back
- canonical NOV HUB sessionの引継ぎ
- mock-only Preview actor context
- executive、department manager、store manager、franchise owner、employee denied
- adapter modeに基づくPreview banner
- HUBへ戻る、session missing/expired、Access Denied
- denial時の業務画面fail-closed

## Test / Screenshot

2026-07-29に既存106件へPhase 5-3の27件を追加し、合計133/133件が合格した。NOV NAVI dashboard boundary、Deno/Node構文・型、JSON、`git diff --check`も合格した。security negative testは既存分を含む21分類すべて合格。Store Sales直接画面のapplication console error/warningは0件だった。

固定画像は次の6点。

- `preview/nov-hub-desktop.png` — 1440×1000
- `preview/nov-hub-mobile.png` — 390×844
- `preview/store-sales-preview-desktop.png` — 1440×1000
- `preview/store-sales-preview-mobile.png` — 390×844
- `preview/access-denied-mobile.png` — 390×844
- `preview/session-expired-mobile.png` — 390×844

## Blocking

- 本番Projection API、server-side actor scope、RLSの実装・承認
- published Accounting/KPI versionとentity mappingの承認
- production buildからmock fixtureを除外するCI
- 正式な対象role・FC法人scope・部門scopeのowner承認
- staging E2E、監査ログ、運用監視、障害復旧確認
- 本番NOV HUBカード公開の明示承認

本番Supabase、DB、Storage、NOV HUB、IDEA LINK、GitHub Pagesへの接続・変更・deployは行っていない。
