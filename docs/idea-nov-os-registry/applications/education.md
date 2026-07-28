# IDEA NOV EDU／教育部Webアプリ

- 目的/利用者: 社員の教育動画、技術manual、研修予定。
- 判定: **Active Development / 66% / 一部本番**
- URL/repo: HUB内 `./education-app/`候補。DB監査時は`EDU`が旧GAS URL。HUB repo。
- 技術/認証/DB: static frontend + readonly Edge candidate、旧GAS。
- Core/Table: employee/store、education domain（live table未確認）。
- 依存: HUB/Auth/Core、営業教育DB候補。
- 完成: frontend、readonly domain/http fixtures、GAS retirement設計。
- 未完成: DBカードcutover、write/運用機能、正式data source。
- セキュリティ: 教材権限、旧GAS公開、employee scope。
- 推奨: 既存実装を継続完成。
- 根拠: `portal/education-app/`, `supabase/functions/education-readonly-api-candidate/`, `review/gas-exit-20260717/education-*`
- 最終確認: live card、GAS deployment、教育owner。

