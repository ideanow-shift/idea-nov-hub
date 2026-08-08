# PR002 / M015 Journal / Accounting Fact / Allocation — Release Gate

Authoring passes only when M015 creates its six tables and no M016+ object, while every M001–M014/M061/M062 artifact remains byte-for-byte unchanged.

The Local PostgreSQL 17 Gate must prove:

- exact Forward order `M001–M011 → M061 → M012 → M013 → M062 → M014 → M015`;
- Journal and stable source-line duplicate rejection without amount-based identity;
- Actual validated Batch/Staging path, mandatory finite source amount, conditional source-tax/rate evidence, value-status-safe finite normalized amount, complete finite rounding mode/scope/unit/difference evidence, sealed terminal-Batch File/Line membership and Budget/Forecast planning separation;
- full-period Account/Measure and typed Core organization validation, including inactive/partial-period rejection and calculated-subtotal exclusion;
- one Fact per Line, finite monetary values, tax-exclusive/JPY/value-status/posting-side semantics, corporation-direct attribution and immutable UPDATE/DELETE;
- explicit observed/nonzero unallocated source (never NULL/zero), same-Version Actual allocation, Rule source/target scope matching, NULL/non-finite ratio rejection, allocation overage rejection, exact balanced total and exact rounding-evidence total;
- M013/M062/M014 regression;
- six forced-RLS tables, all 12 exact trigger bindings (nine new-table plus three import-membership seals), ten SECURITY INVOKER/empty-search-path functions, zero table/function grants, zero Consumer Views, zero SECURITY DEFINER and zero prohibited PII/Production columns;
- M015-only rollback preserving M014, full 17-step rollback leaving BDF objects zero, 17-step reapply and catalog equality;
- fixture residue zero, runtime/temp database cleanup and additional cost zero.

M015 proves structural Journal/Fact/Allocation integrity only. Journal aggregate balancing, reversal amount/account/scope negation, ratio-to-amount arithmetic, rule-specific allocation basis/remainder semantics, business validation and approval remain explicit M016 gates.

The two-session concurrency Gate is **NOT RUN** in the Local Fresh DB evidence and must not be reported as Local PASS. Before M015 can be declared Tier 2 Staging Complete, the hosted Gate must prove:

- two-session Batch terminalization versus concurrent File/Line mutation behavior;
- observable `SHARE`-lock wait and correct blocker identity;
- deadlock behavior is fail-closed, with no partial commit and the controlled writer handling retryable lock/deadlock outcomes;
- transaction rollback releases the lock and permits the next valid operation; and
- all concurrency fixtures roll back with zero persistent rows.

Commit/Push/Draft PR require a separate Owner decision after PASS. Staging Apply, M016, data load, Production, Store Operations, Finance, Consumer projection and deploy remain prohibited.
