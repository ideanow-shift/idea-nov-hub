# 現行アーキテクチャ

## 確認できた経路

```text
NOV HUB session
  -> Management app (GitHub Pages想定)
  -> nov-hub-api action
  -> server-side actor / role / store scope
  -> public Core master / finance monthly tables
  -> read-only response

Local CSV files
  -> browser-only validator
  -> sanitized local preview
  -> 永続化なし
```

フロントエンドは`managementFinanceSummary`、`managementStoresSummary`、`managementDataopsStatus`を呼ぶ。店舗scopeはemployee、role、assignmentを元にサーバー側で導出する思想がある。

## 現在使える境界

- 認証入口とHUB sessionの既存資産は変更せず利用する。
- actorはrequestの`employee_id`や`store_id`を信用せず解決する。
- Core masterへのアクセスはPhase 1でCore Read Adapterに集約する。
- CSVは現状ブラウザ内previewのみで、本番upload・mutationはdisabledである。
- corporate P/Lは店舗売上の正本ではなく、月次照合先である。

## 未完成の経路

```text
正式売上原本
  -> immutable import batch
  -> staging / validation
  -> business-rule normalization
  -> close / correction / reconciliation
  -> canonical sales facts
  -> monthly snapshot
  -> role-scoped API
  -> UI
```

この経路は設計候補があるだけで、production-readyな実装は確認できない。

## Backend / hosting inventory

| 項目 | 状態 |
|---|---|
| Supabase Edge Function | `nov-hub-api`内に管理read候補あり |
| Supabase DB | Core master、finance、assignment SQLを確認 |
| GitHub Pages | portal静的アプリ構成を確認。実deploy設定の全容はUnknown |
| Firebase | HUB本人認証の既存基盤。今回変更対象外 |
| GAS | legacy資料はあるが、現行売上経路は確認できずUnknown |
| batch | 店舗売上の稼働中batchは未確認 |
| external API | 店舗売上API連携は未確認 |
| Spreadsheet | 予算等の想定記述はあるが現行正本はUnknown |

## セキュリティ上の注意

Edge Functionではservice role利用箇所がある。ブラウザにservice roleを出さず、Phase 1以降もactor、corporation、store scopeを各queryに強制し、default denyとする。既存candidateファイルが実deploy routerへ確実に接続されているかは再確認が必要である。
