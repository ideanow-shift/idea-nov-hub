# Decision Hub

- 目的/利用者: 意思決定、承認、進捗の可視化。経営/承認者。
- 判定: **Active Development / 62% / 一部本番候補**
- URL/repo: HUB内 `portal/decision-hub/`; HUB repo。
- 技術/認証/DB: static JS + Supabase/HUB actor context。
- Core/Table: employees/roles、decision/approval tables（未確認）。
- 依存: HUB/Auth/Core。Task Managerと相互重複。
- 完成: frontend、readonly live candidate、actor confidence、tests/review。
- 未完成/不具合: live smokeでauth transport blocked記録。
- セキュリティ: approver偽装、actor confidence、承認監査。
- 推奨: 継続改善、タスク境界確定。
- 根拠: `portal/decision-hub/`, `docs/decision-hub-*`, `review/decision-hub-*`
- 最終確認: production route、workflow owner、DB。

