# Accounting Core Phase 3-2 operations

This prototype remains local. It must not receive production credentials.

## CLI

The SQLite database and all reports belong under an ignored private directory.
Metadata-only report:

```powershell
python -m accounting_core.cli --database private/core.sqlite report --version-id UUID
```

Provenance without amount output:

```powershell
python -m accounting_core.cli --database private/core.sqlite provenance --fact-id UUID
```

The provenance chain includes fact, raw value, cell, sheet, file hash, batch and
version. Detailed financial values are intentionally absent.

## Publication gates

The service rechecks confirmed period, zero blocking validations, approved
entity/account mappings, both approvals, explicit scope and active-publication
conflicts inside publication handling. Accounting approval alone and management
approval without accounting approval cannot publish.

Each import file carries `confirmed_through_period`. Raw values after that cutoff
remain available for audit only; normalization marks them `pending`,
`publish_allowed=false`, and `data_state=preparing`. The consumer view excludes
their facts even if another defect incorrectly marks a version published.

## Security boundary

`ActorContext` represents trusted server-side session resolution. A client body
cannot create it. Production adapters must discard client-supplied role and
scope fields. Raw, mapping, approval and audit tables have no frontend grants in
the review DDL. Consumer responses are created from the published projection.

## Production status

The PostgreSQL file is a review candidate wrapped in `BEGIN`/`ROLLBACK`; it was
not applied. Existing `finance_*` DDL is still Unknown and no compatibility
write was implemented.
