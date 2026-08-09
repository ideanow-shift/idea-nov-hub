# Read-only Role Contract

## Required Separate Roles

Source and Target each require a dedicated, expiring audit login. The role is
not `service_role`, does not bypass RLS, does not inherit an application or
administrator role, and permits only the private broker's pre-approved fixed
SELECTs.

| Mechanical proof at run time | Required result |
|---|---|
| Current-user attestation | Verified privately; value is not emitted. |
| `transaction_read_only` | `on` after `BEGIN READ ONLY`. |
| `default_transaction_read_only` | `on`. |
| INSERT / UPDATE / DELETE / TRUNCATE | Denied. |
| CREATE / ALTER / DROP / grant change | Denied. |
| Function or RPC write path | Denied. |
| `BYPASSRLS` | Denied. |
| `service_role` | Denied. |
| Role inheritance | Denied. |
| Connection count | One per side for the single run. |

The runner starts a read-only transaction, applies statement, lock, and idle
timeouts through the broker, verifies the role state, always rolls back, and
always closes. A writable or unprovable role stops before Stage 0 completes and
persists no Snapshot artifact.

## Permission Boundary

The future private SQL may read only the object set and logical columns named in
the separately approved Schema/Column Contract. It cannot accept a caller
parameter, arbitrary SQL text, a function name, an RPC request, or an export
request. Any required new permission is a separate Owner decision; this
Authoring package grants nothing.
