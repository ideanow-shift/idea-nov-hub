# Management Platform／環境整備

- 目的/利用者: 管理者の環境整備、管理者成長、履歴・分類ready確認。
- 判定: **Stable / 78% / 本番運用あり候補**
- URL/repo: HUB内 `portal/management-platform/`; HUB repo。
- 技術/認証/DB: static JS + Supabase候補; HUB context。
- Core/Table: employee/store、management check photos/classification。
- 依存: Core Master/Storage。環境整備カードと同一/重複候補。
- 完成: UI、classification panel、config、photo storage SQL、tests。
- 未完成: live provider/RLS、正式owner/名称。
- セキュリティ: 写真Storage path、manager scope。
- 推奨: 維持改善、名称統合。
- 根拠: `portal/management-platform/`, `supabase/management-check-photo-storage.sql`, `review/management-classification-*`
- 最終確認: production URL、photo retention、利用者。

