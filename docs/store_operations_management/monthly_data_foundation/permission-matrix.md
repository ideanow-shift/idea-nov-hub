# Permission Matrix

This is a future server-side policy mapping. It does not change the existing common
Permission Model or any runtime authorization.

| Role | Upload | Validate | Review | Publish | View projection |
| --- | --- | --- | --- | --- | --- |
| Representative | No | No | Read | Approve by governance | All 20 stores |
| Sales director | No | No | Read | No | Direct 13 stores |
| Accounting manager | Create | Read | Read | Proposed publisher | Accounting-approved scope |
| Area manager | No | No | No | No | Assigned stores only; unassigned is deny-by-default |
| Store manager | No | No | No | No | Own approved store only |
| FC owner | No | No | No | No | Own approved FC store; FC profit unavailable in V1 |
| Employee | No | No | No | No | Denied (`403`) |

The final publisher, approval separation, and approved assignment source remain
human decisions. Browser controls are never the authorization boundary.
