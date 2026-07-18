# HUB Master Data Intake S2b write-contract gap result 2026-07-18

## Static audit result

```yaml
result: WRITE_CONTRACT_PRODUCT_DECISION_REQUIRED
target_count: 3
gap_count: 3
corporation_create_ready: false
store_create_ready: false
employee_affiliation_resolution_ready: false
production_access_count: 0
mutation_count: 0
```

## Confirmed gaps

### Corporation create

`public.corporations.corporation_code` is non-null and has no default. The current corporation CSV contract does not include a corporation-code header. A new corporation cannot be created without inventing a value.

### Store create

`public.stores.store_no` is non-null and has no default. The current CSV contract lists store number as optional, so a create row may pass frontend preview but cannot satisfy the database contract.

### Employee affiliation

The current employee CSV exposes one combined `所属` field. The employee master has separate corporation, department, store, position, and job-type references. A display label cannot be converted to those IDs without an exact typed input contract and ambiguity handling.

## Recommended Phase 1 contract correction

1. Corporation CSV adds `法人コード`. It is required for create and immutable after create.
2. Store CSV keeps `店舗No` but makes it required for create and immutable after create.
3. Employee CSV replaces the combined write input `所属` with typed reference fields. Recommended initial fields are `法人コード`, `店舗ID`, `部署コード`, `役職コード`, and `職種コード` where authoritative codes exist.
4. Blank optional cells remain no-change. Explicit clear remains outside Phase 1.
5. Missing or ambiguous reference resolution rejects the entire batch.

## Safe progress completed

- S1 receipt foundation locally rehearsed.
- S2a request validator locally rehearsed with 10/10 fixtures.
- S2b production writes were not implemented from an ambiguous contract.

## Gate needed

The CSV create/reference contract requires product and Core DB approval before S2b atomic write source can be finalized. Production DDL/RPC/GRANT/DML, Edge wiring, frontend save enablement, and CSV import remain stopped.
