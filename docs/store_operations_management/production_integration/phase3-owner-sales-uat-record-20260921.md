# Phase 3 Owner / Sales UAT Record

Date prepared: 2026-09-21
Portfolio lock: `CTO-PORTFOLIO-EXECUTION-ORDER-2026-08-22-V4`
Phase: `PHASE_3_STORE_OPERATIONS_MANAGEMENT_V1`
Environment: Owner correction verification on Staging; separate Sales Department review waived by Owner
Record status: `OWNER_PASS_SALES_WAIVER_PENDING_PRIORITY_CHANGE`

## Boundary

- UAT is read-only. It does not authorize Production DDL, DML, deployment, or
  business-data mutation.
- Under the active Portfolio Lock, a case satisfies the locked Exit Criterion
  only after both Owner and Sales Department results are recorded. The Owner has
  waived a separate Sales Department review, so no review request is sent; formal
  removal of the locked requirement remains pending a Priority Change.
- Do not record employee IDs, store UUIDs, credentials, tokens, or personal data.
- Repeat rate and retail purchase rate remain `準備中` while their formal
  sources are pending. A substituted value, inferred value, or zero is a failure.
- Execute the checks using
  `phase3-owner-sales-uat-execution-guide-20260921.md`.

## Owner disposition on Sales Department review

On 2026-09-21, the Owner explicitly directed that a separate Sales Department
review is not required. No Sales Department review request should be sent while
this disposition remains current.

The active Portfolio Lock still lists `Owner／営業部UAT PASS` as a Phase 3 Exit
Criterion. Therefore this disposition is recorded but does not alter the locked
Exit Criterion by itself. Removing the Sales Department requirement becomes
effective only after a dedicated `[OWNER PRIORITY CHANGE]` PR updates the
Portfolio Lock and is merged.

## Business UAT matrix

Record `PASS`, `FAIL`, or `NOT_RUN` in each result column.

| ID | Business check | Expected result | Owner result | Sales result | Evidence / non-PII note |
| --- | --- | --- | --- | --- | --- |
| UAT-P3-01 | NOV HUB launch and direct route | Both routes open the same authenticated Production application without a second business-data login | PASS | NOT_RUN | Owner confirmed that the additional business-data login is no longer required. Sales Department has not run this case. |
| UAT-P3-02 | Executive summary for 2026-06 and 2026-07 | Target month, profit confirmation month, tax basis, sales, and states are understandable | PASS | NOT_RUN | Owner screenshot confirms the corrected `利益（直営13店舗のみ）` meaning in all-store scope. Evidence contains no personal data. |
| UAT-P3-03 | Official portfolio population | Exactly 20 official stores; 13 direct and 7 other-operator scope | PASS | NOT_RUN | Owner confirmed the official population check. Sales Department has not run this case. |
| UAT-P3-04 | Priority actions | No more than three actions and each explains why attention is needed | PASS | NOT_RUN | Owner confirmed the priority-action count and reasons. Sales Department has not run this case. |
| UAT-P3-05 | Store list | Status, sales, customers, productivity, and focus text support prioritisation | PASS | NOT_RUN | Owner screenshot confirms that an unavailable canonical AM assignment displays `準備中`; no fallback AM is invented. |
| UAT-P3-06 | Store detail | Sales, customers, unit price, productivity, and available profit facts have the intended business meaning | PASS | NOT_RUN | Owner retest confirmed that total/technical unit price and total/technical productivity are distinguishable. The reviewed Staging values are explicitly fictional fixture values, not real business data. |
| UAT-P3-07 | Budget comparison | June and July budget ratios appear only where confirmed budget facts exist | PASS | NOT_RUN | Owner confirmed the budget comparison check. Sales Department has not run this case. |
| UAT-P3-08 | Year-on-year, cumulative, and trend | Comparison periods are clear and missing values never appear as zero | PASS | NOT_RUN | Owner retest confirmed that monthly/cumulative labels and values, year-on-year comparison, and trend-period changes are distinguishable. |
| UAT-P3-09 | Profit state | June confirmed profit, July preparing state, and FC `V1対象外` remain distinct | PASS | NOT_RUN | Owner evidence: `phase3-owner-uat-profit-state-evidence-20260921.md`; Sales Department has not run this case. |
| UAT-P3-10 | Pending KPI state | Repeat rate and retail purchase rate display `準備中` where formal sources are absent | PASS | NOT_RUN | Owner confirmed pending KPIs remain explicit states. Sales Department has not run this case. |
| UAT-P3-11 | Scope and access | URL and selector changes do not expand the approved business scope | PASS | NOT_RUN | Owner confirmed visible controls did not expand scope. Sales Department has not run this case. |
| UAT-P3-12 | Mobile usability | Dashboard, list, and detail are readable and operable on the normal mobile device | PASS | NOT_RUN | Owner retest confirmed normal mobile readability, operation, and in-page return behavior. |
| UAT-P3-13 | Decision usefulness | Available V1 metrics identify stores to review without a separate spreadsheet | PASS | NOT_RUN | Owner retest confirmed that up to three review targets and concrete next-check guidance can be identified without a separate spreadsheet. |

## Acceptance

| Approval | Result | Date | Evidence reference |
| --- | --- | --- | --- |
| Owner | `PASS` | 2026-09-21 | Owner results for UAT-P3-01 through UAT-P3-13 are all `PASS` |
| Sales Department | `NOT_REQUIRED_BY_OWNER_PENDING_PRIORITY_CHANGE` | 2026-09-21 | Owner directed that separate Sales Department confirmation is unnecessary; the locked Exit Criterion is unchanged until a dedicated Priority Change PR is merged |
| Blocking defects | `0_RECORDED` | 2026-09-21 | Owner correction verification is complete; the remaining gate is governance alignment, not an application defect |

Final UAT status: `PENDING_PRIORITY_CHANGE`

The Owner acceptance is complete with all 13 cases at `PASS` and zero recorded
blocking defects. No Sales Department review request is required by the Owner.
The record remains `PENDING_PRIORITY_CHANGE`, rather than Phase 3 `PASS`, until a
dedicated `[OWNER PRIORITY CHANGE]` PR removes or replaces the locked Sales
Department UAT requirement and is merged. Actual use in a monthly meeting is a
separate Phase 3 Exit Criterion and is not closed by this record.
