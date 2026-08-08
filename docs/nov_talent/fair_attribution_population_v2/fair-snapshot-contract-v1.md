# Fair Snapshot Hash Contract v1

The executor recomputes this snapshot inside the same database transaction immediately before population. Fair Master is held with a `SHARE` lock until commit.

- Contract: `fair-attribution-fair-snapshot-v1`
- Scope: all Fair Master rows, including active and inactive rows
- Order: ascending `fair_id`
- Per-row fields: `fair_id::text`, `event_date::text`, `is_active` encoded as exact `t` or `f`, `version::text`
- Row encoding: `concat_ws('|', ...)`
- Row separator: LF (`0x0a`)
- Empty set: empty UTF-8 string
- Digest: SHA-256, lowercase hexadecimal
- Fixed digest: `766ba161ce59d326599c641e9d8531b19482bfd25dfa1ff2714bde240a8beca3`
