# Phase 3 Owner / Sales UAT Record

Date prepared: 2026-09-21
Portfolio lock: `CTO-PORTFOLIO-EXECUTION-ORDER-2026-08-22-V4`
Phase: `PHASE_3_STORE_OPERATIONS_MANAGEMENT_V1`
Environment: Production read-only Store Operations application
Record status: `IN_PROGRESS`

## Boundary

- UAT is read-only. It does not authorize Production DDL, DML, deployment, or
  business-data mutation.
- A case is complete only after both Owner and Sales Department results are
  recorded.
- Do not record employee IDs, store UUIDs, credentials, tokens, or personal data.
- Repeat rate and retail purchase rate remain `準備中` while their formal
  sources are pending. A substituted value, inferred value, or zero is a failure.
- Execute the checks using
  `phase3-owner-sales-uat-execution-guide-20260921.md`.

## Business UAT matrix

Record `PASS`, `FAIL`, or `NOT_RUN` in each result column.

| ID | Business check | Expected result | Owner result | Sales result | Evidence / non-PII note |
| --- | --- | --- | --- | --- | --- |
| UAT-P3-01 | NOV HUB launch and direct route | Both routes open the same authenticated Production application without a second business-data login | NOT_RUN | NOT_RUN | |
| UAT-P3-02 | Executive summary for 2026-06 and 2026-07 | Target month, profit confirmation month, tax basis, sales, and states are understandable | NOT_RUN | NOT_RUN | |
| UAT-P3-03 | Official portfolio population | Exactly 20 official stores; 13 direct and 7 other-operator scope | NOT_RUN | NOT_RUN | |
| UAT-P3-04 | Priority actions | No more than three actions and each explains why attention is needed | NOT_RUN | NOT_RUN | |
| UAT-P3-05 | Store list | Status, sales, customers, productivity, and focus text support prioritisation | NOT_RUN | NOT_RUN | |
| UAT-P3-06 | Store detail | Sales, customers, unit price, productivity, and available profit facts have the intended business meaning | NOT_RUN | NOT_RUN | |
| UAT-P3-07 | Budget comparison | June and July budget ratios appear only where confirmed budget facts exist | NOT_RUN | NOT_RUN | |
| UAT-P3-08 | Year-on-year, cumulative, and trend | Comparison periods are clear and missing values never appear as zero | NOT_RUN | NOT_RUN | |
| UAT-P3-09 | Profit state | June confirmed profit, July preparing state, and FC `V1対象外` remain distinct | PASS | NOT_RUN | Owner evidence: `phase3-owner-uat-profit-state-evidence-20260921.md` |
| UAT-P3-10 | Pending KPI state | Repeat rate and retail purchase rate display `準備中` where formal sources are absent | NOT_RUN | NOT_RUN | |
| UAT-P3-11 | Scope and access | URL and selector changes do not expand the approved business scope | NOT_RUN | NOT_RUN | |
| UAT-P3-12 | Mobile usability | Dashboard, list, and detail are readable and operable on the normal mobile device | NOT_RUN | NOT_RUN | |
| UAT-P3-13 | Decision usefulness | Available V1 metrics identify stores to review without a separate spreadsheet | NOT_RUN | NOT_RUN | |

## Acceptance

| Approval | Result | Date | Evidence reference |
| --- | --- | --- | --- |
| Owner | `PENDING_REMAINING_CASES` | 2026-09-21 | UAT-P3-09 Owner result recorded |
| Sales Department | `PENDING` | | |
| Blocking defects | `NOT_EVALUATED` | | Count only; no PII |

Final UAT status: `PENDING`

The final status may become `PASS` only when all 13 cases pass for both parties,
blocking defects are zero, and both acceptance rows are complete. Actual use in a
monthly meeting is a separate Phase 3 Exit Criterion and is not closed by this
record.
