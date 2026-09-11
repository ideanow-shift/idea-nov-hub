# Remaining Blockers

- HTTPS上のHttpOnly / Secure / SameSite Cookie実browser検証。
- Origin、CSRF token、cross-origin redirect/POST bridgeの実middleware検証。
- Redis等を用いた複数processのatomic consume、replay、revoke。
- staging Core Read Adapterによる現行HUB sessionからのactor再解決。
- 永続・mask済み・tamper-evident auditとwrite failure。
- session issuance failure時の実HTTP fallback。
- staging route、Cookie host、redirect allowlistの正式値。
- feature flag、incident、audit、rollback owner。
- production deploy reviewとsecurity review。

これらは本番有効化のBlockerです。Phase 8 source-only canaryの完了を妨げません。
