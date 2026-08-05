# Core Master Catalog Attestation Approval Pack

## Decision required

Approve exactly one execution of pack `core-master-catalog-attestation-v1`, Query IDs `C01` through `C10`, in an agreed 60-second window. This approval does not authorize a follow-on store classification query, a data export, or any data mutation.

| Control | Required approval | Recommended value |
| --- | --- | --- |
| Production identity | private profile all signals match | mismatch means query count zero |
| Audit login | DB owner attests actual role properties | `idea_nov_prod_audit`, 1 connection, expiry set privately |
| Broker | security owner attests sealed release hash | credential never reaches shell, Git, chat, or logs |
| Query pack | Core DB owner approves C01-C10 | no replacement SQL or parameters |
| Limit | OS owner approves one run | max 10 queries, each once, retry zero |
| Timeout | DB owner approves | statement 5s, lock 1s, idle transaction 10s, whole run 60s |
| Receipt | audit owner approves repository-independent restricted storage | sanitized result, run ID, hashes, rollback/close result only |

## Query review

See [fixed-query-catalog.md](fixed-query-catalog.md) for every Query ID, purpose, result shape, and stop condition. C01-C09 return metadata or aggregates; C10 verifies `transaction_read_only`. Every unapproved Query ID is rejected before connection open.

## Failure rules

Stop with query count zero for identity, request, or audit-role failure. Stop, rollback, close, and retain no result artifact for read-only guard failure, sanitization failure, timeout, or query failure. There is no automatic retry. A failed run needs a fresh human approval.

## Approval record

Record the private profile version and runner hash, not their raw values. Record approver identities, approved Query IDs, execution window, expiry confirmation, receipt location, and credential revocation owner. Do not record connection strings, passwords, personal data, UUIDs, raw database errors, or raw query results.
