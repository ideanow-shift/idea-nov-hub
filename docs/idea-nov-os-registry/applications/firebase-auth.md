# Firebase Auth

- 目的/利用者: 共通本人認証。全社員・全Webアプリ。
- 判定: **Production / 85% / 本番運用あり**
- repo/config: `portal/js/firebase-config.js`; Firebase project consoleは未確認。
- 技術/方式: Google login + Firebase ID token。HUBはemail/PIN補助導線も持つ。
- DB/Core: firebase_uid/emailをemployeeへ対応。
- 依存: HUB/Edgeが依存。FirebaseはCore DB mappingに依存。
- 完成: HUB login、Edge health config、Google認証。
- 未完成: UID/email重複・退職者・revocation/audienceのlive audit。
- セキュリティ: email fallback、authorized domains、token storage、PIN併存。
- 推奨: 維持・境界強化。
- 根拠: `portal/js/auth.js`, `portal/js/firebase-config.js`, `docs/core_platform_definition/02_authentication_boundary.md`
- 最終確認: provider設定、UID件数、MFA方針、owner。

