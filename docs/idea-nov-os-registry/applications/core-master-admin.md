# Core Master管理

- 正式名称/通称: 社員・店舗マスタ管理 / master-admin
- 目的/利用者: 管理者が社員、店舗、PIN、role、portal app、LINE WORKS宛先を管理。
- 判定: **Stable / 84% / 本番運用あり**
- URL/repo: `https://ideanow-shift.github.io/idea-nov-hub/master-admin/` / HUB repo。
- 技術/認証/DB: static JS + nov-hub-api + Supabase; HUB elevated session。
- Core/Table: employees, stores, roles, employee_roles, employee_login_credentials, portal_apps, notification_destinations。
- 更新責任: HUB/Core DB owner。各domainは直接複製更新しない。
- 完成: CRUD UI、PIN/role/app管理、履歴候補。
- 未完成: corporation/assignmentのsingle writer契約、live privilege確認。
- セキュリティ: platform adminとPII閲覧権限、role昇格、PIN hash。
- 推奨: 維持改善。
- 根拠: `portal/master-admin/`, `portal/master-admin-stable/`, `supabase/functions/nov-hub-api/index.ts`
- 最終確認: production role matrix、監査log保持。

