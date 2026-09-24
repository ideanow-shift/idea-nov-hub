# Security Test Results

## Aggregate

- Phase 5 regression: 40/40
- Phase 6 Node: 21/21
- Browser: 11 pass / 0 fail / 3 unverified

## Added negative tests

| Test | Result |
|---|---|
| unknown kid | Pass |
| wrong algorithm / confusion | Pass |
| public/private misuse | Pass |
| code race | Pass |
| cookie theft simulation across app | Pass: denied |
| CSRF / wrong Origin | Pass: denied |
| Referer leak | Pass: none |
| localStorage token residue | Pass: none |
| audit tampering | Pass: detected |
| stale permission cache | Pass: denied |
| revoked role | Pass |
| revoked store assignment | Pass |
| terminal→employee escalation | Pass: denied |
| service→user escalation | Pass: denied |

Phase 5のactor/store差替え、scope、corporation、role、record state、identity status等40件も全件維持した。
