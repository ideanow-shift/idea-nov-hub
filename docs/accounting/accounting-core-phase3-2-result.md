# Accounting Core Phase 3-2 result

## Decision

**Conditional Go** for the isolated prototype. **No-Go** for production
migration or actual publication.

The prototype proves immutable versioning, two-stage approval, explicit
publication, supersede, rollback restore, server-resolved actor scope,
published-only consumer projection and provenance. It does not approve the real
workbook data.

## Verification

- Automated tests: 23 passed, 0 failed.
- Real workbook: 76 sheets, 38 entity candidates, 111,741 raw values and
  111,741 canonical candidates.
- Real publishable facts: 0.
- Real validation: 42 warnings and 194 blocking results.
- Blocking codes: entity mapping not approved, account mapping not approved,
  and period not confirmed.
- PDF reconciliation: blocked because the required PDFs were not provided;
  input/output contract and a tested comparison tool are available.

No production database, Supabase project, Storage, NOV HUB or IDEA LINK was
accessed. The PostgreSQL/Supabase SQL is review-only and ends with `ROLLBACK`.

## Remaining decisions

- approve the 38 entity mappings and applicable Core UUIDs;
- approve account mappings and labor/rent/material/EC aggregation definitions;
- confirm the June/July duplicate-period cause and authoritative target month;
- review Core master and existing `finance_*` DDL;
- approve tax category/rate/rounding rules;
- provide private PDFs for three stores and two or more months;
- security and database owners must review the proposed DDL/RLS and separation
  of duties before any sandbox PostgreSQL application.
