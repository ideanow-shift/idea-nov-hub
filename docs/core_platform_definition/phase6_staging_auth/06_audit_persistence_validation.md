# Audit Persistence Validation

staging用JSONL adapterはallowlist masking、append-only event、previous hashを使うhash chainを実装する。

| Event / behavior | Result |
|---|---|
| allow / deny | Pass |
| replay / invalid token | Pass |
| actor mismatch / scope violation | Pass |
| service / terminal action | Pass |
| request_id / correlation_id | Pass |
| Firebase UID / session masking | Pass: SHA-256 |
| arbitrary Secret/氏名非転記 | Pass |
| tampering detection | Pass |
| ordinary read audit failure | degraded result |
| privileged/high-sensitivity audit failure | Pass: `audit_unavailable`, fail closed |

これはlocal persistenceの実証であり、本番retention、access role、WORM/remote sink、availability、backpressure、PII分類、監視alertは未実装。
