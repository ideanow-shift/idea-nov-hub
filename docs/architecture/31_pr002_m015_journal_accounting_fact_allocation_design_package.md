# PR002 / M015 Journal / Accounting Fact / Allocation Layer — Design Package

M015 implements only ACF-04 after `M013 → M062 → M014`. It creates the immutable Journal boundary, one tax-exclusive Canonical Accounting Fact for each Journal Line, and a separate allocation result layer. M016 Validation/Approval/Audit, M017 Publication, M018 Consumer projections, Cash Flow Facts, data load and every downstream application connection remain excluded.

## Physical responsibilities

| Table | Responsibility |
|---|---|
| `accounting.journal_entries` | immutable posting envelope, Accounting Version, source-entry digest, period and adjustment/reversal lineage |
| `accounting.journal_lines` | immutable source posting identity, stable idempotency tuple, Account/Core mapping pins and normalization evidence |
| `accounting.accounting_facts` | exactly one Canonical tax-exclusive Fact per Journal Line |
| `accounting.allocation_rule_versions` | immutable effective-dated candidate rule/evidence version |
| `accounting.allocation_sets` | source Fact, derived Version and structural reconciliation lifecycle |
| `accounting.accounting_allocations` | append-only allocated/unallocated destination lines |

`journal_lines` is source posting and mapping evidence; it does not store Canonical monetary truth. `accounting_facts` is one-to-one through a UNIQUE `journal_line_id`, so Journal and Fact do not become competing Business Data authorities.

## Grain and lineage

The Fact grain is Accounting Version × Journal Entry/Line × Account × typed Organization Scope × monthly period × Measure Type. Scenario is stored only on `accounting_versions` and is derived from that immutable parent, preventing a contradictory Fact scenario. The source idempotency identity never uses amount: imported lines use source system/batch/file/record digest/line/version/account/measure; planning lines use the same deterministic identity without pretending a batch exists.

Actual can enter only through a validated M012 Batch and a `valid` Staging Line whose normalization and mapping passed, whose Canonical tax basis is `exclusive`, and whose normalized amount is finite. M015 additively seals Batch membership: finalizing a Batch serializes against File/Line membership writes, and a validated/rejected/future-terminal Batch rejects File/Line INSERT, UPDATE, DELETE, and movement from or into the sealed Batch. This closes late-line promotion without changing M012 history. Budget/Forecast may use a nonblank versioned planning contract; an imported plan still follows M012. Raw identifiers, raw payload, Production IDs and PII are prohibited.

## Account, period and Organization Scope

Facts pin the M013 Account version indirectly through their Journal Line. The pinned Account must be active for the complete monthly half-open Version period, be a posting Account, and satisfy P/L→`period_flow` or B/S→`ending_balance`. Cash Flow support, memo and non-statement Accounts are rejected.

`gross_profit` and `operating_profit` are calculated mapping nodes and cannot receive manual Canonical Facts. They remain reporting formulas, not posting Accounts at the Fact boundary.

Every Journal Line pins exact immutable Corporation and optional Store/Department versions. Store scope also pins an `accounting` corporation-store relationship. Corporation, Store, Department, relationship and Account versions must cover the full Accounting Version period. Scope is exactly one of corporation/store/department; free text and unknown fallback stores are impossible.

## NULL, zero and tax

Canonical amounts use finite `numeric(20,4)`, currency `JPY` and `tax_basis='exclusive'`. `NaN` and positive/negative infinity are rejected from Fact and allocation monetary fields. `observed` requires non-NULL/nonzero, `zero` requires exactly zero, and `not_applicable` requires NULL. Missing, pending and validation-failed candidates remain in M012 quarantine and cannot become Facts. No numeric column has a semantic default of zero.

Corporation, Store and Department Facts may be `directly_attributed`; a corporation Fact is not automatically unallocated. Only an explicit corporation-scope, observed, nonzero `unallocated` status is allocable. A formal zero remains directly attributed and never masquerades as work awaiting allocation. This keeps HQ/corporation direct Facts distinct from unresolved allocation work.

## Adjustment, reversal and immutability

Every row is inserted only while its Accounting Version is `draft`. Journal adjustment/reversal types must agree with M014 Version lineage; a reversal points to a Journal Entry in the exact `reverses_version_id`. Direct UPDATE/DELETE of Entries, Lines, Facts, rules and allocation results is rejected. M015 does not unlock `validated`, `approved` or `published`; correction remains new Adjustment/Reversal/Version data.

## Allocation

Original Facts are never overwritten. Only an explicit corporation-scope `unallocated` Fact can start an allocation set. The allocation Version is either the same draft Version (required for Actual without inventing another Import Batch) or a higher-sequence, same-corporation/scenario/period direct child. Allocation results are either typed Store/Department `allocated` rows or one explicit corporation-scope `unallocated` remainder.

The selected Rule must match the source Fact scope, and each allocated child must match the Rule target scope. Child insertion locks the allocation set and source Fact key, rejects sign reversal and over-allocation, and pins target Core versions for the full period. `draft → balanced` is structural reconciliation only: at least one result, exact amount equality, ratio total not above one, at most one unallocated row and exact rounding-evidence total are required. M016 still owns ratio-to-amount arithmetic, rule-specific basis/remainder semantics, journal aggregate balancing, reversal amount/account/scope negation, business validation, approval and any activation/publication decision.

## Security and rollback

All six tables have enabled and forced RLS, no policy, no direct grant to PUBLIC/anon/authenticated/service_role, no Consumer View and no SECURITY DEFINER. Functions are SECURITY INVOKER with an empty search path and direct EXECUTE revoked. Every FK has a usable leading-column index, including exact immutable Account/Core version pins. Catalog validation fixes nine bindings on the six new tables plus three M015 membership-seal bindings on M012 tables. M015 rollback removes those three additive triggers and their function before dropping only M015 tables/functions in dependency order, without CASCADE; M012, M014 and all earlier history remain.
