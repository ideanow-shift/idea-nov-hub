# Phase 3 Owner / Sales UAT Record

Date prepared: 2026-09-21
Portfolio lock: `CTO-PORTFOLIO-EXECUTION-ORDER-2026-08-22-V4`
Phase: `PHASE_3_STORE_OPERATIONS_MANAGEMENT_V1`
Environment: Sales Department correction verification on Staging; Owner Production read-only UAT pending
Record status: `SALES_PASS_OWNER_PENDING`

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
| UAT-P3-01 | NOV HUB launch and direct route | Both routes open the same authenticated Production application without a second business-data login | NOT_RUN | PASS | Sales confirmed that the additional business-data login is no longer required. |
| UAT-P3-02 | Executive summary for 2026-06 and 2026-07 | Target month, profit confirmation month, tax basis, sales, and states are understandable | NOT_RUN | PASS | Sales screenshot confirms the corrected `利益（直営13店舗のみ）` meaning in all-store scope. Evidence contains no personal data. |
| UAT-P3-03 | Official portfolio population | Exactly 20 official stores; 13 direct and 7 other-operator scope | NOT_RUN | PASS | Sales confirmed the official population check. |
| UAT-P3-04 | Priority actions | No more than three actions and each explains why attention is needed | NOT_RUN | PASS | Sales confirmed the priority-action count and reasons. |
| UAT-P3-05 | Store list | Status, sales, customers, productivity, and focus text support prioritisation | NOT_RUN | PASS | Sales screenshot confirms that an unavailable canonical AM assignment displays `準備中`; no fallback AM is invented. |
| UAT-P3-06 | Store detail | Sales, customers, unit price, productivity, and available profit facts have the intended business meaning | NOT_RUN | PASS | Sales retest confirmed that total/technical unit price and total/technical productivity are distinguishable. The reviewed Staging values are explicitly fictional fixture values, not real business data. |
| UAT-P3-07 | Budget comparison | June and July budget ratios appear only where confirmed budget facts exist | NOT_RUN | PASS | Sales confirmed the budget comparison check. |
| UAT-P3-08 | Year-on-year, cumulative, and trend | Comparison periods are clear and missing values never appear as zero | NOT_RUN | PASS | Sales retest confirmed that monthly/cumulative labels and values, year-on-year comparison, and trend-period changes are distinguishable. |
| UAT-P3-09 | Profit state | June confirmed profit, July preparing state, and FC `V1対象外` remain distinct | PASS | PASS | Owner evidence: `phase3-owner-uat-profit-state-evidence-20260921.md`; Sales repeated the check. |
| UAT-P3-10 | Pending KPI state | Repeat rate and retail purchase rate display `準備中` where formal sources are absent | NOT_RUN | PASS | Sales confirmed pending KPIs remain explicit states. |
| UAT-P3-11 | Scope and access | URL and selector changes do not expand the approved business scope | NOT_RUN | PASS | Sales confirmed visible controls did not expand scope. |
| UAT-P3-12 | Mobile usability | Dashboard, list, and detail are readable and operable on the normal mobile device | NOT_RUN | PASS | Sales retest confirmed normal mobile readability, operation, and in-page return behavior. |
| UAT-P3-13 | Decision usefulness | Available V1 metrics identify stores to review without a separate spreadsheet | NOT_RUN | PASS | Sales retest confirmed that up to three review targets and concrete next-check guidance can be identified without a separate spreadsheet. |

## Acceptance

| Approval | Result | Date | Evidence reference |
| --- | --- | --- | --- |
| Owner | `PENDING_REMAINING_CASES` | 2026-09-21 | UAT-P3-09 Owner result recorded |
| Sales Department | `PASS` | 2026-09-21 | Sales results for UAT-P3-01 through UAT-P3-13 are all `PASS` |
| Blocking defects | `0_RECORDED` | 2026-09-21 | Sales correction retest is complete; remaining incomplete cases are Owner results, not open Sales defects |

Final UAT status: `PENDING`

The final status may become `PASS` only when all 13 cases pass for both parties,
blocking defects are zero, and both acceptance rows are complete. Actual use in a
monthly meeting is a separate Phase 3 Exit Criterion and is not closed by this
record.
