# Staging Environment

## 発見結果

- 安全な専用staging URL: 未確認
- staging Firebase project: 未確認
- staging Supabase / Redis / KV: 未確認
- staging Secret: 未確認
- staging DNS / trusted certificate: 未確認
- 利用可能なもの: local synthetic fixture、file shared store、JSONL audit adapter

`portal/js/firebase-config.js`等はproduction endpointを指すため使用していません。外部契約、課金、DNS変更、deployは行っていません。

## 必要な手動準備

1. Ownerがproductionと別のproject/accountを指定。
2. `https://hub-canary.<staging-domain>`とapp専用originを用意。
3. trusted certificateとHTTP→HTTPS redirectを設定。
4. staging専用Redis/Supabase/KVとaudit sinkを割当。
5. staging Secret managerでkeyを生成し、production keyと分離。
6. synthetic user allowlistだけを登録。
7. Security/rollback ownerが実行windowを承認。
