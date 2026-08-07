# PR001-B1 M061 Local Fresh DB Rehearsal Evidence

**Run:** M061-T1-20260807

**Tier:** Tier 1 Local Fresh DB

**Database:** PostgreSQL 17.10, UTF8, ephemeral Windows runtime

**Cloud Project created:** No

**Production/Staging connection:** No

## Forward

M001–M011 and M061 applied from an empty BDF catalog in the approved order. All 12 migrations compiled and passed. Migration history contained exactly 12 entries and no M012 entry. M010 reconfirmed the five required `security_invoker` views, normal 20/13/7 publication, pending-review rejection and fixture residue zero.

## M061 and M011 Gate

The full transaction-scoped synthetic Gate passed:

- rejected blank, whitespace-only and NULL mapping/masking contract versions;
- rejected missing source version;
- rejected Hash, Mapping and Masking mismatch labelled `passed`;
- accepted formal mapping/masking versions and matching expected/actual evidence;
- rejected missing Manifest, Validation and Approval sets;
- rejected header/Manifest record-count mismatch;
- rejected unknown Master type, negative count, duplicate Manifest and duplicate source version;
- activated the normal Header + 5 Manifests + 25 Validations + 4 Approvals fixture;
- rejected UPDATE/DELETE of activated Header, Manifest, Approval and Validation rows;
- rolled back all fixtures; persistent fixture rows were zero.

## Local security

| Check | Result |
|---|---|
| M011 tables with RLS enabled and forced | 4/4 |
| PUBLIC/anon/authenticated/service_role direct grants | 0 |
| SECURITY DEFINER functions in BDF schemas | 0 |
| forbidden PII columns | 0 |

Supabase JWT/Data API behavior, hosted role behavior and Supabase-specific catalog remain Tier 2 Staging Gates and are not claimed as locally proven.

## Rollback and reapply

- M061-only rollback passed; M061 constraints became 0 while all three M011 child tables and M011 history remained.
- Full rollback M011→M001 passed 11/11 without CASCADE.
- BDF schemas, relations, functions and migration history after rollback: 0.
- M001–M011 + M061 reapplied 12/12.
- Initial and reapply catalog fingerprint: `64015a8879a21d77c96fffe377313211`, 502 catalog items on both runs.
- M011 and M061 validation SQL passed after reapply.

## Cleanup contract

The PostgreSQL process is stopped after evidence capture. The database cluster, PostgreSQL binary runtime, downloaded archive and temporary logs are deleted. Port closure and path absence are required before this Run is marked complete.
