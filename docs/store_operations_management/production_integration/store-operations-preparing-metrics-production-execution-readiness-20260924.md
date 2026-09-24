# Store Operations preparing metrics Production execution readiness

## Control state

- Portfolio lock: `CTO-PORTFOLIO-EXECUTION-ORDER-2026-09-21-V5`
- Current/requested phase: `PHASE_3_STORE_OPERATIONS_MANAGEMENT_V1`
- Base `main`: `d77e0213b354c39d855993cd6fd5a93e8da10bf0`
- Production project ref: `nkmxevmioczcmnldreyo`
- Status: `AWAITING_SEPARATE_OWNER_PRODUCTION_EXECUTION_APPROVAL`
- Production DB writes executed while preparing this package: **0**
- Deploys executed while preparing this package: **0**

The executable SQL is deliberately fail-closed. It requires an external session setting that is not supplied by the artifact, verifies the frozen Production baseline, takes a transaction-scoped advisory lock, and executes in one transaction. A failed approval, baseline, promotion, or read-back gate rolls the transaction back.

## Frozen input and candidate boundary

- Input SHA-256: `EF2C56108BACED3F1999F6903C681B8D7BE963A50707388DC84BEA2BBFA68942`
- Package root SHA-256: `94CA104E062E3BCB2CB47910AA47F95F578C1BF9463196A2A4D9304E5A4ABBBA`
- Candidate root SHA-256: `3D71C4A6195BC9264C454C9C666952D2A266C44F45A7637E860EF09762E62060`
- Candidate scope: `SALON` and `READY_AFTER_CORE_DB_STORE_ID_EXACT_MATCH` only
- Candidate metric: `RETAIL_PURCHASE_CUSTOMER_VISITS`
- Candidate definition: `POS_RETAIL_PURCHASE_CUSTOMER_COUNT_V1`
- Candidate value kind: quantity
- Candidate rows: 1,492
- COMPANY_TOTAL canonical rows: 0
- EC/HQ canonical rows: 0
- Outside-operation-period canonical rows: 0
- Existing `RETAIL_PURCHASE_RATE`: 4 active rows, insert 0, update 0

## Read-only Production baseline

The preflight observed the following baseline before package generation:

- actor employee: 1 exact active match
- `RETAIL_PURCHASE_CUSTOMER_VISITS` definition: 0
- `RETAIL_PURCHASE_CUSTOMER_VISITS` active Facts: 0
- existing `RETAIL_PURCHASE_RATE` active Facts: 4
- fixed source file: 0
- package-specific entity mappings: 0
- canonical company identities: 6 exact matches
- canonical store identities: 21 exact matches, including separate historical/current KYARA identities
- unresolved mappings: 0
- multiple-match mappings: 0

The execution SQL rechecks these values before its first schema or business-data write. A mismatch fails closed.

## Planned database effects after a future separate approval

Schema objects:

- new table/view/function/policy: 0
- public API object: 0
- GRANT change: 0
- existing `metric_definitions_metric_code_check`: replace once to add the quantity metric code

Rows:

- metric definition insert: 1
- company mappings: 6
- store mappings: 21
- source files: 1
- import batches: 92
- raw rows: 1,492
- staging rows: 1,492
- canonical quantity Facts: 1,492
- import events: 92
- batch status updates: 92
- total planned inserts: 4,689
- existing rate rows changed: 0

The fixed SQL is not an idempotent retry mechanism. Its baseline requires no prior package write. If commit status is unknown, fingerprint/read-back must be performed; blind retry is prohibited.

## Security boundary

- `public.dbf_store_monthly_metric_facts` retains existing RLS and FORCE RLS.
- No policy is added or relaxed.
- No anonymous or authenticated insert privilege is added.
- No GRANT is emitted.
- The Data API surface is unchanged.
- No `SECURITY DEFINER` object is introduced.

## Artifact SHA-256

- execution SQL: `34B3D54588C051EC037AD1963B4FA5DE409B5146F4FC62F78EB4CF1829AC4523`
- execution manifest: `C68D65D6C800BF77F2BB25F42FDE85D441F9534A3F4E88EB791FA0B0C0463991`
- execution generator: `BCF474E2189DDA364CB03A43E6415A65B2DEB1D47BC7060F7AB3DCF4CA5D6292`
- write-incapable candidate loader: `9D4D7DFBF9A13EC66B946A5B22A42E0D828A7588627DADD99D4A5747625AEF82`
- package validator: `42E202DF8A69D8EFB1B7AC3A80A81CD639550D37594FAFB20F2E1528B89F423C`
- review-only invalidation plan: `4864CDC113169D1803A40C5271C5A15084AE379BDEC45A19A09E67A948CAEED6`
- Node execution test: `E9E3C542411AF6598EB6FBDAB3B9D5AB8AB400F858285AFE00D09BFB5B1252A5`
- PostgreSQL fixture: `91C906490176FB4013CE7E40D3E8A10EBD177DDCA6AF2E17B9D48C5B753D8BD7`
- PostgreSQL assertions: `396B4705C19A84D8A645314EC305E2613E34836C3B91513C0E706E84578906AE`
- CI workflow: `AC9E3D55C5B2BAF3DD01EBA6CDB25FBA7FBF898FA30E9C7C2C968BB34BFEFAA0`

## Test gates

- Node static/mock contract tests verify SHA/byte fixation, approval and baseline ordering, exact counts, scope exclusion, rate immutability, and rejection of a write-capable candidate plan.
- PostgreSQL 17 CI first proves the SQL fails without the external approval setting, then executes it only against the disposable CI database and verifies exact read-back counts, RLS/FORCE RLS, and browser-role insert denial.
- Production is not a CI target.

## Invalidation procedure

The adjacent review-only invalidation plan never deletes source, raw, staging, audit, or Fact history. After a separate Owner approval it would mark the package Facts inactive/superseded, append audit events, mark batches rolled back, and retire package-specific metadata. It is fail-closed and is not authorized for execution by this PR.

## Remaining gates

1. PR checks must pass and the PR must be reviewed.
2. PR merge requires a separate Owner approval.
3. After merge, the final `main` SHA and every execution artifact SHA must be fixed again.
4. Production execution requires a separate Owner approval naming the final SQL SHA and planned counts.
5. Production deploy remains out of scope.
