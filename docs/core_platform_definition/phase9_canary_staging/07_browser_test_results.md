# Browser Test Results

## 結果

正式staging browser testは**未実施**です。正常証明書付き専用originが存在しないため、HTTP/HTTPS、Cookie jar、history、referrer、preflight、multiple tab、browser close、mobile/PCを本番相当条件で証明できません。

## 実行予定matrix

- Chromium desktop / mobile emulation
- WebKit desktop / mobile
- HTTPS certificate validation、mixed content、redirect
- Cookie attributesと`document.cookie`不可視
- URL/history/referrer/localStorage非残存
- app A / app B origin separation
- logout/revoke/rotation、multiple tab、browser restart
- valid/invalid/no Origin、CSRF、OPTIONS preflight

自己署名証明書での成功を正常証明書Gateとして扱いません。
