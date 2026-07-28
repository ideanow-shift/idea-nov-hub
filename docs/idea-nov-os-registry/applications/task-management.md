# タスク管理

- 目的/利用者: 本部タスク、担当、期限、進捗。
- 判定: **Active Development / 58% / 一部本番候補**
- URL/repo: HUBカードはdemo/fallback。APIはHUB repo。
- 技術/認証/DB: Supabase Edge `task-manager-api`; HUB session候補。
- Core/Table: employees/roles、task tables（live名未確認）。
- 依存: Core/Auth。Decision Hubと責任重複。
- 完成: Edge API実体、Core migration boundary/decision資料。
- 未完成: confirmed UI route、本番URL、workflow/通知。
- セキュリティ: assignee差替え、department scope。
- 推奨: Decision Hubとの境界を決めて継続。
- 根拠: `supabase/functions/task-manager-api/index.ts`, ワークスペース `task-management-*`
- 最終確認: DB、owner、production usage。

