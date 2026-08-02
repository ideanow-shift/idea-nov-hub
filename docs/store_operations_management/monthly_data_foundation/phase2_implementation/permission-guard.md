# Permission Guard

The local guard accepts only server-resolved test actors. Accounting alone may upload, dry-run, validate, import, review, and publish. Rollback requires separate Accounting and Representative actors. Published reads are scoped to all 20 fixture stores for Accounting/Representative, direct 13 for Sales Director, verified effective assignments for AM, and exactly one known store for Store Manager. General employees and an AM without a verified effective assignment receive `403`.

The fixture does not implement a HUB verifier. Replacing this guard with a canonical server-side verifier remains a prerequisite for any deployed endpoint.
