# NOV Navi

- 目的/利用者: 社員を必要な情報・申請・アプリへ案内。
- 機能: today aggregate、notice、app navigation、concierge。
- 判定: **Active Development / 72% / 一部本番候補**
- URL/repo: HUB内。HUB repo。
- 技術/認証/DB: JS dashboard + Edge candidates; HUB session/Core。
- Core/Table: employees、portal_apps、notifications、department context。
- 依存/被依存: HUB/Auth/Core/Concierge。社内問い合わせ導線が依存。
- 完成: UI、契約、provider registry/test、feature flag資料。
- 未完成: providerのlive接続、全カード/通知統合。
- 負債/セキュリティ: URL context privacy、role別表示差。
- 推奨: 継続改善。
- 根拠: `portal/js/nov-navi-dashboard.js`, `docs/NOVNavi_*`, `review/nov-navi-*`
- 最終確認: production flag、利用者、live providers。

