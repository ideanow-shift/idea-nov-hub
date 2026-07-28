# 法人経営管理

- 目的/利用者: 経営者・経理が法人/店舗のP/L、予算、分類、進捗を確認。
- 判定: **Active Development / 70% / 一部本番候補**
- URL/repo: HUB内 `portal/management-app/`; HUB repo。
- 技術/認証/DB: JS、Chart.js/pako、CSV adapters、Supabase候補; HUB context。
- Core/Table: corporations/stores/employees、financial datasets/classification。
- 外部: Yayoi CSV、店舗各種CSV。
- 更新責任: 経理/経営owner未確認。
- 完成: data intake、P/L preview、各種store summary、tests。
- 未完成: 会計正本、締め/承認、live classification providers。
- セキュリティ: 法人scope、財務export、CSV式/PII。
- 推奨: 継続改善。
- 根拠: `portal/management-app/`, `tests/management-*`, `review/management-*`
- 最終確認: production URL、会計照合、owner。

