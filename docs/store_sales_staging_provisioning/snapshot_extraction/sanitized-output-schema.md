# Sanitized Output Schema

The output is aggregate-only. Permitted columns are fixed per query in the runner field allowlist.

| Projection | Permitted fields |
| --- | --- |
| Store Master | opaque canonical store ID, store code, display name, Direct/FC, active, operator code, updated timestamp |
| Confirmed accounting | opaque canonical store ID, period, confirmed-through period, revenue, operating profit, margin, tax basis, confirmation, availability, updated timestamp |
| Customer / unit-price / product / EC | opaque canonical store ID, period, approved aggregate numeric fields, availability, updated timestamp |
| AM | store code, `assigned`/`unassigned`, opaque Scope reference, updated timestamp |
| Legacy crosswalk | opaque legacy reference, opaque canonical reference, crosswalk version, updated timestamp |

The runner rejects keys that indicate personal data, credentials, authentication, internal connection details, UUIDs, raw customer or employee fields, journal data, or nested/free-form objects. It has no transform that strips a leaked field and continues; the complete artifact is rejected.
