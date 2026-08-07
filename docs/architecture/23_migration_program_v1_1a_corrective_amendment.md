# Migration Program v1.1a — M061 Corrective Amendment

M001–M011 remain immutable implementation history. M012–M019 remain the approved PR002 Accounting allocation. M020–M060 remain reserved for PR003–PR024. Because every integer through M060 is occupied or reserved, the Snapshot Metadata corrective migration is allocated the next collision-free number, M061.

M061 is an out-of-band corrective migration, not a renumbering of the 24-PR program. The physical migration control total becomes 61; Program PR count remains 24. No existing migration number, responsibility or reservation changes.

Dependency and release order for environments where M012 is not yet applied is:

`M011 -> M061 -> M012`

On a full repository rebuild, the timestamped migration ledger may apply the already-merged M012 before M061. M061 has no Accounting dependency and remains additive, so the final catalog is equivalent. Nevertheless, idea-nov-staging must apply M061 before M012 under the explicit release gate.

Rollback order for the corrective unit is M061 rollback only. It neither invokes nor modifies the M011 or M012 rollback packages.
