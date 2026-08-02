# RLS and Grant Candidate Plan

## Status

No RLS policy, grant, role, or schema has changed. There are three policy domains to review after catalog and session ownership confirmation.

| Domain | Required behavior | Prohibited behavior |
|---|---|---|
| Accounting lifecycle | Only fixed server-side commands can create or transition batches, versions, validations, publications, or audit events. | Browser table access, arbitrary state transitions, writes outside the command boundary. |
| Core Master and employee scope | Server resolves approved sheet mapping, store status, legacy crosswalk, and effective AM/store assignments. | Client-selected scope, guessed AM assignment, broad mapping edits. |
| Published projection | Server returns only published facts within resolved role/store scope. | Draft facts, FC profit exposure, direct browser access, data beyond scope. |

## Grant Principles

- No anonymous or browser `SELECT`, `INSERT`, `UPDATE`, or `DELETE` grant to lifecycle tables.
- No `BYPASSRLS`, owner bypass, service credential in a browser, or inherited broad role.
- Future server runtime receives the least privilege necessary for fixed commands and published reads.
- The transaction/write account for future imports and the read account for projections must be separated if the platform supports separate principals.
- RLS predicate implementation must use authenticated server actor context, not request-body role/scope fields.

## Required Decisions Before SQL

1. Confirm target catalog RLS state, grants, owners, and existing policy naming.
2. Confirm the canonical HUB session verifier and claim-to-employee resolution.
3. Confirm authoritative employee store assignment relation and effective-date semantics.
4. Confirm whether Accounting reviewer and publisher are distinct duties in the target operating model.

No policy SQL is intentionally proposed until these facts are attested.
