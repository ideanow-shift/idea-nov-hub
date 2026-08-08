# PR002 / M019 Release Gate

## Authoring gate

- Exactly one new table: `accounting.consumer_access_contracts`.
- Exactly three functions: append-only guard, internal current-contract resolver and one read port.
- Exactly one trigger and four explicit indexes.
- M001–M018 and M061–M063 change zero.
- M018 six Views remain security-invoker/security-barrier and ungranted.
- Raw Accounting grants and Consumer writer privileges remain zero.
- SECURITY DEFINER inventory increases by exactly one justified read port with empty search path, explicit qualification, internal authorization and no dynamic SQL.

## Negative / security gate

Reject anon, generic authenticated, unauthorized subject, inactive Employee, invalid Assignment, cross-Store, cross-Department, wrong Scenario, raw table SELECT, direct View access, Projection DML, Publication write, direct helper abuse, contract UPDATE/DELETE and malformed decision chains. Unpublished and superseded exclusion remain M018/M017 regression responsibilities.

## Fresh DB gate

PostgreSQL 17, Forward 22/22, M019 Validation, M019 negative/security test, M018 projection regression, M017/M016 and M015/M063 regressions, M019-only rollback, full rollback 22/22, object residue zero, reapply 22/22, catalog equality and fixture residue zero are mandatory. M019 introduces no writer/lock path; an additional Concurrency Gate is不要.

## Release state

Production dependency 0. Staging/Production apply, access-contract data load, Store Operations/Finance connection and commit/push/PR remain separately authorized. DBF Accounting Foundation Complete is not declared until those applicable gates are explicitly accepted.
