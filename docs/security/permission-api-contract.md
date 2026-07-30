# Permission API Contract Architecture

## Propagation path

`Runtime request -> API authorization evaluator -> Core Master and approved scope facts -> bounded data query -> RLS predicate -> minimum response projection`

The Runtime presents only product context and requested business action. It
does not send employee, role, department, store, data, or action authority as a
trusted value. The API resolves the active employee and all six permission
layers server-side, then calls Core Master and domain data contracts through
bounded interfaces.

## Candidate request contract

| field | supplied by | treatment |
| --- | --- | --- |
| `resource_type` | Runtime | Allowlisted domain resource selector |
| `resource_context` | Runtime | Validated business target, never authority |
| `requested_action` | Runtime | Allowlisted action intent |
| session credential | Platform | Server validates subject; not application payload |

## Candidate authorization result

| field | purpose |
| --- | --- |
| `decision` | Allow or deny category only |
| `permission_model_version` | Evaluated architecture version |
| `resource_predicate_category` | Stable bounded predicate category, not raw SQL |
| `projection_category` | Minimum response shape category |
| `action_category` | Evaluated action scope category |
| `audit_category` | Fixed audit event class |

## Contract requirements

- Runtime must disable unavailable actions for usability, but API and RLS make
  the authoritative decision.
- API checks must be performed per request and business action; cached display
  state cannot authorize a later mutation.
- Core Master supplies identity and approved organizational facts only through
  its governed contract. Domain applications do not maintain private role
  implementations.
- The data query receives only a bounded server-created predicate and minimum
  projection request.
- Denial responses use fixed safe categories and omit policy expressions,
  employee data, role assignments, raw database errors, and sensitive rows.

No endpoint, request handler, schema, JWT, RLS policy, or Runtime code changes
are made by this document.
