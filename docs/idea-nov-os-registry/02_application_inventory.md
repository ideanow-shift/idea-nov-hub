# アプリケーション台帳

## 判定別

### Production / Stable

NOV HUB、IDEA LINK、Supabase Core Platform、Core Master管理、Firebase Auth、Expense Hub、勤怠管理（本番候補）、Management Platform、環境整備、NOVA Design System。

### Active Development

NOV Navi、Notification Engine、法人経営管理、タスク管理、Decision Hub、人財投資、NOV Talent、シフト管理、経理サポート、IDEA NOV EDU、社内問い合わせ、LINE WORKS連携。

### Redesign

店舗営業管理、現職者管理。既存資産を捨てる意味ではなく、system boundary、single writer、Core ID、認可契約を再設計する判定。

### Legacy / 重複

- `THANKS` は旧理念浸透/GASカードとしてLegacy候補。現行 `idea-link` と同時activeの監査証跡あり。
- GAS backendはHUB通常導線から退役済み方針。ただし履歴・一部アプリ導線は残存。
- Management Platformと「環境整備/マネジメントチェック」は同一実装または強い重複候補。

### Unknown / Planned

1on1、営業部Web、営業部⇔教育部DB、キャンペーン、EC・商品管理、棚卸し、Instagram自動投稿。HUBの静的定義はあるが、実repo・本番URL・運用証跡を確認できない。

## コードはあるが本番導線が不確実

- `portal/decision-hub/`: frontendと監査資料あり。live smokeは認証transport blockedの記録。
- `portal/education-app/`: 静的実装とreadonly API候補あり。DB `portal_apps.EDU` は旧GAS URLだった監査証跡。
- `portal/talent/`: 多数のtest、read/write API、migrationあり。ただしrole公開範囲と本番運用責任が未確定。
- `portal/concierge/`: UI/API実装あり。問い合わせ運用・notification契約は未確定。

## 本番運用中だがGitHub管理が不十分な可能性

勤怠、シフト、教育旧GAS、経理サポートは同一ワークスペースに成果物/別checkoutがあるが、今回の対象remoteだけでは正本repoと本番commitを一意に追跡できない。

詳細は `applications/` の個票を参照。

