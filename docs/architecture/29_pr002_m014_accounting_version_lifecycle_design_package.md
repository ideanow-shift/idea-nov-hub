# PR002 / M014 Accounting Version Lifecycle — Design Package

M014 implements only ACF-03. It adds immutable Scenario and Measure Type reference contracts plus the Accounting Version lifecycle skeleton. M015 Journal/Facts/Allocation, M016 Validation/Approval, M017 Publication and every Consumer projection remain excluded.

`actual`, `budget`, and `forecast` are distinct streams keyed by Canonical corporation, fiscal-year label, monthly half-open reporting period, scenario, and positive version sequence. Previous Year is not a scenario. `period_flow` maps only to P/L and `ending_balance` only to B/S. Cash Flow is not published by M014.

Every Version starts as `draft`. M014 permits only `draft -> validating`. `validating -> validated`, `validated -> approved`, and `approved -> published` are present in the structural vocabulary but fail closed until M016/M017 add their evidence tables and controlled transition contracts. Direct terminal-state INSERT is forbidden. Content and lineage never change; correction, Forecast refresh, Budget revision, adjustment, and reversal append a higher sequence with typed parent/reversal lineage.

The monthly period is `[period_start, period_end)` with day-one start and exactly one-month end. Fiscal year is an explicit governed label because the Canonical fiscal-calendar policy is not inferred from Production. Actual requires an eligible validated import batch; Budget and Forecast may be authored without one. Snapshot references are optional but FK-enforced.

All three tables use forced RLS, default deny, no Consumer grant, no Consumer View, no SECURITY DEFINER, no PII and no Production internal ID. M014 rollback removes only its four triggers, four functions and three tables without CASCADE.
