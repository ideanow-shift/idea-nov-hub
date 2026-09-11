# Concurrency Test Results

| Scenario | Load | Expected | Result |
|---|---:|---|---|
| one-time code | 100 concurrent | 1 consume | Pass: 1/99 |
| same code multiprocess | 12 processes | 1 consume | Pass: 1/11 |
| same jti replay | 100 concurrent | 1 verify | Pass: 1/99 |
| session renewal | 100 concurrent | consistent session | Pass |
| revoke vs renew | 2 racing operations | final revoked | Pass |
| duplicate write | 100 concurrent | 1 allow | Pass: 1/99 |
| audit write failure | privileged operation | fail closed | Pass |
| adapter timeout | delayed repository | deny | Pass |
| key rotation | old/new overlap | grace only | Pass |
| old key expiry | after grace | deny | Pass |
| app audience mismatch | foreign app | deny | Pass |

ローカルprocess schedulerと共有filesystemでの結果であり、network partition、複数host、clock drift、store failover、10k loadは未検証。
