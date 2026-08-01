# Permission Matrix

This is a future server-side policy mapping. It does not change the existing common
Permission Model or any runtime authorization.

| Role | Upload | Validate | Review | Publish | View projection |
| --- | --- | --- | --- | --- | --- |
| Representative | No | No | Read | Exception and rollback co-approval only | All 20 stores |
| Sales director | No | No | Read | No | Direct 13 stores |
| Accounting manager | Create | Read | Read | Normal publisher | Accounting-approved scope |
| Area manager | No | No | No | No | Assigned stores only; unassigned is deny-by-default |
| Store manager | No | No | No | No | Own approved store only |
| FC owner | No | No | No | No | Own approved FC store; FC profit unavailable in V1 |
| Employee | No | No | No | No | Denied (`403`) |

Accounting is the formal V1 uploader, reviewer, and normal publisher. Rollback
requires Accounting plus Representative approval. AM assignments are resolved from
the effective-dated multiple-store fields of Employee Master. Browser controls are
never the authorization boundary.
