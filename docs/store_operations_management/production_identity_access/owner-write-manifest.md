# Owner Production write manifest — approval required, NOT executed

This manifest separates schema installation from identity configuration, release and business data.
It does not contain executable population SQL, a raw employee/Auth UUID, secret or session token.

## Exact minimum Owner identity writes

| Kind | INSERT count | Target / content |
| --- | ---: | --- |
| Canonical employee mapping | 0 | view, stable existing public employee UUID |
| AUTH-01 binding | 1 | auth01_binding_decisions, grant seq1, native HUB subject digest → existing employee + existing auth.users anchor |
| Role / role grant | 0 | reuse existing Executive / super_admin all |
| M019 scope | 1 | m019_scope_decisions, grant seq1, assignment_type global, scope_type all, scope_id/source_assignment_id null |
| Consumer Access | 1 | consumer_access_decisions, grant seq1, store_operations_v1, effective interval |
| Store mapping / population | 0 | source view over existing public official20; aliases not used by Owner scope |
| Auth user / employee / public store | 0 | existing rows only |
| **Total** | **3** | metadata-only ledger inserts in one transaction |

No Area/Store configuration is included. No canonical business facts are inserted/copied. Migration
DDL installation is a separate Owner approval (one new migration), not included in the three inserts.
No pilot/rollout flag or environment variable is set by identity configuration.

## Required evidence and execution guard for a later approved run

1. Confirm latest approved commit/checksum and Production project ID before any write.
2. Repeat read-only source resolution: Owner source code `1` must resolve exactly one active employee;
   confirm protected Owner identity evidence, active login credential and Executive/all source grants.
3. Independently verify the existing Auth anchor against the approved source-to-Auth crosswalk. A
   matching email/name is insufficient. Verify the Owner's normal signed native HUB session subject
   equals the selected operational employee UUID. Never transfer a Firebase UID into an Auth UUID field.
4. Record explicit Owner approval reference and effective dates in a restricted evidence artifact.
   Generate three independent decision keys. Fix SHA-256 of the verified HUB subject, exact employee
   and existing Auth UUID server-side; browser-provided identity values are not accepted.
5. Read latest ledgers. Exact approved active records already present → no-op. Any conflicting/different
   active record → stop, do not replace/update/delete. Inactive prior history stays immutable.
6. Under separately approved service-only READ COMMITTED transaction, insert three grants. No master
   or Auth write. Atomic preflight/insert and the trigger lock prevent duplicate subject/employee/auth
   or overlapping scope/access. Commit only if exact 1/1/1 and resolver returns executive/all/20.
7. Read-back counts, source master checksums and role/scope. Protected execution receipt identifies
   decision keys and evidence, not raw tokens. No keys or identity values in public browser/log output.

If crosswalk/normal session evidence is missing, configuration stops **before** writing anything.
`READY_FOR_OWNER_APPROVAL` means the minimum write unit is defined, not that it has been authorized
or that the above identity evidence can be skipped.

## Revocation

Later approved rollback of configured access appends **3 revoke decisions** (same decision keys,
next sequence, immutable grant fields, new approval evidence), preferably one transaction. Never
UPDATE/DELETE grants. Consumer revoke immediately disables the consumer; AUTH01/M019 revokes close
the remaining paths. Re-resolution must deny, while the audit history and source masters remain.
An emergency ACL containment file can stop execution without deleting configuration (see verification).

## Gates left outside this PR

Owner approval for identity evidence/configuration, new migration apply, existing four DBF release
migrations, Production secret/IAM readiness, approved API/frontend promotion with rollout initially
DISABLED, separately approved OWNER_PILOT and Owner Hosted Smoke. Area/Store real user acceptance
remains deferred until before enabling those roles for general Production use. GENERAL and Phase
transition always need their own Owner approval.
