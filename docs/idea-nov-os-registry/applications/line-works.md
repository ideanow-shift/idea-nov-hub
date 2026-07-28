# LINE WORKS連携

- 目的/利用者: 店舗/部署へ通知を配送。
- 判定: **Active Development / 70% / 一部本番運用候補**
- repo: HUB repo。
- 技術/認証/DB: Supabase Edge `send-line-works-notifications`; destination table、LINE WORKS bot/API。
- Core/Table: `os.notification_destinations`, notification queue/inbox。
- 依存: Core destination、Notification Engine。Expense/IDEA LINK/Conciergeが利用候補。
- 完成: Edge Function、master-admin宛先管理、readiness監査。
- 未完成: 再送/DLQ、rate limit、delivery receipt、owner。
- セキュリティ: bot Secret、宛先誤送信、内容最小化。
- 推奨: 継続hardening。
- 根拠: `supabase/functions/send-line-works-notifications/index.ts`, `docs/hub-employee-line-works-*`, `supabase/notification-destinations.sql`
- 最終確認: live bot権限、送信実績、rotation。

