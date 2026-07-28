# 社内問い合わせ・ナレッジ窓口

- 正式名称/通称: NOV Navi Concierge / 社内問い合わせ・ナレッジ窓口
- 目的/利用者: 全社員の問い合わせ受付、案内、担当部署routing。
- 判定: **Active Development / 68% / 一部本番候補**
- URL/repo: HUB内 `portal/concierge/`; HUB repo。
- 技術/認証/DB: JS + `concierge-api` Edge; HUB session。
- Core/Table: employee/department、department inquiries、notification destinations。
- 外部: LINE WORKS/notification候補。
- 完成: UI、strict JSON、session boundary、action boundary、CORS候補。
- 未完成: knowledge source、SLA、担当/完了workflow。
- セキュリティ: 相談内容機密性、routing、CORS、ログ。
- 推奨: 継続改善。
- 根拠: `portal/concierge/`, `supabase/functions/concierge-api/`, `supabase/concierge_20260701_department_inquiries.sql`
- 最終確認: 本番利用、保持期間、owner。

