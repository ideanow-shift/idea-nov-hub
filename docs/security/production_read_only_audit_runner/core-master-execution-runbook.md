# Core Master Attestation Runbook

## Before execution

1. Production Platform owner verifies the private identity profile matches the approved project and the public HUB API target.
2. DB owner privately attests the dedicated audit login's properties, expiry, grants, and lack of inheritance or bypass privileges.
3. Security owner verifies the sealed runner hash and private broker release. No credential may be exposed to the operator.
4. Representative, OS owner, and DB owner approve one run with C01-C10 and a 60-second window.

## Single execution

The private broker invokes the sealed runner one time. The runner validates request, identity, and audit login; opens one connection; begins a read-only transaction with fixed timeouts; verifies `transaction_read_only`; executes only approved IDs; sanitizes output; then always rolls back and closes.

## After execution

Store only the sanitized receipt in the approved restricted evidence store. The DB owner revokes or expires the credential according to the approved expiry and records a revocation receipt. Any failure is a safe stop; do not rerun without a new approval.

## Explicitly out of scope

No DML, DDL, migration, RLS/policy/function change, API behavior change, Secret change, raw data retrieval, or staging replication is authorized by this runbook.
