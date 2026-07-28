# NOV Talent／求人管理

- 目的/利用者: 採用担当の候補者、学生profile、review、offer、workforce手続管理。
- 判定: **Active Development / 74% / 一部本番候補**
- URL/repo: HUB内 `portal/talent/`; HUB repo。
- 技術/認証/DB: ES modules、Supabase Edge read/write APIs、Postgres migrations、Playwright/Node tests。
- Core/Table: employees/stores/job types; `nov_talent_student_profiles`, staging supplements, procedure cases/steps等。
- 外部/HUB: HUB same-origin/session、CSV intake。
- 更新責任: 採用/人事owner未確認。
- 完成: readonly/write contract、CSV preflight、profile/review/workforce UI、多数tests。
- 未完成: live role/scope、正式運用workflow、現職者handoff。
- セキュリティ: PII export、case scope、actor偽装、CSV。
- 推奨: 継続完成。再構築しない。
- 根拠: `portal/talent/`, `supabase/functions/nov-talent-*`, `supabase/migrations/20260725*`, `tests/nov-talent-*`
- 最終確認: production URL、data volume、owner、SLA。

