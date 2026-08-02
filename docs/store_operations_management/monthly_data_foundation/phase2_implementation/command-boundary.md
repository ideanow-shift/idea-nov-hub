# Command Boundary

The fixture-only Import Center accepts exactly seven commands: `upload`, `dry-run`, `validate`, `import`, `review`, `publish`, and `rollback`. It has no database client, network client, file writer, UI, RPC, or deployment code.

Actors are supplied only through the test harness as `source: server`; command payloads reject role, employee, store-scope, or approval authority fields. This models the required future server-side HUB session resolution without inventing a new authentication system.

Accounting can run the first six commands. Rollback records separate Accounting and Representative approvals and completes only after two distinct server-resolved employees have approved.
