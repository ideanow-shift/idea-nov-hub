# Fair Attribution Population Executor v2 - verification evidence

Date: `2026-08-08`

Status: `IMPLEMENTATION PASS / NOT DEPLOYED / POPULATION NOT AUTHORISED`

## Fixed contracts

- Manifest file SHA-256: `ecbadebb2a4b6bb6e0d4484193bd4088bc9f36ebf9fdbe8b56f8634be604d34b`
- Manifest canonical payload SHA-256: `db225936b21cd026496dba583aaae8b7ef215cc00fb54bc686698044506e0c53`
- Source range SHA-256: `394728af93cee9beaa56e38df23a716e8ccbedfc0ec37bb490263370e2d843d9`
- Candidate snapshot SHA-256: `01783932dc8cae65ef840dfa1e43becc41ebbb0e536b972d43017cadc141d1a3`
- Fair snapshot SHA-256: `766ba161ce59d326599c641e9d8531b19482bfd25dfa1ff2714bde240a8beca3`
- Exact Candidate-Fair pair payload SHA-256: `074db42b222ec1230dbefdccd099f708b272bca385760a3bc3b7679a053dbc09`
- Logical cases: 161 (`121` single-candidate Fair choices, `40` multiple-candidate Fair choices)
- Physical rows: 201 Attribution plus 201 creation Audit rows, all `ORIGIN / PENDING`

The private Manifest body, Source cells, Candidate IDs, Fair IDs, and personal information are not stored in this repository or this evidence file.

## Staging read-only evidence

The Candidate and Fair snapshot canonical streams were recomputed read-only against `idea-nov-staging` using the exact SQL byte encodings used by the RPC:

- active Candidate count: 636 (`2027`: 528, `2028`: 108);
- Candidate digest: exact match;
- Fair count: 82 (`active`: 46, `inactive`: 36);
- Fair digest: exact match, with `is_active` encoded as literal `t` or `f`;
- existing Attribution: 0;
- existing Audit: 0;
- existing confirmed ORIGIN: 0.

No Staging row was inserted or updated.

## Automated verification

- executor/source/grouping/workflow tests: 36/36 PASS;
- Workstream NOV Talent Node regression selection: 352/352 PASS;
- independent integration fixed Node regression selection: 424/424 PASS;
- Deno check for the Edge entrypoint: PASS;
- Workspace schema generator: PASS;
- `git diff --check`: PASS;
- Fresh isolated PostgreSQL 17.6: PASS.

The Fresh PostgreSQL test applies the workflow and executor migrations, verifies catalog identity, service-role-only grants and fixed `search_path`, exercises wrong-host and wrong-JWT rejection, rejects a tampered exact-pair payload, verifies zero business-row residue, then applies the review-only rollback and proves:

1. only the executor RPC is removed;
2. canonical Attribution/Audit and Candidate/Fair tables remain;
3. reapply succeeds;
4. the function identity/security/grant catalog is identical after reapply.

The temporary database cluster is stopped and deleted by the test.

## Gates intentionally carried forward

These are not implementation-test PASS claims:

1. The Edge does not live-fetch Google Sheets. The DB guardian must read the authorised Source range immediately before activation and attest the fixed Source hash.
2. The hosted PostgREST `request.headers` and `request.jwt.claims` behavior must be exercised after Staging migration apply. The local database proves fail-closed guards but not the hosted injection behavior.
3. The full 201+201 success path must be exercised only under the separately approved Staging Data Gate. Static or Fresh empty-database tests do not authorise Population.
4. Edge activation remains disabled by default, and no Owner approval secret is configured by this change.

For a future authorised one-shot attempt, the runbook requires immediate activation-flag disablement and Owner approval secret removal or rotation after the first attempt, including a successful response. Retry remains zero.

Migration apply, Edge deploy, and Population are three separate decisions. None was performed by this verification.

## Integration order

If Workstream B lands first, rebase this Workstream A branch onto that latest `main`, resolve the shared Edge entrypoint intentionally, and rerun the combined Contract/Deno/fixed regressions before review. Rollback removes only the A executor RPC and must never remove Attribution/Audit history.
