# PR002 M018 Accounting Consumer Projection Design Package

## 1. Decision

M018 is ACF-07: one shared, read-only Accounting Consumer contract over the current M017 Publication. It adds six `security_invoker` Views and one internal `security invoker` SQL resolver. It adds no table, writer, policy, API, UI, data load, Production binding, or lock.

Release order is M017 -> M018 -> M019. M001-M017, M061-M063 remain immutable.

## 2. Source of truth

A projected row exists only when all of these are true:

- `publication_releases.release_status = published`;
- the pinned `publication_member` matches corporation, monthly period, scenario and content hash;
- the pinned Accounting Version is currently `published`;
- the Fact belongs to the same Version, corporation and period;
- tax basis is `exclusive`;
- the exact M013 Account Version and Statement Mapping are active for the period;
- P/L uses `period_flow`; B/S uses `ending_balance`.

Draft, validating, validated, approved, rejected and superseded Versions are absent. Historical Publication remains in M017 tables, not in the normal M018 current Views.

## 3. Frozen inventory

- `projection.accounting_publication_status_v1`
- `projection.accounting_corporation_pl_v1`
- `projection.accounting_corporation_bs_v1`
- `projection.accounting_store_profit_v1`
- `projection.accounting_corporation_comparison_v1`
- `projection.accounting_cash_flow_v1` (always empty until a separate Cash Flow evidence gate)
- `projection.m018_current_published_lines()` (internal resolver)

No Consumer table, materialized view or mutable cache is introduced.

## 4. Grain and scope

The statement line grain is Publication x Accounting Version x corporation x optional store/department x monthly period x scenario x Account Version x M013 statement line x measure type. Scenario comes from the pinned Accounting Version. Store and department are never mixed. Corporation-level unallocated amounts remain explicit and are never assigned to an arbitrary Store.

When a source Fact has a balanced Allocation Set in the published Version, the original unallocated source Fact is omitted and the balanced Allocation rows replace it. Draft Allocation Sets do not replace the source. This keeps the immutable source Fact while preventing Consumer double counting.

## 5. Statement and amount contract

M013 supplies statement type, section, line, ordering, mapping version and contribution sign. M018 does not invent a new Account classification or reporting formula. The published amount is `Fact/Allocation amount * contribution_sign`.

`NULL` stays `NULL`; formal zero stays `0`. There is no `COALESCE`. `value_status=not_applicable` remains distinguishable from `value_status=zero`.

P/L sections are revenue, cost of sales, gross profit, personnel cost, operating expense and operating profit when represented by the approved M013 mapping. B/S sections are current asset, noncurrent asset, current liability, noncurrent liability and equity. Cash Flow generation is absent.

## 6. Comparison and Previous Year

Previous Year is not a Scenario. The comparison View resolves the M017 active Comparison Rule to another current published stream. Missing prior publication produces `coverage_status=unavailable`, never a numeric zero.

## 7. Evidence boundary

Consumer rows expose Publication/Version identity, period, scenario, published timestamp, tax basis, value/coverage/publication status and statement classification. Raw import keys, digests, validation details, Approval details, Audit actors/reasons, PII and Production internal IDs are excluded.

## 8. Access and security

All Views use `security_invoker=true` and `security_barrier=true`. PUBLIC, anon, authenticated and service_role receive no M018 View or function privilege and retain zero raw Accounting grants. This is intentional authoring-time default deny: M019 owns the final reviewed runtime Consumer-role binding. No `SECURITY DEFINER` is introduced.

Store Operations and Finance must consume this common contract after M019 binding; neither gets a separate calculation or raw Accounting path.

## 9. Performance

M018 reuses the M017 current-stream index, M015 `(accounting_version_id, accounting_period, measure_type)` Fact index, exact Journal Line keys, M015 Allocation indexes, and M013 Account/Mapping version keys. No new low-selectivity or duplicate index is added. Monthly, scenario, statement and Store predicates are applied before Consumer aggregation.

## 10. Validation and negative contract

Validation fixes the exact six Views, invoker/barrier options, resolver body, default-deny grants, no SECURITY DEFINER, no raw/PII/evidence columns, and disabled Cash Flow. DB tests prove current-only selection, superseded/unpublished exclusion, NULL/0 separation, P/L measure/scope, read-only Views, raw Fact denial, unauthorized Consumer denial and no Publication/no Projection.

## 11. Rollback

M018-only rollback drops the six Views in dependency order and then the resolver. CASCADE is not used. M017 and every earlier object remain unchanged.

## 12. Explicit exclusions

M018 does not add Store Operations or Finance UI/API, Executive Summary, AI, Cash Flow generation, data load, Production access, Consumer writes, M019 release hardening, or a new concurrency mechanism.
