# Recruiting Actual Fact Foundation 1.0.0

Source-only candidate. It is not an authorization to apply the migration, backfill rows, or expose runtime Actuals.

## Planning binding

All Actuals bind to `recruiting_track + graduation_year + recruiting_period_start + recruiting_period_end`. The 2027 NEW_GRAD baseline is `2026-04-01` through `2027-03-31`, with plans `563 / 112 / 45 / 37 / 37` and `7,385,350 JPY`.

## Engagement facts

`CONTACT` and `SALON_VISIT` are candidate-bound, append-only facts. Contact Actual is distinct Candidate over effective `COMPLETED` facts. Salon Visit Actual is distinct Candidate over effective `COMPLETED` facts with a canonical store. Event count is diagnostic only. A later correction/cancellation references exactly one prior fact; the prior row is never updated or deleted.

## Selection coverage

Selection History remains the official stage evidence. `APPLICATION_RECEIVED`, `OFFERED`, and `OFFER_ACCEPTED` are counted independently; no earlier stage is inferred. A zero is official only when a matching human-approved coverage release is `COMPLETE`. Schema availability alone is insufficient.

## Recruiting spend

Spend is append-only and separates `PROVISIONAL`, `CONFIRMED`, and `VOIDED`. Only effective `CONFIRMED` JPY facts are official Actual Spend. Provisional department values are reference values and never participate in remaining budget or achievement.

## Runtime states

- `READY`: canonical source and operational completeness are confirmed.
- `PARTIAL_SOURCE`: trustworthy partial facts exist; `actual` remains null and only `referenceValue` may be returned.
- `ACTUAL_SOURCE_UNAVAILABLE`: the canonical foundation or completeness release is absent.
- `PREPARING`: an established source failed at read time.

Contract 1.2.0 adds `actualState`, `actualGrain`, `referenceValue`, `eventCount`, and coverage state to Planning comparison metrics. Priority, Candidate, Selection, Fair, and Planning contracts do not change.

## Backfill classification

- A: dated source evidence, canonical Candidate binding, complete actor/source lineage — Human Review candidate only.
- B: values requiring stage, actor, store, channel, or date inference — prohibited.
- C: missing evidence or accounting confirmation — remains unavailable.

The observed 11 Contact and 4 Salon Visit legacy events are not automatically eligible because actor/store/lifecycle completeness is missing. Existing Selection rows require a COMPLETE coverage release. Fair fee and spreadsheet values are not confirmed Spend.
