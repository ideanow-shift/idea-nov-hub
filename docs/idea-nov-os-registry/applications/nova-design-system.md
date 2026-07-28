# NOVA Design System

- 目的/利用者: IDEA NOV OS全Webアプリの共通UI、icon、色、mobile体験。
- 判定: **Stable / 78% / 本番利用あり**
- repo: HUB repo。
- 技術: CSS、SVG/PNG assets、PWA manifest。
- 認証/DB/Core: なし。
- 依存: HUBと内包アプリが利用。独立package/version配布は未確認。
- 完成: `design-system.css`, app icon registry, NOVA assets。
- 未完成: component contract、semantic version、accessibility regression。
- 負債: 各アプリでstyle重複、cache-busting手動。
- セキュリティ: 原則低。外部font/resourceは未確認。
- 推奨: 維持改善、配布契約を明文化。
- 根拠: `portal/css/design-system.css`, `portal/assets/`, `portal/apps.json`
- 最終確認: owner、対応ブラウザ、WCAG。

