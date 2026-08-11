# Recruiting Planning Contract 1.0.0

This is a forward-only planning layer. The merged Recruiting Target Contract 1.0.0 remains intact and is not rewritten or migrated.

## Responsibility

- Funnel Target: approved plan counts by `NEW_GRAD` or `MID_CAREER`, period and COMPANY scope.
- Actuals: only official facts. Application/offer/acceptance use unique Candidate reach in Selection History. Contact and salon-visit actuals remain `ACTUAL_SOURCE_UNAVAILABLE` until a separate official source gate passes.
- Budget: an approved versioned JPY ceiling, with optional canonical-channel allocations. A budget line never creates Fair, Candidate, attribution or channel-source facts.
- Channel: classification vocabulary only. `JOB_FAIR` does not replace Fair Master or CONFIRMED ORIGIN attribution.
- Salon Visit: `SALON_VISIT_PLANNED` and `SALON_VISIT_COMPLETED` are reserved Recruiting Journey/Engagement facts. They are not Selection History, are not implemented in this migration, and receive no inferred backfill.
- Initiative: contract-only reservation for name, channel, owner, period, status, budget reference and result reference. No table/API is created in Phase 1.

`EXPECTED_JOIN_COUNT` is reserved and non-operational. Historical labels such as 採用数 are never mapped without Human Review.

## API

Admin-only, HUB-session-authorized routes under `/api/talent/v1/recruiting-planning` provide current/draft/history reads and default-off draft/approve commands for funnel targets and budgets. Actor/role are resolved server-side. Browser direct table DML is prohibited.

Outcome 3 Contract 1.0.0 remains disconnected and keeps `targets.state=UNSET`.
