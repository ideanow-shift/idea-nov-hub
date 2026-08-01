# Human Approval Board

All ten items must be approved before a real extraction window opens.

| ID | Approval required |
| --- | --- |
| A01 | verified Production project identity fingerprint and non-Production target identity |
| A02 | temporary least-privilege read-only role, no inheritance or bypass-RLS capability |
| A03 | exact approved source and query definition for Q01, Q02, and Q08 |
| A04 | source approvals or explicit unavailable state for Q03-Q07 |
| A05 | field allowlist and personal-data exclusion rules |
| A06 | one execution window, executor, query cap, timeout, retry 0, and rollback proof |
| A07 | credential creation, expiry, rotation, revocation, and no-log controls |
| A08 | manifest/version/hash/expiry requirements and evidence retention |
| A09 | Sandbox receipt authority and active-version approval |
| A10 | rollback owner and disabled-state procedure |

No approval record may contain a credential, raw endpoint, raw UUID, or production data value.
