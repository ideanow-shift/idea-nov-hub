# PR002 / M017 Accounting Publication — Release Gate

## Authoring gate

- Migration order: `M001–M011 -> M061 -> M012 -> M013 -> M062 -> M014 -> M015 -> M063 -> M016 -> M017`.
- Existing Migration files are immutable; M018/M019 artifacts remain absent.
- M017 creates exactly `publication_releases`, `publication_members` and `comparison_rules`.
- Consumer Views/APIs, Cash Flow, data load, Production and downstream connections remain zero.

## Contract gate

- Only an approved, non-stale Accounting Version with a complete blocking PASS cycle can publish.
- Scenario/version/scope-specific approved M016 decisions match the same cycle and content hash.
- Actual requires `import_validated`; store/department content requires `operations_confirmed`.
- Adjustment/Reversal require matching approvals.
- Facts remain tax-exclusive, immutable and are not copied.
- One release has exactly one pinned member.
- One current published Version exists per Corporation/month/Scenario stream.
- Prior releases/members remain append-only and the prior Version becomes `superseded`.
- Stable request retry is idempotent; conflicting request reuse and duplicate Version publication fail.
- Publication Audit is append-only.
- Previous Year is not a Scenario; comparison rules do not produce Consumer rows.

## Negative gate

Reject draft, validating, validated-but-unapproved, rejected, stale, incomplete FAIL/PENDING validation, missing approval, duplicate publication, conflicting idempotency key, unauthorized publisher, invalid prior/supersede, current-stream duplication, direct published transition, published Version content mutation, Publication UPDATE/DELETE, Approval mutation and Consumer direct access.

## Security gate

- RLS enabled/forced 3/3; policies 0.
- PUBLIC/anon/authenticated/service_role direct table grants 0.
- PUBLIC/anon/authenticated/service_role function EXECUTE grants 0.
- SECURITY DEFINER 0; all M017 functions SECURITY INVOKER with empty search path.
- Consumer View 0, PII 0, Production dependency 0, CASCADE 0.
- All Foreign Key and stream lookup paths have usable indexes.

## Local Fresh DB gate

- PostgreSQL 17.
- Forward 20/20, `validate_m017.sql`, M017 negative/positive contract, M016 regression and M015/M063 regression pass.
- Because M017 introduces a stream-local advisory lock, a two-session test must prove same-stream serialization, different-stream independence, rollback lock release, deadlock increment 0 and fixture 0.
- M017-only rollback restores the M016 catalog and leaves M015/M063 intact.
- Full rollback 20/20 leaves BDF object count 0.
- Reapply 20/20 and first/reapply catalog hashes match.
- All fixtures roll back and the temporary PostgreSQL runtime/files are removed.

Commit, Push, PR creation, Staging Apply and M018 Authoring require separate Owner authorization.
