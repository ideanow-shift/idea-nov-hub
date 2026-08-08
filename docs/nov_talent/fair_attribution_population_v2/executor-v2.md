# Fair Attribution Queue Population Executor v2

Status: `IMPLEMENTED / NOT DEPLOYED / POPULATION NOT EXECUTED`

## Boundary

The command exists only for `idea-nov-staging` (`zgkoofphhivesclehrom`). The operator supplies the private Manifest v2 raw UTF-8 JSON and the 528-cell source-range snapshot. Neither payload is stored in this repository, logged, or returned. Actor UUID and role are resolved from the NOV HUB session by the existing server-side bootstrap; the request body cannot supply or override them.

There is no Portal UI for this command. The private operator runner defaults to validation-only and requires all of the following before its single HTTP request:

1. explicit `--execute`;
2. an authenticated `NOV_HUB_SESSION_TOKEN`;
3. a separate Owner approval token;
4. an Edge runtime activation flag set to exact `true`;
5. the SHA-256 of the Owner approval token configured as a server secret.

An unset flag or approval secret fails closed. The executor performs no retry.

## Atomic database command

The service-role-only RPC takes a transaction advisory lock and table locks. It checks the fixed Manifest, Source, Candidate snapshot, Fair snapshot, counts, current identities, active Fair state, and empty Attribution/Audit/CONFIRMED state before any insert. It then inserts exactly:

- 201 `ORIGIN / PENDING` Attribution rows;
- 201 append-only creation Audit rows;
- 0 `CONFIRMED` rows;
- 0 `REJECTED` rows.

Any failed assertion raises an exception, rolling back the whole RPC. A second or concurrent invocation fails because the advisory lock serializes attempts and the required existing state is no longer zero.

The exact 201 Candidate–Fair rows are independently sealed in the database with SHA-256 `074db42b222ec1230dbefdccd099f708b272bca385760a3bc3b7679a053dbc09`. Its canonical stream is `candidate_id|fair_id|source_row|source_evidence`, ordered by Candidate ID then Fair ID and joined with LF. This prevents a direct service-role RPC from substituting a different 201-pair payload with the same aggregate counts.

Each inserted Attribution and Audit evidence reference contains the fixed Manifest canonical hash, Source hash, and source row, without Candidate names or contact details.

## Source freshness boundary

The Edge recomputes the fixed Source Hash from the supplied 528 raw cell values using Source Hash Contract v1. It does not hold Google credentials and does not fetch the Spreadsheet itself. The DB guardian must therefore certify that the supplied range snapshot was read-only fetched from the authorised Sheet immediately before activation. Candidate and Fair hashes are independently recomputed from locked live Staging tables inside the RPC.

## Response-loss rule

The database transaction may commit before an HTTP transport or response-contract failure becomes visible to the runner. Such a failure must never be retried. Operations must immediately disable the activation flag and perform a read-only count check. Expected committed state is Attribution 201, Audit 201, PENDING 201, CONFIRMED 0, REJECTED 0.

After the first authorised attempt, whether it returns success or an indeterminate transport result, operations must immediately disable the activation flag and remove or rotate the one-time Owner approval secret. A successful response is not permission to leave the command surface active; the database zero-state check is a final backstop, not the primary shutdown mechanism.

## Deployment and execution are separate approvals

Migration apply and Edge deploy require their normal Staging review. Neither action authorises population. Population additionally requires DB guardian `PASS — READY FOR POPULATION` evidence and a separate Owner approval token. Production migration, deploy, and execution are prohibited.

## Independent rollback

The review-only rollback script removes only the executor RPC with its exact five-argument identity. It first fails closed unless the expected function exists exactly once and both canonical Attribution/Audit tables remain present. It does not delete business rows, drop the canonical tables, or use `CASCADE`.

After any rollback, the activation flag and Owner approval secret must remain disabled. Reapply requires the complete Staging migration gate again; rollback does not authorise Population.
