# Store Operations Sealed Snapshot v1.3.2 Release Gate

- QP04 resolves the effective Canonical Sales department head assignment.
- Duplicate, inactive, expired, wrong-department, and wrong-assignment rows fail closed.
- Operator and Reviewer must be distinct.
- Legacy position or role evidence alone is insufficient.
- Auth evidence is neither queried nor required.
- The fixed Query Registry, Schema Contract, AST allowlist, Package Lock, and byte hashes are synchronized.
- Source limited-role access is restricted to the exact columns used by QP04.
- PUBLIC ACL, existing roles, DML, CREATE, Sequence, Routine, and `auth` privileges remain unchanged.
