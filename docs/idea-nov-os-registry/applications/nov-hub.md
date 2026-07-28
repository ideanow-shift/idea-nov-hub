# NOV HUB

- 正式名称/通称: NOV HUB / HUB
- 目的・利用者: 全社員向け社内アプリ入口。管理者は社員・店舗・権限・アプリを管理。
- 主要機能: Firebase/PIN login、portal、通知、access log、master admin、app handoff。
- 判定: **Production / 92% / 本番運用あり**
- URL/repo: `https://ideanow-shift.github.io/idea-nov-hub/` / `ideanow-shift/idea-nov-hub`
- 技術/認証/DB: GitHub Pages、JS、Supabase Edge; Firebase Auth + PIN; Supabase。
- Core/Table: employees, stores, corporations, roles, employee_roles, employee_login_credentials, portal_apps, access_logs。
- 外部/NOV HUB: Firebase、LINE WORKS、各アプリ。HUB自身が統合点。
- 更新責任/依存: HUB/Core owner。Auth、Core DB、Edge、GitHub Pagesに依存し、全アプリがHUB導線に依存。
- 完成済み: Edge-only通常導線、master admin、health、Pages、主要smoke。
- 未完成/不具合: role別公開範囲と外部アプリhandoff差。DBカードの旧URL/重複履歴。
- 負債/セキュリティ: frontend alias判定、service-role scope、UID/email fallback。
- 推奨: 維持改善。再構築しない。
- 根拠: `README.md`, `portal/`, `supabase/functions/nov-hub-api/index.ts`, `docs/hub-production-readiness.md`
- 最終確認: live health、Actions、RLS/GRANT、owner、利用者数。

