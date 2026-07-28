# 営業部⇔教育部DB

- 目的/利用者: 営業部と教育部の連携データ。両部門。
- 判定: **Planned / 25% / 本番未確認**
- URL/repo/技術/認証/DB/table/owner: 未確認。
- Core/HUB: employee/store候補。HUB static cardのみ。
- 完成/未完成: 実体、system boundary、source of truthが未確認。
- セキュリティ: 部門間PII、目的外利用。
- 推奨: アプリ開発前にdata contract/ownerを定義。
- 根拠: `portal/apps.json`, `portal/js/apps.js`
- 最終確認: DBかアプリか、既存Spreadsheet/GAS。

