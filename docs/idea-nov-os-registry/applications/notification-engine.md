# OS Notification Engine

- 目的/利用者: 各domain eventをHUB inbox/LINE WORKSへ通知。
- 判定: **Active Development / 65% / 一部本番**
- repo: HUB repo。
- 技術/認証/DB: Supabase tables/Edge; service role、destination。
- Core/Table: `os.notifications`, `os.nov_hub_notification_inbox`, `os.notification_destinations`。
- 依存: Core employee/store、LINE WORKS。Expense/IDEA LINK/Conciergeが依存候補。
- 完成: inbox/destination/Edgeの実装・契約資料。
- 未完成: idempotency、DLQ、retry、delivery receipt、schema統一。
- セキュリティ: 宛先誤り、機密本文、service role。
- 推奨: 共通基盤として継続改善。
- 根拠: `supabase/notification-destinations.sql`, `supabase/functions/send-line-works-notifications/`, `docs/OS_NotificationEngine連携仕様_NOVNavi.md`
- 最終確認: live queues、SLA、owner。

