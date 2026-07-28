# Expense Hub／経費申請・経理サポート

- 目的/利用者: 社員の経費明細登録、月次精算、承認、経理確認、弥生CSV。
- 判定: **Stable / 86% / 本番運用あり**
- URL/repo: `https://ideanow-shift.github.io/idea-nov-expense-hub/`; repo名同候補（アクセス未確認）。
- 技術/認証/DB: GitHub Pages/JS/Supabase候補; HUB連携。
- Core/Table: employee/store/corporation、expense claims、notification inbox（正式全表未確認）。
- 外部: Yayoi CSV、LINE WORKS/HUB通知。
- 更新責任: 経理owner未確認。
- 完成: 明細、月次、経理確認、CSV、公開URL/HUB card。
- 未完成: 独立「経理サポート」実装との境界、live audit。
- セキュリティ: 領収書PII、承認scope、CSV export。
- 推奨: 維持改善。
- 根拠: `portal/expense-hub/index.html`, `supabase/expense-hub-public-url.sql`, `portal/js/apps.js`, ワークスペース `nov_keiri_employee_admin`
- 最終確認: repository、Storage、会計運用、通知。

